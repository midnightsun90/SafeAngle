import type { Angles, EnginePolicy, Facing, FrameSize, JointStatus, Landmark, MeasuredFrame, Measurement, PartName, PoseFrame, QualityReason, Side, SideMeasurements } from "../types.ts";
import { MEASUREMENT_DEFINITIONS, PARTS } from "./definitions.ts";
import { resolvePolicy } from "../config.ts";
import { integerInRange, numberInRange } from "../validation.ts";

export function jointsOf(side: Side) {
  if (side !== "left" && side !== "right") throw new TypeError("side: left 또는 right가 필요합니다.");
  const offset = side === "left" ? 0 : 1;
  return { ear: 7 + offset, shoulder: 11 + offset, elbow: 13 + offset, wrist: 15 + offset,
    index: 19 + offset, hip: 23 + offset, knee: 25 + offset, ankle: 27 + offset,
    heel: 29 + offset, toe: 31 + offset };
}

export function validateSize(size: FrameSize): void {
  numberInRange(size.width, 1, 100_000, "width");
  numberInRange(size.height, 1, 100_000, "height");
}

export function jointStatus(point: Landmark | undefined, policy: EnginePolicy): JointStatus {
  if (!point) return "missing";
  if (!Number.isFinite(point.x) || !Number.isFinite(point.y)
    || (point.z !== undefined && !Number.isFinite(point.z))
    || !Number.isFinite(point.visibility) || point.visibility < 0 || point.visibility > 1) return "invalid";
  if (point.x < policy.frameMargin || point.x > 1 - policy.frameMargin
    || point.y < policy.frameMargin || point.y > 1 - policy.frameMargin) return "out_of_frame";
  return point.visibility < policy.minVisibility ? "occluded" : "reliable";
}

function validLandmarks(points: readonly Landmark[]): boolean {
  return Array.isArray(points) && points.length === 33;
}

type Point = { x: number; y: number };
function pixel(point: Landmark, size: FrameSize): Point {
  return { x: point.x * size.width, y: point.y * size.height };
}
function length(a: Point, b: Point): number { return Math.hypot(a.x - b.x, a.y - b.y); }
function flexion(a: Point, center: Point, b: Point): number | null {
  const denominator = length(a, center) * length(b, center);
  if (denominator < 1e-8) return null;
  const cosine = ((a.x - center.x) * (b.x - center.x) + (a.y - center.y) * (b.y - center.y)) / denominator;
  return 180 - Math.acos(Math.max(-1, Math.min(1, cosine))) * 180 / Math.PI;
}
function wrap(degrees: number, lower: number): number {
  const value = ((degrees - lower) % 360 + 360) % 360 + lower;
  return value === lower ? lower + 360 : value;
}

export function chooseView(frames: readonly PoseFrame[], options: { side?: Side; facing?: Facing } = {},
  minVisibility = 0.5): { side: Side; facing: Facing | null } {
  numberInRange(minVisibility, 0.01, 1, "minVisibility");
  if (options.side !== undefined) jointsOf(options.side);
  if (options.facing !== undefined && options.facing !== 1 && options.facing !== -1) {
    throw new TypeError("facing: 1(오른쪽) 또는 -1(왼쪽)이 필요합니다.");
  }
  let leftVotes = 0;
  let rightVotes = 0;
  for (const { landmarks, personCount } of frames) {
    if (personCount !== undefined && personCount !== 1) continue;
    if (!validLandmarks(landmarks)) continue;
    const visibility = (side: Side) => {
      const j = jointsOf(side);
      return [j.ear, j.shoulder, j.elbow, j.wrist, j.hip, j.knee, j.ankle]
        .reduce((sum, index) => {
          const p=landmarks[index];return sum+(p&&Number.isFinite(p.x)&&Number.isFinite(p.y)&&Number.isFinite(p.visibility)&&p.visibility>=0&&p.visibility<=1?p.visibility:0);
        }, 0);
    };
    if (visibility("left") >= visibility("right")) leftVotes++;
    else rightVotes++;
  }
  const side = options.side ?? (rightVotes > leftVotes ? "right" : "left");
  if (options.facing !== undefined) return { side, facing: options.facing };
  const j = jointsOf(side);
  let rightFacingVotes = 0;
  let leftFacingVotes = 0;
  for (const { landmarks, personCount } of frames) {
    if (personCount !== undefined && personCount !== 1) continue;
    if (!validLandmarks(landmarks)) continue;
    const toe = landmarks[j.toe]!;
    const heel = landmarks[j.heel]!;
    const visible=(p:Landmark|undefined)=>!!p&&Number.isFinite(p.x)&&Number.isFinite(p.y)&&p.x>=0&&p.x<=1&&p.y>=0&&p.y<=1&&Number.isFinite(p.visibility)&&p.visibility<=1&&p.visibility>=minVisibility;
    if (!visible(toe) || !visible(heel) || Math.abs(toe.x - heel.x) < 0.005) continue;
    if (toe.x > heel.x) rightFacingVotes++;
    else leftFacingVotes++;
  }
  return { side, facing: rightFacingVotes === leftFacingVotes ? null : rightFacingVotes > leftFacingVotes ? 1 : -1 };
}

