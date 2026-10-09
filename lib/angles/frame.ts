import type { Angles, EnginePolicy, Facing, FrameSize, JointStatus, Landmark, MeasuredFrame, PoseFrame, Side } from "../types.ts";
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

export function jointStatus(point: Landmark, policy: EnginePolicy): JointStatus {
  if (!point || !Number.isFinite(point.x) || !Number.isFinite(point.y)
    || !Number.isFinite(point.visibility) || point.visibility < 0 || point.visibility > 1) return "invalid";
  if (point.x < policy.frameMargin || point.x > 1 - policy.frameMargin
    || point.y < policy.frameMargin || point.y > 1 - policy.frameMargin) return "out_of_frame";
  return point.visibility < policy.minVisibility ? "occluded" : "reliable";
}

function validLandmarks(points: readonly Landmark[]): boolean {
  return Array.isArray(points) && points.length === 33 && points.every(point => point
    && Number.isFinite(point.x) && Number.isFinite(point.y)
    && Number.isFinite(point.visibility) && point.visibility >= 0 && point.visibility <= 1);
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
        .reduce((sum, index) => sum + landmarks[index]!.visibility, 0);
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
    if (toe.visibility < minVisibility || heel.visibility < minVisibility || Math.abs(toe.x - heel.x) < 0.005) continue;
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
  const j = jointsOf(side);
  if (facing !== null && facing !== 1 && facing !== -1) throw new TypeError("facing: 올바르지 않은 방향입니다.");
  const result: MeasuredFrame = { timeSec: frame.timeSec, usable: false, reasons: [], angles: null, wristReliable: false };
  const points = frame.landmarks;
  if (frame.personCount === 0) { result.reasons.push("no_person"); return result; }
  if (frame.personCount !== undefined && frame.personCount > 1) { result.reasons.push("multiple_people"); return result; }
  if (Array.isArray(points) && points.length === 0) { result.reasons.push("no_person"); return result; }
  if (!validLandmarks(points)) { result.reasons.push("invalid_landmarks"); return result; }
  const required = [j.ear, j.shoulder, j.elbow, j.wrist, j.hip, j.knee, j.ankle];
  if (required.some(index => points[index]!.visibility < policy.minVisibility)) result.reasons.push("occluded");
  const inside = (index: number) => {
    const point = points[index]!;
    return point.x >= policy.frameMargin && point.x <= 1 - policy.frameMargin
      && point.y >= policy.frameMargin && point.y <= 1 - policy.frameMargin;
  };
  if (required.some(index => !inside(index))) result.reasons.push("out_of_frame");
  const p = (index: number) => pixel(points[index]!, size);
  const shoulder = p(j.shoulder), hip = p(j.hip), elbow = p(j.elbow), wrist = p(j.wrist);
  const trunkLength = length(shoulder, hip);
  if (trunkLength < 1e-8 || length(p(j.ear), shoulder) < 1e-8 || length(shoulder, elbow) < 1e-8) {
    result.reasons.push("invalid_geometry");
  } else {
    if (points[23]!.visibility >= policy.minVisibility && points[24]!.visibility >= policy.minVisibility
      && length(p(23), p(24)) / trunkLength > policy.maxHipToTrunkRatio) result.reasons.push("not_side_view");
    if (trunkLength / Math.max(size.width, size.height) < policy.minTrunkToLongSideRatio) result.reasons.push("too_far");
  }
  if (facing === null) result.reasons.push("unknown_direction");
  if (result.reasons.length || facing === null) return result;

  const radiansToDegrees = 180 / Math.PI;
  const trunk = Math.atan2(facing * (shoulder.x - hip.x), -(shoulder.y - hip.y)) * radiansToDegrees;
  const ear = p(j.ear);
  const neck = wrap(Math.atan2(facing * (ear.x - shoulder.x), -(ear.y - shoulder.y)) * radiansToDegrees
    - trunk - policy.neckNeutralOffsetDeg, -180);
  const upperArm = wrap(Math.atan2(facing * (elbow.x - shoulder.x), elbow.y - shoulder.y) * radiansToDegrees + trunk, -90);
  const knee = flexion(hip, p(j.knee), p(j.ankle));
  const lowerArm = flexion(shoulder, elbow, wrist);
  if (knee === null || lowerArm === null) { result.reasons.push("invalid_geometry"); return result; }
  const wristAngle = points[j.index]!.visibility >= policy.minVisibility && inside(j.index)
    ? flexion(elbow, wrist, p(j.index)) : null;
  const angles: Angles = { trunk: trunk === 0 ? 0 : trunk, neck, knee, upperArm, lowerArm, wrist: wristAngle };
  return { ...result, usable: true, angles, wristReliable: wristAngle !== null };
}
