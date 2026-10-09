import type { Analysis, AnalysisOptions, FrameSize, PoseFrame, TrackedFrame } from "./types.ts";
import { resolvePolicy } from "./config.ts";
import { chooseView, jointStatus, measureFrame, validateSize } from "./angles/frame.ts";
import { integerInRange, numberInRange } from "./validation.ts";
export function analyzePoses(frames: readonly PoseFrame[], size: FrameSize, options: AnalysisOptions = {}): Analysis {
  if (!Array.isArray(frames)) throw new TypeError("frames: 배열이 필요합니다.");
  validateSize(size);
  const policy = resolvePolicy(options.policy);
  let previous = -1;
  for (const frame of frames) {
    if (!frame || !Array.isArray(frame.landmarks)) throw new TypeError("landmarks: 좌표 배열이 필요합니다.");
    numberInRange(frame.timeSec, 0, Number.MAX_SAFE_INTEGER, "timeSec");
    if (frame.timeSec <= previous) throw new RangeError("timeSec: 장면 시각은 중복 없이 증가해야 합니다.");
    if (frame.personCount !== undefined) integerInRange(frame.personCount, 0, 100, "personCount");
    previous = frame.timeSec;
  }
  const view = chooseView(frames, options, policy.minVisibility);
  const reasonCounts: Analysis["reasonCounts"] = {};
  const tracked: TrackedFrame[] = frames.map((frame: PoseFrame) => {
    const raw = measureFrame(frame, size, view.side, view.facing, policy);
    const statuses = frame.landmarks.map(point => jointStatus(point, policy));
    for (const reason of raw.reasons) reasonCounts[reason] = (reasonCounts[reason] ?? 0) + 1;
    return { ...raw, landmarks: frame.landmarks.map(point => ({ ...point })), jointStatus: statuses };
  });
  const usableCount = tracked.filter(frame => frame.usable).length;
  const usableRatio = tracked.length ? usableCount / tracked.length : 0;
  return { ...view, size: { ...size }, status: usableCount > 0 && usableRatio >= policy.minUsableRatio ? "ready" : "retake",
    usableRatio, reasonCounts, frames: tracked, policy };
}
