import type { VideoAnalysis } from "../../../lib/pose/video.ts";
import type { TrackedFrame } from "../../../lib/types.ts";
import type { VideoPostureType } from "./videoStorage";

export type PoseResult = {
  assessmentId: string;
  postureType: VideoPostureType;
  storagePath: string;
  timeSec: number | null;
  selectionSource: "automatic" | "manual";
  modelVersion: string;
  analyzedAt: string;
  measurements: TrackedFrame["measurements"] | null;
  quality: {
    videoStatus: VideoAnalysis["status"];
    frameStatus: TrackedFrame["status"] | null;
    personCount: number | null;
    facing: VideoAnalysis["facing"];
    durationSec: number;
    sampleIntervalSec: number;
    measuredFrameRatio: number;
    measurementCoverage: VideoAnalysis["measurementCoverage"];
    requiresReview: boolean;
    trackingWarnings: TrackedFrame["trackingWarnings"];
    reasons: TrackedFrame["reasons"];
  };
};

const measuredParts = (frame: TrackedFrame): number =>
  Object.values(frame.measurements.left).filter((part) => part.value !== null).length +
  Object.values(frame.measurements.right).filter((part) => part.value !== null).length;

export function representativeFrame(analysis: VideoAnalysis): TrackedFrame | null {
  const candidates = analysis.frames.filter((frame) => frame.personCount === 1 && measuredParts(frame) > 0);
  if (!candidates.length) return null;
  const middle = analysis.durationSec / 2;
  return [...candidates].sort((a, b) =>
    Number(a.requiresReview) - Number(b.requiresReview) ||
    measuredParts(b) - measuredParts(a) ||
    Math.abs(a.timeSec - middle) - Math.abs(b.timeSec - middle)
  )[0] ?? null;
}

export function frameAtTime(analysis: VideoAnalysis, timeSec: number): TrackedFrame | null {
  const nearest = analysis.frames.reduce<TrackedFrame | null>((best, frame) =>
    !best || Math.abs(frame.timeSec - timeSec) < Math.abs(best.timeSec - timeSec) ? frame : best, null);
  return nearest && Math.abs(nearest.timeSec - timeSec) <= analysis.sampleIntervalSec / 2 + 0.02 ? nearest : null;
}

export function toPoseResult(
  analysis: VideoAnalysis,
  frame: TrackedFrame | null,
  assessmentId: string,
  postureType: VideoPostureType,
  storagePath: string,
  selectionSource: PoseResult["selectionSource"],
): PoseResult {
  return {
    assessmentId,
    postureType,
    storagePath,
    timeSec: frame?.timeSec ?? null,
    selectionSource,
    modelVersion: analysis.runtime.modelVersion,
    analyzedAt: analysis.runtime.startedAt,
    measurements: frame?.measurements ?? null,
    quality: {
      videoStatus: analysis.status,
      frameStatus: frame?.status ?? null,
      personCount: frame?.personCount ?? null,
      facing: analysis.facing,
      durationSec: analysis.durationSec,
      sampleIntervalSec: analysis.sampleIntervalSec,
      measuredFrameRatio: analysis.measuredFrameRatio,
      measurementCoverage: analysis.measurementCoverage,
      requiresReview: frame?.requiresReview ?? false,
      trackingWarnings: frame?.trackingWarnings ?? [],
      reasons: frame?.reasons ?? [],
    },
  };
}

export function poseResultRow(result: PoseResult, managerId: string) {
  return {
    assessment_id: result.assessmentId,
    manager_id: managerId,
    posture_type: result.postureType,
    storage_path: result.storagePath,
    time_seconds: result.timeSec,
    selection_source: result.selectionSource,
    model_version: result.modelVersion,
    analyzed_at: result.analyzedAt,
    measurements: result.measurements,
    quality: result.quality,
  };
}

export function readPoseResult(row: {
  assessment_id: string;
  posture_type: VideoPostureType;
  storage_path: string;
  time_seconds: number | null;
  selection_source: PoseResult["selectionSource"];
  model_version: string;
  analyzed_at: string;
  measurements: PoseResult["measurements"];
  quality: PoseResult["quality"];
}): PoseResult {
  return {
    assessmentId: row.assessment_id,
    postureType: row.posture_type,
    storagePath: row.storage_path,
    timeSec: row.time_seconds,
    selectionSource: row.selection_source,
    modelVersion: row.model_version,
    analyzedAt: row.analyzed_at,
    measurements: row.measurements,
    quality: row.quality,
  };
}
