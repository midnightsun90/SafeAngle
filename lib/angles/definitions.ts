import type { PartName } from "../types.ts";

export const MEASUREMENT_DEFINITIONS: Record<PartName,{ label:string; reference:string; range:readonly[number,number]; approximate:boolean }> = {
  trunk:{label:"몸통 기울기",reference:"골반→어깨 벡터와 화면의 위쪽 수직축. 화면상 바라보는 방향의 기울기가 +",range:[-180,180],approximate:false},
  neck:{label:"목 상대 기울기",reference:"어깨→귀 벡터의 수직 기울기에서 몸통 기울기와 중립 보정값을 뺌",range:[-180,180],approximate:true},
  upperArm:{label:"위팔 기울기",reference:"어깨→팔꿈치 벡터와 몸통 아래 방향. 앞으로 들면 +, 머리 위로 들면 180 부근",range:[-90,270],approximate:false},
  lowerArm:{label:"팔꿈치 굽힘",reference:"180° − 어깨·팔꿈치·손목의 내각. 일자로 펴면 0°",range:[0,180],approximate:false},
  knee:{label:"무릎 굽힘",reference:"180° − 골반·무릎·발목의 내각. 일자로 펴면 0°",range:[0,180],approximate:false},
  wrist:{label:"손목 근사 굽힘",reference:"180° − 팔꿈치·손목·검지 기준점의 내각. 손가락 자세와 촬영 방향에 영향받는 근사치",range:[0,180],approximate:true},
};
export const PARTS = Object.keys(MEASUREMENT_DEFINITIONS) as PartName[];
