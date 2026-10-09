import { analyzeVideo } from "../lib/pose/video.ts";
import type { VideoAnalysis } from "../lib/pose/video.ts";
import { analyzePoses, MEASUREMENT_DEFINITIONS } from "../lib/engine.ts";
import { drawPose } from "../lib/pose/draw.ts";
import type { PoseFrame } from "../lib/types.ts";
const fileInput=document.querySelector<HTMLInputElement>("#file")!;
const video=document.querySelector<HTMLVideoElement>("#video")!;
const canvas=document.querySelector<HTMLCanvasElement>("#overlay")!;
const run=document.querySelector<HTMLButtonElement>("#analyze")!;
const cancel=document.querySelector<HTMLButtonElement>("#cancel")!;
const timeline=document.querySelector<HTMLInputElement>("#timeline")!;
const status=document.querySelector<HTMLElement>("#status")!;
const progress=document.querySelector<HTMLProgressElement>("#progress")!;
const facingInput=document.querySelector<HTMLSelectElement>("#facing")!;
const summary=document.querySelector<HTMLElement>("#summary")!;
let result:VideoAnalysis|undefined, abort:AbortController|undefined, previewUrl:string|undefined;
type CheckWindow=Window&{engineResult?:VideoAnalysis};
const checkWindow=window as CheckWindow;
function resetOutput(){
  result=undefined;delete checkWindow.engineResult;timeline.disabled=true;summary.textContent="";
  document.querySelector("#measurements")!.replaceChildren();document.querySelector("#joints")!.textContent="";
  canvas.getContext("2d")?.clearRect(0,0,canvas.width,canvas.height);
}
function renderSummary(){
  if(!result)return;
  status.textContent=result.status==="ready"?"분석 완료":result.status==="partial"?"분석 완료: 일부 부위만 측정 가능합니다.":"분석 완료: 재촬영이 필요합니다.";
  summary.textContent=JSON.stringify({status:result.status,usableRatio:result.usableRatio,measuredFrameRatio:result.measuredFrameRatio,
    coverage:result.measurementCoverage,reasons:result.reasonCounts,runtime:result.runtime},null,2);
}
function renderFrame(index:number){
  const frame=result?.frames[index];if(!frame)return;
  timeline.value=String(index);
  document.querySelector("#time")!.textContent=frame.timeSec.toFixed(2)+"초 (영상 "+video.currentTime.toFixed(2)+"초)";
  canvas.width=result!.size.width;canvas.height=result!.size.height;
  drawPose(canvas,frame,result!.size);
  document.querySelector("#joints")!.textContent=JSON.stringify(frame.joints,null,2);
  const body=document.querySelector("#measurements")!;body.replaceChildren();
  for(const side of ["left","right"] as const)for(const[part,measurement]of Object.entries(frame.measurements[side])){
    const row=document.createElement("tr");
    for(const text of [(side==="left"?"왼쪽 ":"오른쪽 ")+MEASUREMENT_DEFINITIONS[part as keyof typeof MEASUREMENT_DEFINITIONS].label,
      measurement.value===null?"측정 불가":measurement.value.toFixed(1)+"°",
      [measurement.approximate?"근사치":"영상 평면상 각도",...measurement.reasons,
        ...new Set(measurement.joints.flatMap(index=>frame.joints[index]!.trackingWarnings)),
        ...(frame.requiresReview?["subject_change_suspected"]:[])].join(", ")]){
      const cell=document.createElement("td");cell.textContent=text;row.append(cell);
    }body.append(row);
  }
}
function nearestFrame(){
  if(!result?.frames.length)return;
  let best=0;for(let i=1;i<result.frames.length;i++)if(Math.abs(result.frames[i]!.timeSec-video.currentTime)<Math.abs(result.frames[best]!.timeSec-video.currentTime))best=i;
  renderFrame(best);
}
fileInput.addEventListener("change",()=>{
  abort?.abort();resetOutput();
  if(previewUrl)URL.revokeObjectURL(previewUrl);
  const file=fileInput.files?.[0];run.disabled=!file;progress.value=0;
  if(file){previewUrl=URL.createObjectURL(file);video.src=previewUrl;status.textContent="분석을 시작할 수 있습니다.";}
  else{video.removeAttribute("src");video.load();status.textContent="영상을 선택하십시오.";}
});
run.addEventListener("click",async()=>{
  const file=fileInput.files?.[0];if(!file)return;
  const current=new AbortController();abort=current;resetOutput();run.disabled=true;cancel.disabled=false;fileInput.disabled=true;facingInput.disabled=true;video.pause();
  progress.value=0;
  try{
    const facing=facingInput.value;
    const labels={"decoding":"영상을 읽는 중입니다.","loading-model":"포즈 모델을 준비 중입니다.","analyzing":"관절을 추적 중입니다.","measuring":"자세 각도를 계산 중입니다."};
    const options={signal:current.signal,onState:(state:keyof typeof labels)=>{status.textContent=labels[state];},
      onProgress:(processed:number,total:number)=>{progress.value=processed/total;status.textContent=`관절 추적 ${processed}/${total}`;}};
    const analyzed=await analyzeVideo(file,facing==="auto"?options:{...options,facing:Number(facing) as -1|1});
    if(current.signal.aborted)return;
    result=analyzed;checkWindow.engineResult=analyzed;
    renderSummary();
    timeline.max=String(Math.max(0,analyzed.frames.length-1));timeline.value="0";timeline.disabled=false;video.currentTime=0;renderFrame(0);
  }catch(error){status.textContent=current.signal.aborted?"분석을 취소했습니다.":error instanceof Error?error.message:String(error);}
  finally{if(abort===current){run.disabled=!fileInput.files?.length;cancel.disabled=true;fileInput.disabled=false;facingInput.disabled=false;abort=undefined;}}
});
cancel.addEventListener("click",()=>abort?.abort());
timeline.addEventListener("input",()=>{video.pause();const index=Number(timeline.value);if(result?.frames[index])video.currentTime=result.frames[index]!.timeSec;renderFrame(index);});
video.addEventListener("seeked",nearestFrame);
video.addEventListener("timeupdate",nearestFrame);
window.addEventListener("pagehide",()=>{abort?.abort();if(previewUrl)URL.revokeObjectURL(previewUrl);});
// Re-evaluate side/direction from existing raw poses without running the model again.
facingInput.addEventListener("change",()=>{
  if(!result||abort)return;
  const facing=facingInput.value;
  const frames:PoseFrame[]=result.frames.map(frame=>({timeSec:frame.timeSec,landmarks:frame.landmarks,personCount:frame.personCount}));
  const analysis=analyzePoses(frames,result.size,facing==="auto"?{policy:result.policy}:{policy:result.policy,facing:Number(facing) as -1|1});
  result={...analysis,durationSec:result.durationSec,runtime:result.runtime};checkWindow.engineResult=result;renderSummary();nearestFrame();
});
