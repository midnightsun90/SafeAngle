import type { Analysis, AnalysisOptions, FrameSize, PartName, PoseFrame, QualityReason, Side, TrackedFrame } from "./types.ts";
import { resolvePolicy } from "./config.ts";
import { chooseView, jointStatus, measureFrame, validateSize } from "./angles/frame.ts";
import { PARTS } from "./angles/definitions.ts";
import { LANDMARKS } from "./pose/landmarks.ts";
import { inspectContinuity } from "./pose/continuity.ts";
import { integerInRange, numberInRange } from "./validation.ts";
export function analyzePoses(frames: readonly PoseFrame[], size: FrameSize, options: AnalysisOptions = {}): Analysis {
  if (!Array.isArray(frames)) throw new TypeError("frames: 배열이 필요합니다.");
  validateSize(size);
  const policy = resolvePolicy(options.policy);
  let previous = -1;
  for (const frame of frames) {
    if (!frame || !Array.isArray(frame.landmarks)) throw new TypeError("landmarks: 좌표 배열이 필요합니다.");
    numberInRange(frame.timeSec, 0, Number.MAX_SAFE_INTEGER, "timeSec");
    if (frame.timeSec <= previous) throw new RangeError("timeSec: 장면 시각은 중복 없이 증가해야 합니다.");
    if (frame.personCount !== undefined) integerInRange(frame.personCount, 0, 100, "personCount");
    previous = frame.timeSec;
  }
  const view = chooseView(frames, options, policy.minVisibility);
  const continuity = inspectContinuity(frames,size,policy);
  const reasonCounts: Analysis["reasonCounts"] = {};
  const tracked: TrackedFrame[] = frames.map((frame: PoseFrame,index:number) => {
    const measured = measureFrame(frame, size, view.side, view.facing, policy);
    const track=continuity[index]!;
    if(track.requiresReview){
      measured.angles=null;measured.usable=false;measured.wristReliable=false;measured.status="unusable";measured.reasons.push("tracking_uncertain");
      for(const side of ["left","right"] as const)for(const part of PARTS){
        measured.measurements[side][part]={...measured.measurements[side][part],value:null,status:"unavailable",reasons:[...measured.measurements[side][part].reasons,"tracking_uncertain"]};
      }
    }
    const joints=LANDMARKS.map(meta=>{
      const point=frame.landmarks[meta.index],status=jointStatus(point,policy);
      const reasons:QualityReason[]=status==="missing"?["missing_joint"]:status==="invalid"?["invalid_landmarks"]:status==="occluded"?["occluded"]:status==="out_of_frame"?["out_of_frame"]:[];
      return {...meta,point:point?{...point}:null,status,reasons,trackingWarnings:track.jointWarnings.get(meta.index)??[]};
    });
    for (const reason of measured.reasons) reasonCounts[reason] = (reasonCounts[reason] ?? 0) + 1;
    return { ...measured, landmarks: frame.landmarks.map(point => ({ ...point })),jointStatus:joints.map(joint=>joint.status),joints,
      trackSegment:track.segment,trackingWarnings:track.warnings,requiresReview:track.requiresReview };
  });
  const usableCount = tracked.filter(frame => frame.usable).length;
  const measurableCount=tracked.filter(frame=>frame.status!=="unusable").length;
  const usableRatio = tracked.length ? usableCount / tracked.length : 0;
  const coverage=(side:Side)=>Object.fromEntries(PARTS.map(part=>[part,tracked.length?tracked.filter(frame=>frame.measurements[side][part].value!==null).length/tracked.length:0])) as Record<PartName,number>;
  const gaps=frames.slice(1).map((frame,index)=>frame.timeSec-frames[index]!.timeSec).sort((a,b)=>a-b);
  const interval=gaps.length?gaps[Math.floor(gaps.length/2)]!:policy.sampleIntervalSec;
  return { ...view,size:{...size},status:usableCount>0&&usableRatio>=policy.minUsableRatio?"ready":measurableCount?"partial":"retake",
    usableRatio,measuredFrameRatio:tracked.length?measurableCount/tracked.length:0,measurementCoverage:{left:coverage("left"),right:coverage("right")},
    durationSec:frames.length?frames[frames.length-1]!.timeSec+interval:0,sampleIntervalSec:interval,reasonCounts,frames:tracked,policy };
}
