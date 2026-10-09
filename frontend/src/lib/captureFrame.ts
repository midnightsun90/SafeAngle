import type { FrameSize } from "../../../lib/types.ts";

export async function captureFrame(video:HTMLVideoElement,timeSec:number,signal:AbortSignal):Promise<{imageDataUrl:string;imageSize:FrameSize;timeSec:number}>{
  if(!Number.isFinite(video.duration)||video.duration<=0||video.duration>60||!Number.isFinite(timeSec)||timeSec<0||timeSec>video.duration)throw new Error("60초 이내의 영상과 올바른 장면을 선택하십시오.");
  const target=Math.min(timeSec,Math.max(0,video.duration-0.001));
  if(Math.abs(video.currentTime-target)>0.0001){
    const wait=waitEvent(video,"seeked",signal);video.pause();video.currentTime=target;await wait;
  }else if(video.seeking)await waitEvent(video,"seeked",signal);
  if(video.readyState<2)await waitEvent(video,"loadeddata",signal);
  signal.throwIfAborted();
  const scale=Math.min(1,1000/Math.max(video.videoWidth,video.videoHeight));
  const width=Math.max(1,Math.round(video.videoWidth*scale)),height=Math.max(1,Math.round(video.videoHeight*scale));
  const canvas=document.createElement("canvas");canvas.width=width;canvas.height=height;
  const ctx=canvas.getContext("2d");if(!ctx)throw new Error("장면을 추출할 수 없습니다.");
  ctx.drawImage(video,0,0,width,height);
  const imageDataUrl=canvas.toDataURL("image/jpeg",0.9);
  if(imageDataUrl.length>1400000)throw new Error("대표 장면이 너무 큽니다. 해상도가 낮은 영상을 선택하십시오.");
  return {imageDataUrl,imageSize:{width,height},timeSec:video.currentTime};
}
function waitEvent(video:HTMLVideoElement,name:string,signal:AbortSignal):Promise<void>{
  return new Promise((resolve,reject)=>{
    const finish=(error?:Error)=>{clearTimeout(timer);video.removeEventListener(name,ok);video.removeEventListener("error",fail);signal.removeEventListener("abort",cancel);if(error)reject(error);else resolve();};
    const ok=()=>finish(),fail=()=>finish(new Error("영상을 읽을 수 없습니다.")),cancel=()=>finish(new DOMException("취소되었습니다.","AbortError"));
    const timer=setTimeout(()=>finish(new Error("영상 장면을 불러오는 시간이 초과됐습니다.")),5000);
    video.addEventListener(name,ok,{once:true});video.addEventListener("error",fail,{once:true});signal.addEventListener("abort",cancel,{once:true});if(signal.aborted)cancel();
  });
}