export function measureFrame(frame: PoseFrame, size: FrameSize, side: Side, facing: Facing | null,
  overrides: Partial<EnginePolicy> = {}): MeasuredFrame {
  numberInRange(frame.timeSec, 0, Number.MAX_SAFE_INTEGER, "timeSec");
  if (frame.personCount !== undefined) integerInRange(frame.personCount, 0, 100, "personCount");
  validateSize(size);
  const policy = resolvePolicy(overrides);
  jointsOf(side);
  if (facing !== null && facing !== 1 && facing !== -1) throw new TypeError("facing: 올바르지 않은 방향입니다.");
  const points = frame.landmarks;
  const personCount = frame.personCount ?? (points.length ? 1 : 0);
  const global: QualityReason[] = [];
  if (personCount === 0) global.push("no_person");
  else if (personCount > 1) global.push("multiple_people");
  else if (!validLandmarks(points)) global.push("invalid_landmarks");
  const reliable = (index: number) => jointStatus(points[index], policy) === "reliable";
  if (!global.length) {
    const trunkLengths = (["left","right"] as const).flatMap(at => {
      const j = jointsOf(at);
      return reliable(j.shoulder) && reliable(j.hip) ? [length(pixel(points[j.shoulder]!,size),pixel(points[j.hip]!,size))] : [];
    });
    const trunkLength = trunkLengths.length ? Math.max(...trunkLengths) : null;
    if (trunkLength !== null && trunkLength > 1e-8) {
      if (trunkLength / Math.max(size.width,size.height) < policy.minTrunkToLongSideRatio) global.push("too_far");
      if (reliable(23) && reliable(24) && length(pixel(points[23]!,size),pixel(points[24]!,size))/trunkLength > policy.maxHipToTrunkRatio) global.push("not_side_view");
    }
  }
  const measureSide = (at: Side): SideMeasurements => {
    const j = jointsOf(at);
    const p = (index: number) => pixel(points[index]!,size);
    const degrees = 180 / Math.PI;
    const trunk = () => Math.atan2(facing! * (p(j.shoulder).x-p(j.hip).x),-(p(j.shoulder).y-p(j.hip).y))*degrees;
    const specs: Record<PartName,{joints:number[];signed:boolean;calculate:()=>number|null}> = {
      trunk:{joints:[j.hip,j.shoulder],signed:true,calculate:trunk},
      neck:{joints:[j.hip,j.shoulder,j.ear],signed:true,calculate:()=>wrap(Math.atan2(facing!*(p(j.ear).x-p(j.shoulder).x),-(p(j.ear).y-p(j.shoulder).y))*degrees-trunk()-policy.neckNeutralOffsetDeg,-180)},
      upperArm:{joints:[j.hip,j.shoulder,j.elbow],signed:true,calculate:()=>wrap(Math.atan2(facing!*(p(j.elbow).x-p(j.shoulder).x),p(j.elbow).y-p(j.shoulder).y)*degrees+trunk(),-90)},
      lowerArm:{joints:[j.shoulder,j.elbow,j.wrist],signed:false,calculate:()=>flexion(p(j.shoulder),p(j.elbow),p(j.wrist))},
      knee:{joints:[j.hip,j.knee,j.ankle],signed:false,calculate:()=>flexion(p(j.hip),p(j.knee),p(j.ankle))},
      wrist:{joints:[j.elbow,j.wrist,j.index],signed:false,calculate:()=>flexion(p(j.elbow),p(j.wrist),p(j.index))},
    };
    return Object.fromEntries(PARTS.map(part=>{
      const spec=specs[part]; const reasons:QualityReason[]=[...global];
      if (!global.length) {
        for (const index of spec.joints) {
          const status=jointStatus(points[index],policy);
          const reason = status === "missing" ? "missing_joint" : status === "invalid" ? "invalid_landmarks"
            : status === "occluded" ? "occluded" : status === "out_of_frame" ? "out_of_frame" : null;
          if(reason&&!reasons.includes(reason))reasons.push(reason);
        }
        if(spec.signed&&facing===null)reasons.push("unknown_direction");
        if(!reasons.length && spec.joints.slice(1).some((index,i)=>length(p(spec.joints[i]!),p(index))<1e-8))reasons.push("invalid_geometry");
      }
      let value = reasons.length ? null : spec.calculate();
      if(value===null&&!reasons.length)reasons.push("invalid_geometry");
      if(value!==null&&!Number.isFinite(value)){value=null;reasons.push("invalid_geometry");}
      if(Object.is(value,-0))value=0;
      const confidences=spec.joints.map(index=>points[index]?.visibility).filter((v):v is number=>typeof v==="number"&&Number.isFinite(v)&&v>=0&&v<=1);
      const measurement:Measurement={value,status:value===null?"unavailable":"measured",reasons,joints:spec.joints,
        minVisibility:confidences.length===spec.joints.length?Math.min(...confidences):null,approximate:MEASUREMENT_DEFINITIONS[part].approximate};
      return [part,measurement];
    })) as SideMeasurements;
  };
  const measurements={left:measureSide("left"),right:measureSide("right")};
  const selected=measurements[side];
  const compatible=PARTS.filter(part=>part!=="wrist").every(part=>selected[part].value!==null);
  const angles=compatible?Object.fromEntries(PARTS.map(part=>[part,selected[part].value])) as unknown as Angles:null;
  const all=[...Object.values(measurements.left),...Object.values(measurements.right)];
  const measuredCount=all.filter(value=>value.value!==null).length;
  return {timeSec:frame.timeSec,usable:compatible,reasons:[...new Set(all.flatMap(value=>value.reasons))],
    angles,wristReliable:selected.wrist.value!==null,status:measuredCount===all.length?"complete":measuredCount?"partial":"unusable",measurements,personCount};
}
