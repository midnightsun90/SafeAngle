import type { FrameSize, TrackedFrame } from "../types.ts";
import { validateSize } from "../angles/frame.ts";
import { POSE_CONNECTIONS } from "./landmarks.ts";

export function videoTransform(source:FrameSize,target:FrameSize,fit:"contain"|"cover"="contain") {
  validateSize(source);validateSize(target);
  if(fit!=="contain"&&fit!=="cover")throw new TypeError("fit: contain 또는 cover가 필요합니다.");
  const scale=(fit==="contain"?Math.min:Math.max)(target.width/source.width,target.height/source.height);
  return {width:source.width*scale,height:source.height*scale,offsetX:(target.width-source.width*scale)/2,offsetY:(target.height-source.height*scale)/2};
}

export function drawPose(canvas:HTMLCanvasElement,frame:TrackedFrame,size:FrameSize,options:{mirrored?:boolean;fit?:"contain"|"cover"}={}) {
  const context=canvas.getContext("2d");if(!context)throw new Error("뼈대를 그릴 Canvas를 준비하지 못했습니다.");
  const area=videoTransform(size,{width:canvas.width,height:canvas.height},options.fit);
  const xy=(index:number)=>{const p=frame.landmarks[index]!;return {x:area.offsetX+(options.mirrored?1-p.x:p.x)*area.width,y:area.offsetY+p.y*area.height};};
  const drawable=(index:number)=>{const p=frame.landmarks[index];return !!p&&Number.isFinite(p.x)&&Number.isFinite(p.y)&&p.x>=0&&p.x<=1&&p.y>=0&&p.y<=1;};
  const certain=(index:number)=>frame.jointStatus[index]==="reliable"&&!frame.requiresReview&&!frame.joints[index]!.trackingWarnings.length;
  context.clearRect(0,0,canvas.width,canvas.height);
  context.lineWidth=Math.max(2,area.width/200);
  for(const[a,b]of POSE_CONNECTIONS){
    if(!drawable(a)||!drawable(b)||frame.jointStatus[a]!=="reliable"||frame.jointStatus[b]!=="reliable")continue;
    const reliable=certain(a)&&certain(b),from=xy(a),to=xy(b);
    context.strokeStyle=reliable?"#30f2a2":"#ffba52";context.setLineDash(reliable?[]:[5,4]);
    context.beginPath();context.moveTo(from.x,from.y);context.lineTo(to.x,to.y);context.stroke();
  }
  context.setLineDash([]);
  frame.landmarks.forEach((_,index)=>{
    if(!drawable(index))return;
    const p=xy(index),reliable=certain(index),radius=Math.max(3,area.width/120);
    context.beginPath();context.arc(p.x,p.y,radius,0,Math.PI*2);
    if(reliable){context.fillStyle="#30f2a2";context.fill();}
    else{context.strokeStyle="#ffba52";context.stroke();}
  });
}
