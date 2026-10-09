"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Button from "@/components/ui/button/Button";
import { analyzeVideo, type VideoAnalysis } from "../../../lib/pose/video.ts";
import { analyzePoses } from "../../../lib/analysis.ts";
import { drawPose } from "../../../lib/pose/draw.ts";
import { confirmed, emptyAnswers, sceneFromAnalysis, scoreScene, unknown } from "../../../lib/reba/score.ts";
import type { AnswerName, AnswerValues, Confirmation, RebaAnswers } from "../../../lib/reba/types.ts";
import type { Analysis, Facing, PartName, Side } from "../../../lib/types.ts";
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
  trunkBase:[[1,"똑바로 섬"],[2,"0~20° 앞굽힘·뒤젖힘"],[3,"20~60° 앞굽힘 또는 20° 초과 뒤젖힘"],[4,"60° 초과 앞굽힘"]],
  kneeExtra:[[0,"30° 미만"],[1,"30~60°"],[2,"60° 초과"]],
  upperArmBase:[[1,"뒤로 20°~앞으로 20°"],[2,"뒤로 20° 초과 또는 앞으로 20~45°"],[3,"앞으로 45~90°"],[4,"앞으로 90° 초과"]],
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

export default function EvaluationFlow({task,onStage}:{task:string;onStage:(stage:number)=>void}){
  const [videos,setVideos]=useState<{id:string;file:File}[]>([]),[active,setActive]=useState(0),[busy,setBusy]=useState(false),[error,setError]=useState("");
  function choose(files:FileList|null){
    if(!files?.length)return;
    if(files.length>3){setError("한 번에 최대 3편을 선택하십시오. 실제 작업에 있는 영상 한 편부터 평가할 수 있습니다.");return;}
    setError("");setVideos(Array.from(files).map(file=>({file,id:crypto.randomUUID()})));setActive(0);onStage(2);
  }
  return <section className="sa-evaluation" aria-label="작업 영상 REBA 평가">
    <div className="sa-form-card"><h2>작업 영상 선택</h2><p>{task} · 같은 장면의 목·팔·다리를 함께 평가합니다. 영상은 서버로 전송되지 않습니다.</p>
      <label className="sa-question"><span>영상 파일 (최대 3편, 각 60초·250MB 이내)</span><input id="evaluation-files" type="file" accept="video/*" multiple disabled={busy} onChange={e=>choose(e.target.files)}/></label>
      <p className="sa-muted">촬영 후보: 낮은 곳에서 높은 곳으로 옮기기 / 앉아서 손 작업 / 밀기·당기기. 실제 업무에 해당하는 영상만 선택하십시오. 측면에서 한 사람의 전신과 손목을 담아 주세요.</p>
      {error&&<p role="alert" className="sa-error">{error}</p>}
      {!!videos.length&&<div className="sa-video-tabs" role="tablist" aria-label="영상별 평가">{videos.map((v,i)=><button type="button" role="tab" aria-selected={active===i} key={v.id} disabled={busy} onClick={()=>{setActive(i);onStage(3);}}>영상 {i+1} · {v.file.name}</button>)}</div>}
    </div>
    {videos.map((v,i)=><div key={v.id} hidden={i!==active} data-video-active={i===active}><VideoEvaluation file={v.file} videoId={v.id} active={i===active} onBusy={setBusy} onStage={onStage}/></div>)}
  </section>;
}

