export type Side = "left" | "right";
export type Facing = -1 | 1;
export interface FrameSize { width: number; height: number }
export interface Landmark { x: number; y: number; visibility: number; z?: number }
export interface PoseFrame { timeSec: number; landmarks: readonly Landmark[]; personCount?: number }
export interface Angles {
  trunk: number; neck: number; knee: number;
  upperArm: number; lowerArm: number; wrist: number | null;
}
export type QualityReason = "no_person" | "multiple_people" | "invalid_landmarks" | "occluded"
  | "out_of_frame" | "not_side_view" | "too_far" | "invalid_geometry" | "unknown_direction";
export type JointStatus = "reliable" | "occluded" | "out_of_frame" | "invalid";
export interface MeasuredFrame {
  timeSec: number; usable: boolean; reasons: QualityReason[];
  angles: Angles | null; wristReliable: boolean;
}
export interface TrackedFrame extends MeasuredFrame {
  landmarks: readonly Landmark[];
  jointStatus: JointStatus[];
}
export interface Analysis {
  status: "ready" | "retake"; size: FrameSize; side: Side; facing: Facing | null;
  usableRatio: number; reasonCounts: Partial<Record<QualityReason, number>>;
  frames: TrackedFrame[]; policy: EnginePolicy;
}
export interface EnginePolicy {
  neckNeutralOffsetDeg: number; minVisibility: number; frameMargin: number;
  maxHipToTrunkRatio: number; minTrunkToLongSideRatio: number; minUsableRatio: number;
  sampleIntervalSec: number;
}
export interface AnalysisOptions { side?: Side; facing?: Facing; policy?: Partial<EnginePolicy> }
