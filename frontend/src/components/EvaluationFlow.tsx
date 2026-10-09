"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useVideoFiles, type VideoNumber } from "@/components/VideoFilesProvider";
import { captureFrame } from "@/lib/captureFrame";
import { requestJoints } from "@/lib/visionClient";
import { confirmed, emptyAnswers, scorePostureScene, unknown } from "../../../lib/reba/score.ts";
import { sceneFromVlm } from "../../../lib/vlm/measure.ts";
import { VLM_JOINTS, type VlmEvidence, type VlmJoint, type VlmPoints, type VlmProposal, type VlmRequest } from "../../../lib/vlm/contract.ts";
import type { AnswerName, AnswerValues, Confirmation, RebaAnswers } from "../../../lib/reba/types.ts";
import type { Facing, PartName, Side } from "../../../lib/types.ts";
import "./evaluation.css";

const LABELS:Record<PartName,string>={neck:"목",trunk:"몸통",knee:"다리·무릎",upperArm:"위팔",lowerArm:"아래팔",wrist:"손목"};
const REASONS:Record<string,string>={no_person:"사람을 찾지 못함",multiple_people:"여러 사람",not_side_view:"측면 아님",too_far:"사람이 너무 작음",occluded:"관절 가림·낮은 신뢰",out_of_frame:"화면 밖",invalid_geometry:"각도 계산 불가",unknown_direction:"몸 방향 확인 필요",tracking_uncertain:"대상 추적 확인 필요",invalid_landmarks:"좌표 오류",missing_joint:"관절 누락"};
const BOOLEAN_QUESTIONS:[AnswerName,string][]=[
  ["neckTwist","목을 돌렸나요?"],["neckSideBend","목을 옆으로 기울였나요?"],
  ["trunkTwist","몸통을 비틀었나요?"],["trunkSideBend","몸통을 옆으로 기울였나요?"],
  ["unstable","발밑 지지면이 불안정한가요?"],["armAbducted","평가할 팔을 옆으로 벌리거나 회전했나요?"],
  ["shoulderRaised","평가할 쪽 어깨를 올렸나요?"],["armSupported","평가할 팔을 받치거나 기대거나 중력 도움을 받았나요?"],
  ["wristDeviated","평가할 손목을 옆으로 꺾었나요?"],["wristTwisted","평가할 손목을 회전했나요?"],
];
const QUESTION_LABELS:Partial<Record<AnswerName|"scene",string>>={...Object.fromEntries(BOOLEAN_QUESTIONS),scene:"평가 장면",neckBase:"목 구간",trunkUpright:"몸통 중립",trunkBase:"몸통 보충 구간",kneeExtra:"무릎 보충 구간",upperArmBase:"위팔 보충 구간",lowerArmBase:"아래팔 보충 구간",wristBase:"손목 구간",legs:"다리 지지",loadKg:"실제 무게·힘",shock:"충격·급격한 힘",coupling:"손잡이·결합",staticMinutes:"정지 시간",repeatsPerMinute:"분당 반복",repetitionIsWalking:"보행 여부",rapidChange:"빠른 자세 변화"};
const BAND_OPTIONS={
  neckBase:[[1,"중립·0~20° 앞굽힘"],[2,"20° 초과 앞굽힘 또는 뒤젖힘"]],
  wristBase:[[1,"0~15° 굽힘·젖힘"],[2,"15° 초과 굽힘·젖힘"]],
  trunkBase:[[1,"똑바로 섬"],[2,"0~20° 앞굽힘·뒤젖힘"],[3,"20° 초과~60° 앞굽힘 또는 20° 초과 뒤젖힘"],[4,"60° 초과 앞굽힘"]],
  kneeExtra:[[0,"30° 미만"],[1,"30~60°"],[2,"60° 초과"]],
  upperArmBase:[[1,"뒤로 20°~앞으로 20°"],[2,"뒤로 20° 초과 또는 앞으로 20° 초과~45°"],[3,"앞으로 45° 초과~90°"],[4,"앞으로 90° 초과"]],
  lowerArmBase:[[1,"팔꿈치 60~100° 굽힘"],[2,"60° 미만 또는 100° 초과"]],
} as const;
type BandName=keyof typeof BAND_OPTIONS;
const bandPart:Record<BandName,PartName>={neckBase:"neck",wristBase:"wrist",trunkBase:"trunk",kneeExtra:"knee",upperArmBase:"upperArm",lowerArmBase:"lowerArm"};