function VideoEvaluation({file,videoId,active,onBusy,onStage}:{file:File;videoId:string;active:boolean;onBusy:(v:boolean)=>void;onStage:(n:number)=>void}){
  const activeId=(name:string)=>active?name:undefined;
  const [url,setUrl]=useState(""),[analysis,setAnalysis]=useState<VideoAnalysis|null>(null),[phase,setPhase]=useState("분석 전"),[error,setError]=useState("");
  const [busy,setBusy]=useState(false),[progress,setProgress]=useState([0,1]),[index,setIndex]=useState(0),[side,setSide]=useState<Side>("left"),[facing,setFacing]=useState<Facing|null>(null);
  const [answers,setAnswers]=useState<RebaAnswers|null>(null),[aligned,setAligned]=useState(false);
  const controller=useRef<AbortController|null>(null),runId=useRef(0),video=useRef<HTMLVideoElement>(null),canvas=useRef<HTMLCanvasElement>(null);
  useEffect(()=>{const objectUrl=URL.createObjectURL(file);setUrl(objectUrl);return()=>{runId.current++;controller.current?.abort();URL.revokeObjectURL(objectUrl);};},[file]);
  const view:Analysis|null=useMemo(()=>analysis&&facing!==analysis.facing?analyzePoses(analysis.frames.map(f=>({timeSec:f.timeSec,personCount:f.personCount,landmarks:f.landmarks})),analysis.size,facing===null?{policy:analysis.policy}:{facing,policy:analysis.policy}):analysis,[analysis,facing]);
  const frame=view?.frames[index];
  const scene=view&&frame?sceneFromAnalysis(view,videoId,index,side):null;
  let score=null,scoreError="";
  try{if(scene&&answers)score=scoreScene(scene,answers);}catch(e){scoreError=e instanceof Error?e.message:String(e);}
  useEffect(()=>{if(active&&answers)onStage(score?.status==="complete"?6:4);},[active,answers,score?.status,onStage]);

  useEffect(()=>{
    const player=video.current,overlay=canvas.current;if(!player||!overlay)return;
    const ctx=overlay.getContext("2d");ctx?.clearRect(0,0,overlay.width,overlay.height);setAligned(false);
    if(!frame||!view)return;
    const draw=()=>{if(player.readyState<2 || Math.abs(player.currentTime-frame.timeSec)>0.002)return;overlay.width=view.size.width;overlay.height=view.size.height;drawPose(overlay,frame,view.size);setAligned(true);};
    const seek=()=>{player.pause();if(Math.abs(player.currentTime-frame.timeSec)<=0.002)draw();else player.currentTime=frame.timeSec;};
    player.addEventListener("seeked",draw);player.addEventListener("loadeddata",seek);
    if(player.readyState>=2)seek();
    return()=>{player.removeEventListener("seeked",draw);player.removeEventListener("loadeddata",seek);};
  },[frame,view]);

  async function analyze(){
    controller.current?.abort();const abort=new AbortController();controller.current=abort;const id=++runId.current;
    setBusy(true);onBusy(true);setAnalysis(null);setAnswers(null);setError("");setProgress([0,1]);onStage(3);
    try{
      const result=await analyzeVideo(file,{signal:abort.signal,onState:s=>{if(runId.current===id)setPhase({decoding:"영상을 읽는 중", "loading-model":"관절 모델 준비 중",analyzing:"관절을 추적하는 중",measuring:"각도를 계산하는 중"}[s]);},onProgress:(done,total)=>{if(runId.current===id)setProgress([done,total]);}});
      if(runId.current!==id)return;
      setAnalysis(result);setSide(result.side);setFacing(result.facing);setIndex(Math.max(0,result.frames.findIndex(f=>f.status!=="unusable"&&!f.requiresReview)));
      setPhase(`분석 완료: ${result.frames.length}장면, ${result.runtime.delegate}, ${(result.runtime.elapsedMs/1000).toFixed(1)}초`);
    }catch(e){if(runId.current===id){setError(abort.signal.aborted?"분석을 취소했습니다. 다시 분석할 수 있습니다.":e instanceof Error?e.message:String(e));setPhase(abort.signal.aborted?"분석 취소":"분석 실패");}}
    finally{if(runId.current===id){setBusy(false);onBusy(false);}}
  }
  function changeScene(act:()=>void){act();setAnswers(null);onStage(3);}
  function setField<K extends AnswerName>(name:K,value:Confirmation<AnswerValues[K]>){setAnswers(old=>old?{...old,fields:{...old.fields,[name]:value}}:old);}
  function chooseField<K extends AnswerName>(name:K,value:string,parse:(v:string)=>AnswerValues[K],observable=false){
    setField(name,value===""?unknown():value==="unavailable"?{state:"unavailable",source:"human",value:null,observable:false}:value==="not_applicable"?{state:"not_applicable",source:"human",value:null,observable:false}:confirmed(parse(value),observable));
  }
  function bool(name:AnswerName,label:string){return <SelectQuestion key={name} name={name} label={label} field={answers!.fields[name]} options={[["false","아니요"],["true","예"]]} change={v=>chooseField(name,v,x=>x==="true")}/>;}
  function band(name:BandName){const part=bandPart[name],m=frame!.measurements[side][part];return <SelectQuestion key={name} name={name} label={`${LABELS[part]}: 장면에서 실제로 보이는 구간을 확인 (${m.value===null?"측정 불가":m.value.toFixed(1)+"° 추정"})`} field={answers!.fields[name]} options={BAND_OPTIONS[name]} change={v=>chooseField(name,v,Number,true)}/>;}
  const globalBlocked=frame&&(frame.requiresReview||frame.personCount!==1||frame.reasons.some(r=>["not_side_view","too_far","unknown_direction","invalid_landmarks","tracking_uncertain"].includes(r)));
  return <>
    <section className="sa-form-card"><div className="sa-evaluation-head"><h2>장면과 관절 확인</h2><div className="sa-controls"><Button disabled={busy} onClick={()=>void analyze()}>{analysis?"다시 분석":"관절 분석 시작"}</Button>{busy&&<Button variant="outline" onClick={()=>controller.current?.abort()}>분석 취소</Button>}</div></div>
      <p id={activeId("analysis-phase")} role="status">{phase}</p>{busy&&<><progress aria-label="관절 추적 진행" max={progress[1]} value={progress[0]}/><span> {progress[0]} / {progress[1]}</span><p className="sa-muted">첫 추론 중에는 화면이 잠시 멈추며 취소가 지연될 수 있습니다.</p></>}
      {error&&<p role="alert" className="sa-error">{error}</p>}
      <div className="sa-video-stage" style={view?{aspectRatio:`${view.size.width}/${view.size.height}`}:{}}><video id={activeId("evaluation-video")} ref={video} src={url} preload="auto" muted playsInline controls={!analysis}/><canvas id={activeId("evaluation-overlay")} ref={canvas} aria-label="추정 관절 뼈대"/></div>
      {view&&frame&&<>
        <div className="sa-scene-controls"><label>평가 장면 <input id={activeId("evaluation-timeline")} aria-label="평가 장면" type="range" min="0" max={view.frames.length-1} step="1" value={index} onChange={e=>changeScene(()=>setIndex(Number(e.target.value)))}/></label><output id={activeId("evaluation-time")}>{frame.timeSec.toFixed(2)}초</output>
          <label>평가할 사람 기준 쪽 <select id={activeId("evaluation-side")} value={side} onChange={e=>changeScene(()=>setSide(e.target.value as Side))}><option value="left">왼쪽</option><option value="right">오른쪽</option></select></label>
          <label>화면에서 몸이 향하는 방향 <select id={activeId("evaluation-facing")} value={facing??"auto"} onChange={e=>changeScene(()=>setFacing(e.target.value==="auto"?null:Number(e.target.value) as Facing))}><option value="auto">자동</option><option value="1">화면 오른쪽</option><option value="-1">화면 왼쪽</option></select></label>
        </div>
        <p className="sa-muted">이 장면만 평가합니다. 목·손목은 2차원 근사치이며 손가락 관절·비틀림은 자동 확정하지 않습니다. <span id={activeId("scene-aligned")}>{aligned?"영상·뼈대 시각 일치":"영상 시각 맞추는 중"}</span></p>
        {globalBlocked&&<p className="sa-error" role="alert">이 장면은 채점할 수 없습니다. {frame.reasons.map(r=>REASONS[r]??r).join(" / ")} {frame.requiresReview&&"대상 교체·추적 확인이 필요합니다."} 다른 장면 또는 한 사람의 측면 영상을 선택하십시오.</p>}
        <div className="sa-table-scroll"><table id={activeId("measurement-table")}><caption>같은 장면의 양쪽 측정 원본, 각도(°)</caption><thead><tr><th>부위</th><th>왼쪽</th><th>오른쪽</th></tr></thead><tbody>{(Object.keys(LABELS) as PartName[]).map(part=><tr key={part}><th>{LABELS[part]}</th>{(["left","right"] as Side[]).map(at=>{const m=frame.measurements[at][part];return <td key={at}>{m.value===null?"측정 불가":m.value.toFixed(1)+"°"}{m.approximate&&" (근사)"}{!!m.reasons.length&&<small>{m.reasons.map(r=>REASONS[r]??r).join(", ")}</small>}</td>;})}</tr>)}</tbody></table></div>
        <Button disabled={!!globalBlocked||!aligned} onClick={()=>{setAnswers(emptyAnswers(scene!.key));onStage(4);}}>이 장면·쪽으로 확인 질문 작성</Button>
      </>}
    </section>
    {answers&&frame&&<section className="sa-form-card" id={activeId("reba-questions")}><h2>선택한 장면의 확인 질문</h2><p>부위가 보이지 않거나 작업 조건을 모르면 확인 불가로 남기십시오. 추정값을 최저점으로 채우지 않습니다.</p>
      <fieldset><legend>Q1 · 자세와 지지</legend><div className="sa-question-grid">
        {band("neckBase")}{bool("trunkUpright","몸통이 똑바로 선 중립 자세인가요?")}
        {frame.measurements[side].trunk.value===null&&band("trunkBase")}
        <SelectQuestion name="legs" label="다리 지지 상태" field={answers.fields.legs} options={[["bilateral","양발 지지"],["walking","보행"],["sitting","앉음"],["unilateral","한쪽 다리 지지"]]} change={v=>chooseField("legs",v,x=>x as AnswerValues["legs"])}/>
        {frame.measurements[side].knee.value===null&&answers.fields.legs.value!=="sitting"&&band("kneeExtra")}
        {frame.measurements[side].upperArm.value===null&&band("upperArmBase")}{frame.measurements[side].lowerArm.value===null&&band("lowerArmBase")}
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
      <div className="sa-score-header"><div><span className="sa-eyebrow">선택 장면 · {frame?.timeSec.toFixed(2)}초 · {side==="left"?"왼쪽":"오른쪽"}</span><h2>REBA 결과</h2></div><strong id={activeId("reba-final")} data-score={score?.final??""}>{score?.final===null||!score?"확정 점수 없음":`${score.final}점`}</strong></div>
      {scoreError&&<p role="alert" className="sa-error">{scoreError}</p>}
      {score&&<>
        <p id={activeId("reba-action")} role="status">{score.action?`조치 수준 ${score.action.level} · ${score.action.risk} · ${score.action.action}`:`${score.status==="unavailable"?"현장 확인·재촬영 필요":"확인 질문을 완료하십시오"}. 미확인 ${score.pending.length}개`}</p>
        {!!score.pending.length&&<details open><summary>남은 확인 항목 ({score.pending.length})</summary><ul id={activeId("reba-pending")}>{score.pending.map(p=><li key={p.field}>{QUESTION_LABELS[p.field]??p.field}: {p.reason}</li>)}</ul></details>}
        <div className="sa-table-scroll"><table id={activeId("reba-evidence")}><caption>부위별 근거, 원본 측정과 사람 확인을 구별합니다.</caption><thead><tr><th>부위</th><th>원본 각도</th><th>기본</th><th>가감</th><th>부위 점수</th><th>입력 출처·근거</th></tr></thead><tbody>{(Object.keys(LABELS) as PartName[]).map(part=>{const p=score.parts[part];return <tr key={part}><th>{LABELS[part]}</th><td>{p.measurement.value===null?"측정 불가":p.measurement.value.toFixed(1)+"°"}</td><td>{p.base??"미확인"}</td><td>{p.adjustment??"미확인"}</td><td>{p.score??"미확인"}</td><td>{p.source==="video"?"영상 측정":p.source==="human"?"사람 확인":"미확인"} · {p.evidenceIds.join(", ")}<small>{p.notes.join(" ")}</small></td></tr>;})}</tbody></table></div>
        <p id={activeId("reba-calculation")}>표 A {score.tableA??"?"} + 하중·충격 {score.load??"?"} = A {score.scoreA??"?"} / 표 B {score.tableB??"?"} + 손잡이 {score.coupling??"?"} = B {score.scoreB??"?"} / 표 C {score.tableC??"?"} + 활동 {score.activity??"?"} = {score.final??"미확정"}</p>
        {score.activityBreakdown&&<p>활동 근거: 1분 초과 정지 +{score.activityBreakdown.static}, 분당 4회 초과 반복(보행 제외) +{score.activityBreakdown.repeated}, 빠른 변화 또는 불안정 지지 +{score.activityBreakdown.rapidOrUnstable}</p>}
        <p className="sa-muted">법적 부담작업 해당 여부: 미확인. 유해요인조사 전체: 미완료. REBA는 선택 장면의 자세 평가이며 법적 조사 완료를 뜻하지 않습니다.</p>
      </>}
    </section>}
  </>;
}
