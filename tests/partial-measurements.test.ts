import assert from "node:assert/strict";
import test from "node:test";
import { analyzePoses, LANDMARKS, measureFrame } from "../lib/engine.ts";
import { changePoint, pose } from "./fixtures.ts";
const SIZE={width:1000,height:1000};
function bilateral(){
  let frame=pose();
  for(const[a,b]of [[7,8],[11,12],[13,14],[15,16],[19,20],[23,24],[25,26],[27,28],[29,30],[31,32]])
    frame=changePoint(frame,b!,{...frame.landmarks[a!]!,x:frame.landmarks[a!]!.x+0.02});
  return frame;
}
test("both sides retain independent elbow and knee measurements",()=>{
  const frame=changePoint(bilateral(),16,{x:0.52,y:0.45});
  const measured=measureFrame(frame,SIZE,"left",1);
  assert.equal(measured.measurements.left.lowerArm.value,90);
  assert.equal(measured.measurements.right.lowerArm.value,0);
  assert.equal(measured.measurements.right.knee.value,0);
  assert.equal(measured.measurements.left.lowerArm.minVisibility,1);
  assert.deepEqual(measured.measurements.right.lowerArm.joints,[12,14,16]);
});
test("missing ear affects neck only, wrist occlusion leaves knee and trunk intact",()=>{
  const ear=measureFrame(changePoint(bilateral(),7,{visibility:0.1}),SIZE,"left",1);
  assert.equal(ear.measurements.left.neck.value,null);
  assert.equal(ear.measurements.left.trunk.value,0);
  assert.equal(ear.measurements.left.lowerArm.value,90);
  assert.equal(ear.measurements.right.neck.value,0);
  const wrist=measureFrame(changePoint(bilateral(),15,{visibility:0.1}),SIZE,"left",1);
  assert.equal(wrist.measurements.left.lowerArm.value,null);
  assert.equal(wrist.measurements.left.wrist.value,null);
  assert.equal(wrist.measurements.left.upperArm.value,0);
  assert.equal(wrist.measurements.left.knee.value,0);
});
test("invalid individual coordinates do not destroy independent measurements",()=>{
  const result=measureFrame(changePoint(bilateral(),7,{x:NaN}),SIZE,"left",1);
  assert.deepEqual(result.measurements.left.neck.reasons,["invalid_landmarks"]);
  assert.equal(result.measurements.left.knee.value,0);
  assert.equal(result.measurements.right.neck.value,0);
  const invalidDepth=measureFrame(changePoint(bilateral(),7,{z:NaN}),SIZE,"left",1);
  assert.equal(invalidDepth.measurements.left.neck.value,null);
  assert.equal(invalidDepth.measurements.left.knee.value,0);
});
test("unknown direction leaves unsigned joint angles available",()=>{
  const result=measureFrame(bilateral(),SIZE,"left",null);
  assert.equal(result.measurements.left.trunk.value,null);
  assert.deepEqual(result.measurements.left.trunk.reasons,["unknown_direction"]);
  assert.equal(result.measurements.left.lowerArm.value,90);
  assert.equal(result.measurements.left.knee.value,0);
});
test("each empty frame contains metadata for all 33 joints and no invented positions",()=>{
  const result=analyzePoses([{timeSec:0,landmarks:[]}],SIZE);
  const frame=result.frames[0]!;
  assert.equal(frame.joints.length,33);
  assert.equal(LANDMARKS.length,33);
  assert.ok(frame.joints.every(joint=>joint.point===null&&joint.status==="missing"));
  assert.equal(frame.joints[11]!.name,"left_shoulder");
  assert.equal(frame.joints[12]!.side,"right");
  assert.equal(result.measurementCoverage.left.knee,0);
});
test("occlusion is not interpolated, reacquisition starts a new track segment",()=>{
  const a=bilateral();
  const result=analyzePoses([a,{timeSec:0.1,landmarks:[],personCount:0},{...a,timeSec:0.2}],SIZE);
  assert.equal(result.frames[1]!.measurements.left.knee.value,null);
  assert.deepEqual(result.frames[2]!.trackingWarnings,["tracking_gap"]);
  assert.equal(result.frames[2]!.trackSegment,1);
  assert.equal(result.measurementCoverage.left.knee,2/3);
});
test("position jumps are warnings with original data preserved",()=>{
  const original=bilateral();
  const moved=changePoint({...original,timeSec:0.1},15,{x:0.85});
  const result=analyzePoses([original,moved],SIZE,{policy:{maxJointSpeedTrunksPerSec:1}});
  const frame=result.frames[1]!;
  assert.ok(frame.trackingWarnings.includes("position_jump"));
  assert.ok(frame.joints[15]!.trackingWarnings.includes("position_jump"));
  assert.equal(frame.landmarks[15]!.x,0.85);
  assert.equal(frame.requiresReview,false);
});
test("suspected subject jumps are not exposed as normal measurements",()=>{
  const original=bilateral();
  const moved={...original,timeSec:0.1,landmarks:original.landmarks.map(point=>({...point,x:point.x+0.15}))};
  const frame=analyzePoses([original,moved],SIZE,{policy:{maxSubjectShiftTrunks:0.5}}).frames[1]!;
  assert.equal(frame.requiresReview,true);
  assert.equal(frame.status,"unusable");
  assert.equal(frame.angles,null);
  assert.ok(Object.values(frame.measurements.left).every(part=>part.value===null&&part.reasons.includes("tracking_uncertain")));
});
test("far-side low visibility cannot overwrite measured near-side wrist or leg",()=>{
  const frame=measureFrame(pose(),SIZE,"left",1);
  assert.equal(frame.measurements.left.knee.value,0);
  assert.equal(frame.measurements.right.knee.value,null);
  assert.equal(frame.measurements.left.wrist.value,0);
  assert.equal(frame.measurements.right.wrist.value,null);
});
test("identity uncertainty after multiple people or a subject jump cannot silently clear",()=>{
  const original=bilateral();
  const result=analyzePoses([original,{timeSec:0.1,landmarks:[],personCount:2},{...original,timeSec:0.2}],SIZE);
  assert.equal(result.frames[2]!.requiresReview,true);
  assert.equal(result.frames[2]!.measurements.left.knee.value,null);
  const moved={...original,timeSec:0.1,landmarks:original.landmarks.map(point=>({...point,x:point.x+0.15}))};
  const jumped=analyzePoses([original,moved,{...moved,timeSec:0.2}],SIZE,{policy:{maxSubjectShiftTrunks:0.5}});
  assert.equal(jumped.frames[2]!.requiresReview,true);
  assert.ok(jumped.frames[2]!.trackingWarnings.includes("subject_change_suspected"));
});
