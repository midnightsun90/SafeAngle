import type { Angles, FrameSize, PoseFrame } from "../lib/types.ts";

export const NEUTRAL_ANGLES: Angles = { trunk: 0, neck: 0, knee: 0, upperArm: 0, lowerArm: 90, wrist: 0 };

export function pose(timeSec = 0, size: FrameSize = { width: 1000, height: 1000 }): PoseFrame {
  const landmarks = Array.from({ length: 33 }, () => ({ x: 500 / size.width, y: 500 / size.height, visibility: 0.1 }));
  const coordinates: Record<number, [number, number]> = {
    7: [500,140], 11: [500,250], 13: [500,350], 15: [600,350], 19: [650,350],
    23: [500,500], 24: [520,500], 25: [500,650], 27: [500,800], 29: [490,830], 31: [540,830],
  };
  for (const [index, [x, y]] of Object.entries(coordinates)) {
    landmarks[Number(index)] = { x: x / size.width, y: y / size.height, visibility: Number(index) === 24 ? 0.1 : 1 };
  }
  return { timeSec, landmarks };
}

export function changePoint(frame: PoseFrame, index: number, change: Partial<PoseFrame["landmarks"][number]>): PoseFrame {
  return { ...frame, landmarks: frame.landmarks.map((point, at) => at === index ? { ...point, ...change } : { ...point }) };
}
