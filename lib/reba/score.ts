import type { Analysis, PartName, Side, TrackedFrame } from "../types.ts";
import { integerInRange, numberInRange, requireRecord } from "../validation.ts";
import { lookupA, lookupB, lookupC } from "./tables.ts";
import type { ActionLevel, AnswerName, AnswerValues, Confirmation, PartEvidence, PendingInput, RebaAnswers, RebaFields, RebaResult, RebaScene, SceneKey } from "./types.ts";
export type * from "./types.ts";

const PARTS: PartName[] = ["neck","trunk","knee","upperArm","lowerArm","wrist"];
const GLOBAL_FAILURES = ["no_person","multiple_people","not_side_view","too_far","unknown_direction","tracking_uncertain"];
export function sceneBlockReasons(frame: TrackedFrame): string[] {
  const reasons=frame.reasons.filter(r=>GLOBAL_FAILURES.includes(r));
  if(!Array.isArray(frame.landmarks)||frame.landmarks.length!==33||!frame.landmarks.some(p=>Number.isFinite(p.x)&&Number.isFinite(p.y)&&Number.isFinite(p.visibility)))reasons.push("invalid_landmarks");
  if(frame.personCount!==1)reasons.push(frame.personCount>1?"multiple_people":"no_person");
  if(frame.requiresReview)reasons.push("tracking_uncertain");
  return [...new Set(reasons)];
}
const BOOLEANS: AnswerName[] = ["trunkUpright","neckTwist","neckSideBend","trunkTwist","trunkSideBend","unstable","armAbducted","shoulderRaised","armSupported","wristDeviated","wristTwisted","shock","repetitionIsWalking","rapidChange"];
const LIMITS = { neckBase:[1,2],trunkBase:[1,4],kneeExtra:[0,2],upperArmBase:[1,4],lowerArmBase:[1,2],wristBase:[1,2],loadKg:[0,100000],staticMinutes:[0,1440],repeatsPerMinute:[0,100000] } as const;
const ENUMS = { legs:["bilateral","walking","sitting","unilateral"],coupling:["good","fair","poor","unacceptable"] } as const;
export const ANSWER_NAMES = [...BOOLEANS,...Object.keys(LIMITS),...Object.keys(ENUMS)] as AnswerName[];
export function unknown<T>(): Confirmation<T> { return {state:"unknown",value:null,source:"human",observable:false}; }
export function confirmed<T>(value: T, observable = false): Confirmation<T> { return {state:"confirmed",value,source:"human",observable}; }
export function emptyAnswers(scene: SceneKey): RebaAnswers {
  return {scene:{...scene},fields:Object.fromEntries(ANSWER_NAMES.map(name=>[name,unknown()])) as RebaFields};
}
function validateKey(key: SceneKey) {
  requireRecord(key,"scene key");
  if (typeof key.videoId!=="string" || !key.videoId.trim() || key.videoId.length>256) throw new TypeError("videoId가 필요합니다.");
  integerInRange(key.frameIndex,0,100000,"frameIndex");numberInRange(key.timeSec,0,60,"timeSec");
  if(key.side!=="left"&&key.side!=="right") throw new TypeError("평가할 쪽이 올바르지 않습니다.");
}
export function sceneFromAnalysis(analysis: Analysis, videoId: string, frameIndex: number, side: Side): RebaScene {
  if(!analysis || !Array.isArray(analysis.frames))throw new TypeError("분석 결과가 필요합니다.");
  integerInRange(frameIndex,0,analysis.frames.length-1,"frameIndex");
  const frame=analysis.frames[frameIndex]!;
  const key={videoId,frameIndex,timeSec:frame.timeSec,side};validateKey(key);
  return {key,frame};
}
function validateInput(scene: RebaScene, answers: RebaAnswers) {
  requireRecord(scene,"scene");validateKey(scene.key);requireRecord(scene.frame,"frame");
  requireRecord(answers,"answers");validateKey(answers.scene);requireRecord(answers.fields,"fields");
  if(scene.frame.timeSec!==scene.key.timeSec || ["videoId","frameIndex","timeSec","side"].some(k=>scene.key[k as keyof SceneKey]!==answers.scene[k as keyof SceneKey])) throw new Error("다른 영상·장면·쪽의 입력을 섞을 수 없습니다.");
  if(typeof scene.frame.requiresReview!=="boolean" || !Array.isArray(scene.frame.reasons))throw new TypeError("장면 품질 상태가 필요합니다.");
  integerInRange(scene.frame.personCount,0,100,"personCount");
  requireRecord(scene.frame.measurements,"measurements");requireRecord(scene.frame.measurements[scene.key.side],"side measurements");
  for(const part of PARTS){
    const m=scene.frame.measurements[scene.key.side][part];requireRecord(m,part);
    if(typeof m.approximate!=="boolean" || !Array.isArray(m.reasons))throw new TypeError(`${part}: 측정 근거가 필요합니다.`);
    if(m.status==="measured")numberInRange(m.value,part==="upperArm"?-90:part==="trunk"||part==="neck"?-180:0,part==="upperArm"?270:180,part);
    else if(m.status!=="unavailable" || m.value!==null)throw new TypeError(`${part}: 측정 상태와 값이 다릅니다.`);
  }
  for(const key of ANSWER_NAMES){
    const f=answers.fields[key];requireRecord(f,key);
    if(f.source!=="human" || typeof f.observable!=="boolean")throw new TypeError(`${key}: 사람 확인 출처가 필요합니다.`);
    if(f.state!=="confirmed"){
      if(!["unknown","unavailable","not_applicable"].includes(f.state) || f.value!==null || f.observable!==false || f.state==="not_applicable"&&key!=="coupling")throw new TypeError(`${key}: 확인 상태가 올바르지 않습니다.`);
      continue;
    }
    if(BOOLEANS.includes(key)){if(typeof f.value!=="boolean")throw new TypeError(`${key}: 예/아니요를 확인하십시오.`);}
    else if(key in LIMITS){
      const [min,max]=LIMITS[key as keyof typeof LIMITS];
      if(key.endsWith("Base") || key==="kneeExtra")integerInRange(f.value,min,max,key);
      else numberInRange(f.value,min,max,key);
    }else{
      const options: readonly string[]=ENUMS[key as keyof typeof ENUMS];
      if(typeof f.value!=="string"||!options.includes(f.value))throw new TypeError(`${key}: 선택지가 올바르지 않습니다.`);
    }
  }
}