function SelectQuestion({name,label,field,options,change,allowNA=false}:{name:string;label:string;field:Confirmation<unknown>;options:readonly (readonly [string|number,string])[];change:(v:string)=>void;allowNA?:boolean}){
  const value=field.state==="confirmed"?String(field.value):field.state==="unknown"?"":field.state;
  return <label className="sa-question"><span>{label}</span><select name={name} aria-label={label} value={value} onChange={e=>change(e.target.value)}>
    <option value="">미확인</option>{options.map(([v,l])=><option key={String(v)} value={String(v)}>{l}</option>)}
    {allowNA&&<option value="not_applicable">해당 없음: 잡거나 지지하는 물체가 없음 (+0)</option>}
    <option value="unavailable">확인 불가</option></select></label>;
}
function NumericQuestion({name,label,field,max,change}:{name:string;label:string;field:Confirmation<number>;max:number;change:(v:string)=>void}){
  return <label className="sa-question"><span>{label}</span><input name={name} aria-label={label} type="number" min="0" max={max} step="any" value={field.state==="confirmed"?field.value:""} placeholder="미확인, 실제 0도 직접 입력" onChange={e=>change(e.target.value)}/>
    <button type="button" className="sa-link-button" onClick={()=>change(field.state==="unavailable"?"":"unavailable")}>{field.state==="unavailable"?"확인 불가로 기록됨, 초기화":"확인할 수 없음"}</button></label>;
}

export default function EvaluationFlow({onStage}:{onStage:(stage:number)=>void}){
  const {files,replaceFiles}=useVideoFiles();
  const videos=useMemo(()=>Object.entries(files).filter(([,file])=>file!==null).map(([number,file])=>({number:Number(number) as VideoNumber,file:file!,id:crypto.randomUUID()})),[files]);
  const [active,setActive]=useState(0),[busy,setBusy]=useState(false),[error,setError]=useState("");
  useEffect(()=>{setActive(0);setBusy(false);setError("");onStage(3);},[files,onStage]);
  function choose(files:FileList|null){
    if(!files?.length)return;
    if(files.length>3){setError("한 번에 최대 3편을 선택하십시오. 실제 작업에 있는 영상 한 편부터 평가할 수 있습니다.");return;}
    setError("");replaceFiles(Array.from(files));setActive(0);onStage(3);
  }
  return <section className="sa-evaluation" aria-label="작업 영상 REBA 평가">
    <div className="sa-form-card"><h2>평가할 영상</h2><p>같은 장면의 목·팔·다리를 함께 평가합니다. 영상 전체는 로컬에 남고, 동의한 대표 장면 한 장만 GPT로 전송합니다.</p>
      <label className="sa-question"><span>영상 파일 (최대 3편, 각 60초·250MB 이내)</span><input id="evaluation-files" type="file" accept="video/*" multiple disabled={busy} onChange={e=>choose(e.target.files)}/></label>
      <p className="sa-muted">측면에서 한 사람의 전신과 손목을 담아 주세요. 영상을 다시 선택하면 현재 분석과 답변이 초기화됩니다. 새로고침하면 파일을 다시 선택해야 합니다.</p>
      {error&&<p role="alert" className="sa-error">{error}</p>}
      {!!videos.length&&<div className="sa-video-tabs" role="tablist" aria-label="영상별 평가">{videos.map((v,i)=><button type="button" role="tab" aria-selected={active===i} key={v.id} disabled={busy} onClick={()=>{setActive(i);onStage(3);}}>영상 {v.number} · {v.file.name}</button>)}</div>}
    </div>
    {videos.map((v,i)=><div key={v.id} hidden={i!==active} data-video-active={i===active}><VideoEvaluation number={v.number} file={v.file} videoId={v.id} active={i===active} onBusy={setBusy} onStage={onStage}/></div>)}
  </section>;
}

