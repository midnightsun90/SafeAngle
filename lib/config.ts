import type { EnginePolicy } from "./types.ts";
import { numberInRange } from "./validation.ts";
// Measurement choices for comparison on real footage, not statutory limits.
export const DEFAULT_POLICY: Readonly<EnginePolicy> = Object.freeze({
  neckNeutralOffsetDeg: 0, minVisibility: 0.5, frameMargin: 0.02,
  maxHipToTrunkRatio: 0.35, minTrunkToLongSideRatio: 0.07, minUsableRatio: 0.6,
  sampleIntervalSec: 0.1,
  maxJointSpeedTrunksPerSec: 8,
  maxSegmentLengthChangeRatio: 0.6,
  maxSubjectShiftTrunks: 1.5,
  maxTrackingGapSec: 0.35,
});
export function resolvePolicy(overrides: Partial<EnginePolicy> = {}): EnginePolicy {
  for (const key of Object.keys(overrides)) {
    if (!Object.hasOwn(DEFAULT_POLICY, key)) throw new TypeError("알 수 없는 품질 설정: " + key);
  }
  const policy = { ...DEFAULT_POLICY, ...overrides };
  numberInRange(policy.neckNeutralOffsetDeg, -180, 180, "neckNeutralOffsetDeg");
  numberInRange(policy.minVisibility, 0.01, 1, "minVisibility");
  numberInRange(policy.frameMargin, 0, 0.49, "frameMargin");
  numberInRange(policy.maxHipToTrunkRatio, 0.01, 2, "maxHipToTrunkRatio");
  numberInRange(policy.minTrunkToLongSideRatio, 0.001, 1, "minTrunkToLongSideRatio");
  numberInRange(policy.minUsableRatio, 0.01, 1, "minUsableRatio");
  numberInRange(policy.sampleIntervalSec, 0.01, 1, "sampleIntervalSec");
  numberInRange(policy.maxJointSpeedTrunksPerSec, 0.1, 100, "maxJointSpeedTrunksPerSec");
  numberInRange(policy.maxSegmentLengthChangeRatio, 0.01, 5, "maxSegmentLengthChangeRatio");
  numberInRange(policy.maxSubjectShiftTrunks, 0.1, 20, "maxSubjectShiftTrunks");
  numberInRange(policy.maxTrackingGapSec, 0.01, 10, "maxTrackingGapSec");
  return policy;
}