// Shared boundaries go to the lower score; upright is confirmed, never inferred by a tolerance.
export function trunkBase(angle: number): number { numberInRange(angle,-180,180,"trunk");return Math.abs(angle)<=20?2:angle<0||angle<=60?3:4; }
export function neckBase(angle: number): number { numberInRange(angle,-180,180,"neck");return angle<0||angle>20?2:1; }
export function kneeExtra(angle: number): number { numberInRange(angle,0,180,"knee");return angle<30?0:angle<=60?1:2; }
export function upperArmBase(angle: number): number { numberInRange(angle,-90,270,"upperArm");return angle>=-20&&angle<=20?1:angle< -20||angle<=45?2:angle<=90?3:4; }
export function lowerArmBase(angle: number): number { numberInRange(angle,0,180,"lowerArm");return angle>=60&&angle<=100?1:2; }
export function wristBase(angle: number): number { numberInRange(angle,0,180,"wrist");return angle<=15?1:2; }
export function loadPoints(kg: number): number { numberInRange(kg,0,100000,"loadKg");return kg<5?0:kg<=10?1:2; }
export function activityPoints(minutes: number, repeats: number, walking: boolean, rapid: boolean, unstable: boolean) {
  numberInRange(minutes,0,1440,"staticMinutes");numberInRange(repeats,0,100000,"repeatsPerMinute");
  if([walking,rapid,unstable].some(v=>typeof v!=="boolean"))throw new TypeError("활동 조건의 예/아니요가 필요합니다.");
  return {static:minutes>1?1:0,repeated:!walking&&repeats>4?1:0,rapidOrUnstable:rapid||unstable?1:0};
}
export function actionLevel(final: number): ActionLevel {
  integerInRange(final,1,15,"final REBA");
  const level=final===1?0:final<=3?1:final<=7?2:final<=10?3:4;
  return {level,risk:["무시 가능","낮음","보통","높음","매우 높음"][level]!,action:["조치 불필요","조치 필요 가능","조치 필요","곧 조치 필요","즉시 조치 필요"][level]!};
}
export function scoreScene(scene: RebaScene, answers: RebaAnswers): RebaResult {
  validateInput(scene,answers);
  const fields=answers.fields, pending:PendingInput[]=[];
  const raw=scene.frame.measurements[scene.key.side];
  const parts={} as Record<PartName,PartEvidence>;
  for(const part of PARTS)parts[part]={measurement:structuredClone(raw[part]),source:null,base:null,adjustment:null,score:null,evidenceIds:[],notes:[]};
  const inputs=Object.fromEntries(ANSWER_NAMES.map(key=>[key,{...fields[key]}])) as RebaFields;
  const result:RebaResult={scene:{...scene.key},status:"pending",inputs,parts,pending,tableA:null,load:null,scoreA:null,tableB:null,coupling:null,scoreB:null,tableC:null,activity:null,activityBreakdown:null,final:null,action:null,legalApplicability:"unknown",surveyComplete:false};
  const failures=sceneBlockReasons(scene.frame);
  if(failures.length){
    result.status="unavailable";pending.push({field:"scene",state:"unavailable",reason:`재촬영·대상 확인 필요: ${[...new Set(failures)].join(", ") || "대상 추적 불확실"}`});return result;
  }
  function read<K extends AnswerName>(name: K): AnswerValues[K] | null {
    const f=fields[name];if(f.state==="confirmed")return f.value;
    if(!pending.some(p=>p.field===name))pending.push({field:name,state:f.state,reason:f.state==="unavailable"?"현장 확인·재촬영 필요":"사람 확인 필요"});
    return null;
  }
  function manual(name: "neckBase"|"trunkBase"|"kneeExtra"|"upperArmBase"|"lowerArmBase"|"wristBase") {
    const value=read(name);if(value!==null && !fields[name].observable){pending.push({field:name,state:"unavailable",reason:"장면에서 해당 부위를 볼 수 있다고 확인해야 합니다."});return null;}return value;
  }
  const pair=(a:AnswerName,b:AnswerName)=>{const x=read(a),y=read(b);return x===null||y===null?null:x||y?1:0;};
  function finish(part:PartName,base:number|null,adjustment:number|null,source:"video"|"human",ids:string[]){
    const p=parts[part];p.base=base;p.adjustment=adjustment;p.source=base===null?null:source;p.evidenceIds=ids;
    if(base!==null&&adjustment!==null)p.score=part==="upperArm"?Math.max(1,base+adjustment):base+adjustment;
    if(raw[part].approximate)p.notes.push("2차원 근사값, 사람 구간 확인을 사용합니다.");
    if(raw[part].value===null)p.notes.push("원본 측정 불가, 보이는 장면의 사람 구간 확인만 허용합니다.");
    if(part==="upperArm"&&base!==null&&adjustment!==null&&base+adjustment<1)p.notes.push("앱 정책: 표 B 최소 입력 1점으로 유지합니다.");
  }
  finish("neck",manual("neckBase"),pair("neckTwist","neckSideBend"),"human",["R02","R03","R04"]);
  const upright=read("trunkUpright");
  const tb=upright===null?null:raw.trunk.value===null?manual("trunkBase"):upright?1:trunkBase(raw.trunk.value);
  // A contradictory manual upright/band answer is an input error, not a silently corrected score.
  if(raw.trunk.value===null&&tb!==null&&upright!==null&&upright!==(tb===1))throw new Error("몸통 중립 확인과 보충 구간이 다릅니다.");
  finish("trunk",tb,pair("trunkTwist","trunkSideBend"),raw.trunk.value===null||upright?"human":"video",["R05","R06","R07"]);
  const legs=read("legs"),unstable=read("unstable");
  const ke=legs===null?null:legs==="sitting"?0:raw.knee.value===null?manual("kneeExtra"):kneeExtra(raw.knee.value);
  finish("knee",legs===null||unstable===null?null:legs==="unilateral"||unstable?2:1,ke,"human",["R08","R09"]);
  const abducted=read("armAbducted"),raised=read("shoulderRaised"),supported=read("armSupported");
  finish("upperArm",raw.upperArm.value===null?manual("upperArmBase"):upperArmBase(raw.upperArm.value),abducted===null||raised===null||supported===null?null:Number(abducted)+Number(raised)-Number(supported),raw.upperArm.value===null?"human":"video",["R10","R11","R12","R13"]);
  finish("lowerArm",raw.lowerArm.value===null?manual("lowerArmBase"):lowerArmBase(raw.lowerArm.value),0,raw.lowerArm.value===null?"human":"video",["R14"]);
  finish("wrist",manual("wristBase"),pair("wristDeviated","wristTwisted"),"human",["R15","R16"]);
  const kg=read("loadKg"),shock=read("shock");result.load=kg===null||shock===null?null:loadPoints(kg)+Number(shock);
  const coupling=fields.coupling.state==="not_applicable"?0:read("coupling");
  result.coupling=coupling===null?null:coupling===0?0:["good","fair","poor","unacceptable"].indexOf(coupling);
  const minutes=read("staticMinutes"),repeats=read("repeatsPerMinute"),walking=read("repetitionIsWalking"),rapid=read("rapidChange");
  if(minutes!==null&&repeats!==null&&walking!==null&&rapid!==null&&unstable!==null){result.activityBreakdown=activityPoints(minutes,repeats,walking,rapid,unstable);result.activity=Object.values(result.activityBreakdown).reduce((a,b)=>a+b,0);}
  if(parts.trunk.score!==null&&parts.neck.score!==null&&parts.knee.score!==null)result.tableA=lookupA(parts.trunk.score,parts.neck.score,parts.knee.score);
  if(result.tableA!==null&&result.load!==null)result.scoreA=result.tableA+result.load;
  if(parts.upperArm.score!==null&&parts.lowerArm.score!==null&&parts.wrist.score!==null)result.tableB=lookupB(parts.upperArm.score,parts.lowerArm.score,parts.wrist.score);
  if(result.tableB!==null&&result.coupling!==null)result.scoreB=result.tableB+result.coupling;
  if(result.scoreA!==null&&result.scoreB!==null)result.tableC=lookupC(result.scoreA,result.scoreB);
  if(!pending.length&&result.tableC!==null&&result.activity!==null){result.final=result.tableC+result.activity;result.action=actionLevel(result.final);result.status="complete";}
  else if(pending.some(p=>p.state==="unavailable"))result.status="unavailable";
  return result;
}