const JOINT_LABELS:Record<VlmJoint,string>={ear:"귀",shoulder:"어깨",elbow:"팔꿈치",wrist:"손목",index_mcp:"검지 MCP",hip:"고관절",knee:"무릎",ankle:"발목"};
const CONNECTIONS:[VlmJoint,VlmJoint][]=[["ear","shoulder"],["shoulder","hip"],["shoulder","elbow"],["elbow","wrist"],["wrist","index_mcp"],["hip","knee"],["knee","ankle"]];
type Coordinates=Record<VlmJoint,{x:string;y:string}>;
function coordinateInputs(points:VlmPoints):Coordinates{return Object.fromEntries(VLM_JOINTS.map(name=>[name,{x:points[name]?(points[name]!.x*100).toFixed(2):"",y:points[name]?(points[name]!.y*100).toFixed(2):""}])) as Coordinates;}

function VideoEvaluation({number,file,videoId,active,onBusy,onStage}:{number:VideoNumber;file:File;videoId:string;active:boolean;onBusy:(v:boolean)=>void;onStage:(n:number)=>void}){
  const {publishResult}=useVideoFiles();
  const activeId=(name:string)=>active?name:undefined;
  const [url,setUrl]=useState(""),[phase,setPhase]=useState("대표 장면 선택"),[error,setError]=useState("");
  const [busy,setBusy]=useState(false),[duration,setDuration]=useState(0),[time,setTime]=useState(0),[side,setSide]=useState<Side|null>(null),[facing,setFacing]=useState<Facing|null>(null);
  const [consent,setConsent]=useState(false),[sceneChecked,setSceneChecked]=useState(false),[reviewChecked,setReviewChecked]=useState(false);
  const [proposal,setProposal]=useState<VlmProposal|null>(null),[points,setPoints]=useState<VlmPoints|null>(null),[coords,setCoords]=useState<Coordinates|null>(null),[joint,setJoint]=useState<VlmJoint>("shoulder");
  const [image,setImage]=useState(""),[evidence,setEvidence]=useState<VlmEvidence|null>(null),[answers,setAnswers]=useState<RebaAnswers|null>(null);
  const controller=useRef<AbortController|null>(null),runId=useRef(0),revision=useRef(0),video=useRef<HTMLVideoElement>(null);
  useEffect(()=>{const objectUrl=URL.createObjectURL(file);setUrl(objectUrl);return()=>{runId.current++;controller.current?.abort();URL.revokeObjectURL(objectUrl);};},[file]);
  const scene=useMemo(()=>evidence?sceneFromVlm(evidence):null,[evidence]);
  const {score,scoreError}=useMemo(()=>{try{return {score:scene&&answers?scorePostureScene(scene,answers):null,scoreError:""};}catch(e){return {score:null,scoreError:e instanceof Error?e.message:String(e)};}},[scene,answers]);
  useEffect(()=>publishResult(number,score),[number,score,publishResult]);
  useEffect(()=>{if(active&&answers)onStage(score?.status==="complete"?6:4);},[active,answers,score?.status,onStage]);
  function invalidate(){controller.current?.abort();revision.current++;setProposal(null);setPoints(null);setCoords(null);setImage("");setEvidence(null);setAnswers(null);setReviewChecked(false);setPhase("대표 장면 선택");setError("");onStage(3);}
  function clearConfirmation(){setEvidence(null);setAnswers(null);setReviewChecked(false);setError("");onStage(3);}
  function editPoint(name:VlmJoint,point:VlmPoints[VlmJoint]){setPoints(old=>old?{...old,[name]:point}:old);clearConfirmation();}
  function coordinate(name:VlmJoint,axis:"x"|"y",value:string){
    if(!coords)return;const next={...coords[name],[axis]:value};setCoords({...coords,[name]:next});
    const x=Number(next.x)/100,y=Number(next.y)/100;
    editPoint(name,next.x.trim()&&next.y.trim()&&Number.isFinite(x)&&Number.isFinite(y)&&x>=0&&x<=1&&y>=0&&y<=1?{x,y}:null);
  }
  async function analyze(){
    if(!video.current||!side||!facing||!consent||!sceneChecked){setError("평가할 쪽·몸 방향·장면 확인과 전송 동의를 완료하십시오.");return;}
    if(file.size===0||file.size>250*1024*1024){setError("영상은 0MB 초과·250MB 이내여야 합니다.");return;}
    controller.current?.abort();const abort=new AbortController();controller.current=abort;const id=++runId.current,rev=++revision.current;
    setBusy(true);onBusy(true);setProposal(null);setPoints(null);setCoords(null);setEvidence(null);setAnswers(null);setReviewChecked(false);setError("");setPhase("대표 장면을 추출하는 중");onStage(3);
    try{
      const captured=await captureFrame(video.current,time,abort.signal);if(runId.current!==id)return;
      setImage(captured.imageDataUrl);setPhase("GPT가 관절을 제안하는 중, 비교 실험에서 한 장 약 24~60초");
      const input:VlmRequest={schemaVersion:"safeangle-joints-v1",requestId:crypto.randomUUID(),capture:{scene:{videoId,frameIndex:rev,timeSec:captured.timeSec,side},revision:rev,imageSize:captured.imageSize,facing},imageDataUrl:captured.imageDataUrl,consent:{granted:true,noticeVersion:"representative-frame-v1"}};
      const result=await requestJoints(input,abort.signal);
      if(runId.current!==id||revision.current!==rev||abort.signal.aborted)return;
      setProposal(result);setPoints(structuredClone(result.points));setCoords(coordinateInputs(result.points));setPhase(`GPT 제안 완료 · ${(result.provenance.elapsedMs/1000).toFixed(1)}초 · 관절을 확인하십시오`);
    }catch(e){if(runId.current===id){setError(abort.signal.aborted?"분석을 취소했습니다. 다시 요청할 수 있습니다.":e instanceof Error?e.message:String(e));setPhase(abort.signal.aborted?"요청 취소":"분석 실패");}}
    finally{if(runId.current===id){setBusy(false);onBusy(false);}}
  }
  function confirmCoordinates(){
    if(!proposal||!points||!reviewChecked)return;
    const checked:VlmEvidence={requestId:proposal.requestId,imageDataUrl:image,capture:proposal.capture,provenance:proposal.provenance,originalPoints:proposal.points,reviewedPoints:points,confirmedBy:"human"};
    const selected=sceneFromVlm(checked);if(selected.availability.state!=="ready"){setError(selected.availability.reasons.join(" "));return;}
    setError("");setEvidence(checked);setAnswers(emptyAnswers(selected.key));onStage(4);
  }
  function setField<K extends AnswerName>(name:K,value:Confirmation<AnswerValues[K]>){setAnswers(old=>old?{...old,fields:{...old.fields,[name]:value}}:old);}
  function chooseField<K extends AnswerName>(name:K,value:string,parse:(v:string)=>AnswerValues[K],observable=false){
    setField(name,value===""?unknown():value==="unavailable"?{state:"unavailable",source:"human",value:null,observable:false}:value==="not_applicable"?{state:"not_applicable",source:"human",value:null,observable:false}:confirmed(parse(value),observable));
  }
  function bool(name:AnswerName,label:string){return <SelectQuestion key={name} name={name} label={label} field={answers!.fields[name]} options={[["false","아니요"],["true","예"]]} change={v=>chooseField(name,v,x=>x==="true")}/>;}
  function band(name:BandName){const part=bandPart[name],m=scene!.measurements![part];return <SelectQuestion key={name} name={name} label={`${LABELS[part]}: 장면에서 실제로 보이는 구간을 확인 (${m.value===null?"측정 불가":m.value.toFixed(1)+"° 추정"})`} field={answers!.fields[name]} options={BAND_OPTIONS[name]} change={v=>chooseField(name,v,Number,true)}/>;}
  return <>
    <section className="sa-form-card"><h2>대표 장면과 GPT 관절 확인</h2>
      <p id={activeId("analysis-phase")} role="status">{phase}</p>{error&&<p role="alert" className="sa-error">{error}</p>}
      <div className="sa-video-stage" style={proposal?{aspectRatio:`${proposal.capture.imageSize.width}/${proposal.capture.imageSize.height}`}:{}}>
        <video id={activeId("evaluation-video")} ref={video} src={url} preload="auto" muted playsInline style={image?{display:"none"}:{}} onLoadedMetadata={e=>{const d=e.currentTarget.duration;if(!Number.isFinite(d)||d<=0||d>60)setError("60초 이내의 영상을 선택하십시오.");else setDuration(d);}} onError={()=>setError("영상을 읽을 수 없습니다. 다른 파일을 선택하십시오.")}/>
        {image&&<img src={image} alt="GPT에 전송한 대표 장면" style={{display:"block",width:"100%"}}/>}
        {proposal&&points&&<svg id={activeId("evaluation-overlay")} role="img" aria-label="GPT가 제안한 관절, 아래 좌표 입력으로 수정 가능" viewBox={`0 0 ${proposal.capture.imageSize.width} ${proposal.capture.imageSize.height}`} style={{position:"absolute",inset:0,width:"100%",height:"100%"}} onPointerDown={e=>{
          const box=e.currentTarget.getBoundingClientRect();const p={x:Math.max(0,Math.min(1,(e.clientX-box.left)/box.width)),y:Math.max(0,Math.min(1,(e.clientY-box.top)/box.height))};editPoint(joint,p);setCoords(old=>old?{...old,[joint]:{x:(p.x*100).toFixed(2),y:(p.y*100).toFixed(2)}}:old);
        }}>
          {CONNECTIONS.map(([a,b])=>points[a]&&points[b]?<line key={a+b} x1={points[a]!.x*proposal.capture.imageSize.width} y1={points[a]!.y*proposal.capture.imageSize.height} x2={points[b]!.x*proposal.capture.imageSize.width} y2={points[b]!.y*proposal.capture.imageSize.height} stroke="#FF5A14" strokeWidth="3"/>:null)}
          {VLM_JOINTS.map(name=>points[name]?<g key={name}><circle cx={points[name]!.x*proposal.capture.imageSize.width} cy={points[name]!.y*proposal.capture.imageSize.height} r="5" fill={name===joint?"#fff":"#FF5A14"} stroke="#171717"/><text x={points[name]!.x*proposal.capture.imageSize.width+8} y={points[name]!.y*proposal.capture.imageSize.height-8} fontSize="13" fill="#fff" stroke="#171717" strokeWidth="0.4">{JOINT_LABELS[name]}</text></g>:null)}
        </svg>}
      </div>
      <div className="sa-scene-controls"><label>평가 장면 <input id={activeId("evaluation-timeline")} aria-label="평가 장면" type="range" min="0" max={Math.max(0,duration-0.001)} step="0.1" value={time} disabled={busy||!duration} onChange={e=>{invalidate();const t=Number(e.target.value);setTime(t);if(video.current)video.current.currentTime=t;}}/></label><output id={activeId("evaluation-time")}>{(proposal?.capture.scene.timeSec??time).toFixed(2)}초</output>
        <label>평가할 사람 기준 쪽 <select id={activeId("evaluation-side")} value={side??""} disabled={busy} onChange={e=>{invalidate();setSceneChecked(false);setSide(e.target.value?e.target.value as Side:null);}}><option value="">선택하십시오</option><option value="left">왼쪽</option><option value="right">오른쪽</option></select></label>
        <label>화면에서 몸이 향하는 방향 <select id={activeId("evaluation-facing")} value={facing??""} disabled={busy} onChange={e=>{invalidate();setSceneChecked(false);setFacing(e.target.value?Number(e.target.value) as Facing:null);}}><option value="">선택하십시오</option><option value="1">화면 오른쪽</option><option value="-1">화면 왼쪽</option></select></label>
      </div>
      <label className="sa-question"><span><input type="checkbox" checked={sceneChecked} disabled={busy} onChange={e=>{invalidate();setSceneChecked(e.target.checked);}}/> 한 사람의 측면 장면이며, 선택한 쪽을 실제로 볼 수 있습니다.</span></label>
      <label className="sa-question"><span><input type="checkbox" checked={consent} disabled={busy} onChange={e=>{if(!e.target.checked)invalidate();setConsent(e.target.checked);}}/> 선택한 장면 한 장을 OpenAI API에 전송하는 데 동의합니다.</span></label>
      <p className="sa-muted">전체 영상은 업로드하지 않습니다. 서버 저장을 요청하지 않지만 OpenAI의 별도 데이터 처리 정책이 적용됩니다. 영상 전체의 최악 자세를 자동 탐지하지 않습니다.</p>
      <div className="sa-controls"><button type="button" className="sa-button" disabled={busy||!duration||!side||!facing||!sceneChecked||!consent} onClick={()=>void analyze()}>{proposal?"이 장면 다시 분석":"GPT 관절 분석"}</button>{busy&&<button type="button" className="sa-button" data-variant="outline" onClick={()=>controller.current?.abort()}>요청 취소</button>}</div>
      {proposal&&points&&coords&&<>
        <p>관절을 선택한 뒤 원본 위를 눌러 수정하거나 좌표를 입력하십시오. X는 왼쪽부터, Y는 위쪽부터의 위치(%)입니다. 보이지 않는 관절은 확인 불가로 남기십시오.</p>
        <div className="sa-table-scroll"><table id={activeId("joint-editor")}><caption>같은 장면·같은 쪽의 GPT 제안과 사람 수정</caption><thead><tr><th>관절</th><th>X (%)</th><th>Y (%)</th><th>관측 상태</th></tr></thead><tbody>{VLM_JOINTS.map(name=><tr key={name}><th><button type="button" className="sa-link-button" aria-pressed={joint===name} onClick={()=>setJoint(name)}>{JOINT_LABELS[name]}</button></th>{(["x","y"] as const).map(axis=><td key={axis}><input aria-label={`${JOINT_LABELS[name]} ${axis.toUpperCase()} (%)`} type="number" min="0" max="100" step="0.01" value={coords[name][axis]} onChange={e=>coordinate(name,axis,e.target.value)} style={{maxWidth:"7rem"}}/></td>)}<td><button type="button" className="sa-link-button" onClick={()=>{editPoint(name,null);setCoords({...coords,[name]:{x:"",y:""}});}}>{points[name]?"확인 불가로 변경":"관측 불가"}</button></td></tr>)}</tbody></table></div>
        <label className="sa-question"><span><input type="checkbox" checked={reviewChecked} disabled={!!evidence} onChange={e=>setReviewChecked(e.target.checked)}/> 선택한 사람·쪽의 관절 위치를 확인했고, 보이지 않는 점은 남겨 두었습니다.</span></label>
        <button type="button" className="sa-button" disabled={!reviewChecked||!!evidence} onClick={confirmCoordinates}>관절 확인 완료, 작업 조건 입력</button>
        {scene?.measurements&&<div className="sa-table-scroll"><table id={activeId("measurement-table")}><caption>사람이 확인한 좌표로 코드가 계산한 2차원 각도</caption><thead><tr><th>부위</th><th>각도</th><th>보류 근거</th></tr></thead><tbody>{(Object.keys(LABELS) as PartName[]).map(part=>{const m=scene.measurements![part];return <tr key={part}><th>{LABELS[part]}</th><td>{m.value===null?"측정 불가":m.value.toFixed(1)+"°"}{m.approximate&&" (근사)"}</td><td>{m.reasons.map(r=>REASONS[r]??r).join(", ")}</td></tr>;})}</tbody></table></div>}
      </>}
    </section>
    {answers&&scene?.measurements&&<section className="sa-form-card" id={activeId("reba-questions")}><h2>선택한 장면의 확인 질문</h2><p>부위가 보이지 않거나 작업 조건을 모르면 확인 불가로 남기십시오. 추정값을 최저점으로 채우지 않습니다.</p>
      <fieldset><legend>Q1 · 자세와 지지</legend><div className="sa-question-grid">
        {band("neckBase")}{bool("trunkUpright","몸통이 똑바로 선 중립 자세인가요?")}
        {scene.measurements.trunk.value===null&&band("trunkBase")}
        <SelectQuestion name="legs" label="다리 지지 상태" field={answers.fields.legs} options={[["bilateral","양발 지지"],["walking","보행"],["sitting","앉음"],["unilateral","한쪽 다리 지지"]]} change={v=>chooseField("legs",v,x=>x as AnswerValues["legs"])}/>
        {scene.measurements.knee.value===null&&answers.fields.legs.value!=="sitting"&&band("kneeExtra")}
        {scene.measurements.upperArm.value===null&&band("upperArmBase")}{scene.measurements.lowerArm.value===null&&band("lowerArmBase")}
        {band("wristBase")}{BOOLEAN_QUESTIONS.map(([name,label])=>bool(name,label))}
      </div></fieldset>
      <fieldset><legend>Q2 · 실제 하중·힘</legend><p className="sa-muted">밀기·당기기는 물체 무게가 아닌 실제 가한 힘을 확인합니다. 힘은 kgf 상당값으로 입력하십시오.</p><div className="sa-question-grid">
        <NumericQuestion name="loadKg" label="확인한 무게(kg) 또는 가한 힘(kgf)" field={answers.fields.loadKg} max={100000} change={v=>chooseField("loadKg",v,Number)}/>{bool("shock","충격 또는 급격한 힘 증가가 있었나요?")}
      </div></fieldset>
      <fieldset><legend>Q3 · 손잡이·결합 상태</legend><SelectQuestion name="coupling" label="물체를 얼마나 안정적으로 잡거나 지지했나요?" field={answers.fields.coupling} allowNA options={[["good","양호: 안정적인 손잡이·쥐기 (+0)"],["fair","보통: 사용 가능하지만 이상적이지 않음 (+1)"],["poor","나쁨: 쥘 수 있으나 불량 (+2)"],["unacceptable","불가: 물체는 있는데 손잡이가 없거나 안전한 쥐기 불가 (+3)"]]} change={v=>chooseField("coupling",v,x=>x as AnswerValues["coupling"])}/></fieldset>
      <fieldset><legend>Q4 · 실제 작업의 활동 조건</legend><p className="sa-muted">60초 이하 영상만으로 1분 초과 정지를 입증할 수 없습니다. 실제 작업 조건을 확인하십시오. 지지면 불안정은 Q1 값을 한 번만 사용합니다.</p><div className="sa-question-grid">
        <NumericQuestion name="staticMinutes" label="한 부위 이상 같은 자세를 유지한 시간(분)" field={answers.fields.staticMinutes} max={1440} change={v=>chooseField("staticMinutes",v,Number)}/>
        <NumericQuestion name="repeatsPerMinute" label="작은 동작의 분당 반복 횟수" field={answers.fields.repeatsPerMinute} max={100000} change={v=>chooseField("repeatsPerMinute",v,Number)}/>
        {bool("repetitionIsWalking","기록한 반복은 보행 동작인가요?")}{bool("rapidChange","자세가 빠르고 크게 바뀌었나요?")}
      </div></fieldset>
    </section>}
    {(score||scoreError)&&<section className="sa-form-card" id={activeId("reba-result")} aria-label="REBA 결과">
      <div className="sa-score-header"><div><span className="sa-eyebrow">선택 장면 · {scene?.key.timeSec.toFixed(2)}초 · {side==="left"?"왼쪽":"오른쪽"}</span><h2>REBA 결과</h2></div><strong id={activeId("reba-final")} data-score={score?.final??""}>{score?.final===null||!score?"확정 점수 없음":`${score.final}점`}</strong></div>
      {scoreError&&<p role="alert" className="sa-error">{scoreError}</p>}
      {score&&<>
        <p id={activeId("reba-action")} role="status">{score.action?`조치 수준 ${score.action.level} · ${score.action.risk} · ${score.action.action}`:`${score.status==="unavailable"?"현장 확인·재촬영 필요":"확인 질문을 완료하십시오"}. 미확인 ${score.pending.length}개`}</p>
        {!!score.pending.length&&<details open><summary>남은 확인 항목 ({score.pending.length})</summary><ul id={activeId("reba-pending")}>{score.pending.map(p=><li key={p.field}>{QUESTION_LABELS[p.field]??p.field}: {p.reason}</li>)}</ul></details>}
        <div className="sa-table-scroll"><table id={activeId("reba-evidence")}><caption>부위별 근거, 원본 측정과 사람 확인을 구별합니다.</caption><thead><tr><th>부위</th><th>원본 각도</th><th>기본</th><th>가감</th><th>부위 점수</th><th>입력 출처·근거</th></tr></thead><tbody>{(Object.keys(LABELS) as PartName[]).map(part=>{const p=score.parts[part];return <tr key={part}><th>{LABELS[part]}</th><td>{p.measurement.value===null?"측정 불가":p.measurement.value.toFixed(1)+"°"}</td><td>{p.base??"미확인"}</td><td>{p.adjustment??"미확인"}</td><td>{p.score??"미확인"}</td><td>{p.source==="vlm"?"GPT 좌표·사람 확인":p.source==="video"?"영상 측정":p.source==="human"?"사람 확인":"미확인"} · {p.evidenceIds.join(", ")}<small>{p.notes.join(" ")}</small></td></tr>;})}</tbody></table></div>
        <p id={activeId("reba-calculation")}>표 A {score.tableA??"?"} + 하중·충격 {score.load??"?"} = A {score.scoreA??"?"} / 표 B {score.tableB??"?"} + 손잡이 {score.coupling??"?"} = B {score.scoreB??"?"} / 표 C {score.tableC??"?"} + 활동 {score.activity??"?"} = {score.final??"미확정"}</p>
        {score.activityBreakdown&&<p>활동 근거: 1분 초과 정지 +{score.activityBreakdown.static}, 분당 4회 초과 반복(보행 제외) +{score.activityBreakdown.repeated}, 빠른 변화 또는 불안정 지지 +{score.activityBreakdown.rapidOrUnstable}</p>}
        <p className="sa-muted">법적 부담작업 해당 여부: 미확인. 유해요인조사 전체: 미완료. REBA는 선택 장면의 자세 평가이며 법적 조사 완료를 뜻하지 않습니다.</p>
      </>}
    </section>}
  </>;
}
