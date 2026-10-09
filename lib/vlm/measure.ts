import { ANGLE_JOINTS, calculateAngle, length, pixel, type JointPoints } from "../angles/geometry.ts";
import { jointsOf } from "../angles/frame.ts";
import { MEASUREMENT_DEFINITIONS, PARTS } from "../angles/definitions.ts";
import type { PostureScene } from "../reba/types.ts";
import type { Measurement, QualityReason, SideMeasurements } from "../types.ts";
import { VLM_JOINTS, type VlmEvidence } from "./contract.ts";
import { parseCapture, parsePoints } from "./validation.ts";

export function sceneFromVlm(evidence: VlmEvidence): PostureScene {
  const capture=parseCapture(evidence.capture),points=parsePoints(evidence.reviewedPoints);
  parsePoints(evidence.originalPoints);
  if(evidence.confirmedBy!=="human")throw new TypeError("관절의 사람 확인이 필요합니다.");
  const named:JointPoints={...points,index:points.index_mcp};
  const ids=jointsOf(capture.scene.side);
  const measurements=Object.fromEntries(PARTS.map(part=>{
    const reasons:QualityReason[]=ANGLE_JOINTS[part].some(name=>named[name]===null)?["missing_joint"]:[];
    if(ANGLE_JOINTS[part].some(name=>{const p=named[name];return p!==null&&(p.x<0.02||p.x>0.98||p.y<0.02||p.y>0.98);}))reasons.push("out_of_frame");
    let value=reasons.length?null:calculateAngle(part,named,capture.imageSize,capture.facing);
    if(value===null&&!reasons.length)reasons.push("invalid_geometry");
    if(value!==null&&!Number.isFinite(value)){value=null;reasons.push("invalid_geometry");}
    const m:Measurement={value:Object.is(value,-0)?0:value,status:value===null?"unavailable":"measured",reasons,
      joints:ANGLE_JOINTS[part].map(name=>ids[name]),minVisibility:null,approximate:MEASUREMENT_DEFINITIONS[part].approximate};
    return [part,m];
  })) as SideMeasurements;
  const noPoints=VLM_JOINTS.every(name=>points[name]===null);
  const tooFar=points.shoulder!==null&&points.hip!==null&&length(pixel(points.shoulder,capture.imageSize),pixel(points.hip,capture.imageSize))/Math.max(capture.imageSize.width,capture.imageSize.height)<0.07;
  return {key:capture.scene,measurements,measurementSource:"vlm",evidence:structuredClone(evidence),
    availability:noPoints||tooFar?{state:"unavailable",source:"human",reasons:[noPoints?"보이는 관절이 없습니다. 다른 장면을 선택하십시오.":"사람이 너무 작게 찍혔습니다. 더 가까운 장면을 선택하십시오."]}:{state:"ready",source:"human",reasons:[]}};
}
