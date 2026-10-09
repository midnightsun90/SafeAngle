import type { Facing, FrameSize } from "../types.ts";
import type { SceneKey } from "../reba/types.ts";

export const VLM_JOINTS = ["ear", "shoulder", "elbow", "wrist", "index_mcp", "hip", "knee", "ankle"] as const;
export type VlmJoint = typeof VLM_JOINTS[number];
export interface ImagePoint { x: number; y: number }
export type VlmPoints = Record<VlmJoint, ImagePoint | null>;
export interface VlmCapture { scene: SceneKey; revision: number; imageSize: FrameSize; facing: Facing }
export interface VlmRequest {
  schemaVersion: "safeangle-joints-v1";
  requestId: string;
  capture: VlmCapture;
  imageDataUrl: string;
  consent: { granted: true; noticeVersion: "representative-frame-v1" };
}
export interface VlmProvenance { provider: "openai"; model: string; promptVersion: string; responseId: string; elapsedMs: number }
export interface VlmProposal {
  status: "proposed";
  schemaVersion: "safeangle-joints-v1";
  requestId: string;
  capture: VlmCapture;
  provenance: VlmProvenance;
  points: VlmPoints;
}
export interface VlmEvidence {
  requestId: string;
  imageDataUrl: string;
  capture: VlmCapture;
  provenance: VlmProvenance;
  originalPoints: VlmPoints;
  reviewedPoints: VlmPoints;
  confirmedBy: "human";
}
export const VLM_ERROR_CODES = ["invalid_request", "unauthorized", "consent_required", "image_too_large", "not_configured", "rate_limited", "timeout", "refused", "incomplete", "invalid_output", "upstream_error"] as const;
export type VlmErrorCode = typeof VLM_ERROR_CODES[number];
export type VlmResponse = VlmProposal | { status: "error"; requestId: string | null; error: { code: VlmErrorCode; message: string } };
