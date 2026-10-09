import type { EnginePolicy, FrameSize, PoseFrame, TrackingWarning } from "../types.ts";
import { jointStatus, jointsOf } from "../angles/frame.ts";

export interface Continuity { segment:number; warnings:TrackingWarning[]; jointWarnings:Map<number,TrackingWarning[]>; requiresReview:boolean }
const segments = [[11,13],[13,15],[12,14],[14,16],[11,23],[12,24],[23,25],[25,27],[24,26],[26,28]] as const;

export function inspectContinuity(frames:readonly PoseFrame[], size:FrameSize, policy:EnginePolicy): Continuity[] {
  let previous:PoseFrame|undefined, hadTrack=false, segment=0, interrupted=false, identityUncertain=false;
  const reliable=(frame:PoseFrame,index:number)=>jointStatus(frame.landmarks[index],policy)==="reliable";
  const distance=(frame:PoseFrame,a:number,b:number)=>Math.hypot((frame.landmarks[a]!.x-frame.landmarks[b]!.x)*size.width,(frame.landmarks[a]!.y-frame.landmarks[b]!.y)*size.height);
  const trunkSize=(frame:PoseFrame)=>Math.max(0,...(["left","right"] as const).flatMap(side=>{
    const j=jointsOf(side);return reliable(frame,j.shoulder)&&reliable(frame,j.hip)?[distance(frame,j.shoulder,j.hip)]:[];
  }));
  return frames.map(frame=>{
    const warnings:TrackingWarning[]=[], jointWarnings=new Map<number,TrackingWarning[]>();
    const add=(reason:TrackingWarning,indices:readonly number[]=[])=>{
      if(!warnings.includes(reason))warnings.push(reason);
      for(const index of indices){const entries=jointWarnings.get(index)??[];if(!entries.includes(reason))entries.push(reason);jointWarnings.set(index,entries);}
    };
    const single=(frame.personCount??(frame.landmarks.length?1:0))===1&&frame.landmarks.length===33;
    if(!single){
      if((frame.personCount??0)>1)identityUncertain=true;
      interrupted=hadTrack;previous=undefined;return {segment,warnings,jointWarnings,requiresReview:identityUncertain};
    }
    if(interrupted){segment++;add("tracking_gap");interrupted=false;}
    if(previous){
      const dt=frame.timeSec-previous.timeSec;
      if(dt>policy.maxTrackingGapSec){segment++;add("tracking_gap");}
      else {
        const trunk=trunkSize(previous);
        if(trunk>1e-8){
          for(let index=0;index<33;index++)if(reliable(frame,index)&&reliable(previous,index)){
            const moved=Math.hypot((frame.landmarks[index]!.x-previous.landmarks[index]!.x)*size.width,(frame.landmarks[index]!.y-previous.landmarks[index]!.y)*size.height);
            if(moved/(dt*trunk)>policy.maxJointSpeedTrunksPerSec)add("position_jump",[index]);
          }
          for(const[a,b]of segments)if(reliable(frame,a)&&reliable(frame,b)&&reliable(previous,a)&&reliable(previous,b)){
            const old=distance(previous,a,b);
            if(old>trunk*0.05&&Math.abs(distance(frame,a,b)-old)/old>policy.maxSegmentLengthChangeRatio)add("segment_length_change",[a,b]);
          }
          const anchors=[23,24].filter(index=>reliable(frame,index)&&reliable(previous!,index));
          if(anchors.length){
            const shift=Math.hypot(anchors.reduce((sum,index)=>sum+(frame.landmarks[index]!.x-previous!.landmarks[index]!.x)*size.width,0)/anchors.length,
              anchors.reduce((sum,index)=>sum+(frame.landmarks[index]!.y-previous!.landmarks[index]!.y)*size.height,0)/anchors.length);
            if(shift/trunk>policy.maxSubjectShiftTrunks){segment++;identityUncertain=true;add("subject_change_suspected",anchors);}
          }
        }
      }
    }
    previous=frame;hadTrack=true;
    if(identityUncertain)add("subject_change_suspected");
    return {segment,warnings,jointWarnings,requiresReview:identityUncertain};
  });
}
