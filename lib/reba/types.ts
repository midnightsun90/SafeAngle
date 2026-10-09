import type { Measurement, PartName, Side, SideMeasurements, TrackedFrame } from "../types.ts";
import type { VlmEvidence } from "../vlm/contract.ts";

export interface SceneKey { videoId: string; frameIndex: number; timeSec: number; side: Side }
export interface RebaScene { key: SceneKey; frame: TrackedFrame }
export interface PostureScene {
  key: SceneKey;
  measurements: SideMeasurements | null;
  measurementSource: "video" | "vlm";
  evidence?: VlmEvidence;
  availability:
    | { state: "ready"; source: "pose" | "human"; reasons: readonly [] }
    | { state: "pending" | "unavailable"; source: "pose" | "human"; reasons: readonly string[] };
}
export type Confirmation<T> =
  | { state: "unknown" | "unavailable"; value: null; source: "human"; observable: false }
  | { state: "confirmed"; value: T; source: "human"; observable: boolean }
  | { state: "not_applicable"; value: null; source: "human"; observable: false };
export interface AnswerValues {
  neckBase: number; trunkUpright: boolean; trunkBase: number; kneeExtra: number;
  upperArmBase: number; lowerArmBase: number; wristBase: number;
  neckTwist: boolean; neckSideBend: boolean; trunkTwist: boolean; trunkSideBend: boolean;
  legs: "bilateral" | "walking" | "sitting" | "unilateral"; unstable: boolean;
  armAbducted: boolean; shoulderRaised: boolean; armSupported: boolean;
  wristDeviated: boolean; wristTwisted: boolean;
  loadKg: number; shock: boolean; coupling: "good" | "fair" | "poor" | "unacceptable";
  staticMinutes: number; repeatsPerMinute: number; repetitionIsWalking: boolean; rapidChange: boolean;
}
export type AnswerName = keyof AnswerValues;
export type RebaFields = { [K in AnswerName]: Confirmation<AnswerValues[K]> };
export interface RebaAnswers { scene: SceneKey; fields: RebaFields }
export interface PartEvidence {
  measurement: Measurement; source: "video" | "vlm" | "human" | null;
  base: number | null; adjustment: number | null; score: number | null;
  evidenceIds: string[]; notes: string[];
}
export interface PendingInput { field: AnswerName | "scene"; state: string; reason: string }
export interface ActionLevel { level: number; risk: string; action: string }
export interface RebaResult {
  scene: SceneKey; status: "complete" | "pending" | "unavailable";
  inputs: RebaFields;
  parts: Record<PartName, PartEvidence>; pending: PendingInput[];
  tableA: number | null; load: number | null; scoreA: number | null;
  tableB: number | null; coupling: number | null; scoreB: number | null;
  tableC: number | null; activity: number | null; activityBreakdown: { static: number; repeated: number; rapidOrUnstable: number } | null;
  final: number | null; action: ActionLevel | null;
  legalApplicability: "unknown"; surveyComplete: false;
  evidence?: VlmEvidence;
}
