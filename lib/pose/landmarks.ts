import type { JointDetail, Side } from "../types.ts";

const names = [
  ["nose","코"],["left_eye_inner","왼쪽 눈 안쪽"],["left_eye","왼쪽 눈"],["left_eye_outer","왼쪽 눈 바깥"],
  ["right_eye_inner","오른쪽 눈 안쪽"],["right_eye","오른쪽 눈"],["right_eye_outer","오른쪽 눈 바깥"],
  ["left_ear","왼쪽 귀"],["right_ear","오른쪽 귀"],["mouth_left","왼쪽 입꼬리"],["mouth_right","오른쪽 입꼬리"],
  ["left_shoulder","왼쪽 어깨"],["right_shoulder","오른쪽 어깨"],["left_elbow","왼쪽 팔꿈치"],["right_elbow","오른쪽 팔꿈치"],
  ["left_wrist","왼쪽 손목"],["right_wrist","오른쪽 손목"],["left_pinky","왼쪽 소지 기준점"],["right_pinky","오른쪽 소지 기준점"],
  ["left_index","왼쪽 검지 기준점"],["right_index","오른쪽 검지 기준점"],["left_thumb","왼쪽 엄지 기준점"],["right_thumb","오른쪽 엄지 기준점"],
  ["left_hip","왼쪽 골반"],["right_hip","오른쪽 골반"],["left_knee","왼쪽 무릎"],["right_knee","오른쪽 무릎"],
  ["left_ankle","왼쪽 발목"],["right_ankle","오른쪽 발목"],["left_heel","왼쪽 뒤꿈치"],["right_heel","오른쪽 뒤꿈치"],
  ["left_foot_index","왼쪽 발끝"],["right_foot_index","오른쪽 발끝"],
] as const;

export const LANDMARKS: readonly Pick<JointDetail,"index"|"name"|"label"|"side">[] = names.map(([name,label],index)=>({
  index,name,label,side: name.includes("left") ? "left" as Side : name.includes("right") ? "right" as Side : "center",
}));
export const POSE_CONNECTIONS: readonly (readonly [number,number])[] = [
  [0,1],[1,2],[2,3],[3,7],[0,4],[4,5],[5,6],[6,8],[9,10],
  [11,12],[11,13],[13,15],[15,17],[15,19],[15,21],[17,19],
  [12,14],[14,16],[16,18],[16,20],[16,22],[18,20],
  [11,23],[12,24],[23,24],[23,25],[25,27],[27,29],[29,31],[27,31],
  [24,26],[26,28],[28,30],[30,32],[28,32],
];
