import type { VideoNumber } from "@/components/VideoFilesProvider";

export const videoTitles: Record<VideoNumber, string> = {
  1: "낮은 곳 → 높은 곳",
  2: "앉아서 손 작업",
  3: "물체 밀기/당기기",
};

// Values from the screen-06 concept image. They are shown only in demo mode.
export const sampleResults: Record<VideoNumber, { score: number | null; risk: string; time: string; reason?: string }> = {
  1: { score: 8, risk: "높음", time: "00:12" },
  2: { score: 4, risk: "보통", time: "00:09" },
  3: { score: null, risk: "점수 미확정", time: "", reason: "힘 확인 필요" },
};

export const sampleRows = [
  { item: "몸통", value: "앞으로 20~60°", base: "3", adjustment: "없음", score: "3" },
  { item: "목", value: "앞으로 0~20°", base: "1", adjustment: "없음", score: "1" },
  { item: "다리", value: "한쪽 다리 지지", base: "2", adjustment: "없음", score: "2" },
  { item: "위팔", value: "앞으로 45~90°", base: "3", adjustment: "벌림 +1, 지지 −1", score: "3" },
  { item: "아래팔", value: "60~100°", base: "1", adjustment: "없음", score: "1" },
  { item: "손목", value: "15° 초과", base: "2", adjustment: "옆 꺾임 +1", score: "3" },
  { item: "무게·힘", value: "5~10 kg", base: "—", adjustment: "+1", score: "+1" },
  { item: "손잡이", value: "보통", base: "—", adjustment: "+1", score: "+1" },
  { item: "활동", value: "빠르고 큰 자세 변화", base: "—", adjustment: "+1", score: "+1" },
];
