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
  | "out_of_frame" | "not_side_view" | "too_far" | "invalid_geometry" | "unknown_direction" | "missing_joint" | "tracking_uncertain";
export type JointStatus = "reliable" | "occluded" | "out_of_frame" | "invalid" | "missing";
export type TrackingWarning = "tracking_gap" | "position_jump" | "segment_length_change" | "subject_change_suspected";
export type PartName = keyof Angles;
export interface Measurement {
  value: number | null;
  status: "measured" | "unavailable";
  reasons: QualityReason[];
  joints: number[];
  minVisibility: number | null;
  approximate: boolean;
}
export type SideMeasurements = Record<PartName, Measurement>;
export interface JointDetail {
  index: number; name: string; label: string; side: Side | "center";
  point: Landmark | null; status: JointStatus; reasons: QualityReason[];
  trackingWarnings: TrackingWarning[];
}
export interface MeasuredFrame {
  timeSec: number; usable: boolean; reasons: QualityReason[];
  angles: Angles | null; wristReliable: boolean;
  status: "complete" | "partial" | "unusable";
  measurements: Record<Side, SideMeasurements>;
  personCount: number;
}
export interface TrackedFrame extends MeasuredFrame {
  landmarks: readonly Landmark[];
  jointStatus: JointStatus[];
  joints: JointDetail[];
  trackSegment: number;
  trackingWarnings: TrackingWarning[];
  requiresReview: boolean;
}
export interface Analysis {
  status: "ready" | "partial" | "retake"; size: FrameSize; side: Side; facing: Facing | null;
  usableRatio: number; reasonCounts: Partial<Record<QualityReason, number>>;
  frames: TrackedFrame[]; policy: EnginePolicy;
  measuredFrameRatio: number;
  measurementCoverage: Record<Side, Record<PartName, number>>;
  durationSec: number;
  sampleIntervalSec: number;
}
export interface EnginePolicy {
  neckNeutralOffsetDeg: number; minVisibility: number; frameMargin: number;
  maxHipToTrunkRatio: number; minTrunkToLongSideRatio: number; minUsableRatio: number;
  sampleIntervalSec: number;
  maxJointSpeedTrunksPerSec: number;
  maxSegmentLengthChangeRatio: number;
  maxSubjectShiftTrunks: number;
  maxTrackingGapSec: number;
}
export interface AnalysisOptions { side?: Side; facing?: Facing; policy?: Partial<EnginePolicy> }
