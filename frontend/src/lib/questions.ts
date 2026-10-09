export type QuestionGroup = 1 | 2 | 3 | 4;

type Question = {
  key: string;
  label: string;
  hint?: string;
  options: { value: string; label: string }[];
};

const unknown = { value: "unknown", label: "확인 불가" };
const yesNo = [{ value: "yes", label: "예" }, { value: "no", label: "아니요" }, unknown];

export const questionGroups: Record<QuestionGroup, { name: string; title: string; description: string; questions: Question[] }> = {
  1: {
    name: "자세·좌우",
    title: "이 장면의 자세를 확인해 주세요",
    description: "영상만으로 판단하기 어려운 자세를 한 항목씩 확인합니다.",
    questions: [
      { key: "arm", label: "평가할 팔은 어느 쪽인가요?", options: [{ value: "left", label: "왼쪽" }, { value: "right", label: "오른쪽" }, unknown] },
      { key: "neck", label: "목을 돌리거나 옆으로 기울였나요?", options: [{ value: "none", label: "없음" }, { value: "twist", label: "돌림" }, { value: "side", label: "옆 기울임" }, { value: "both", label: "둘 다" }, unknown] },
      { key: "trunk", label: "몸통을 비틀거나 옆으로 기울였나요?", options: [{ value: "none", label: "없음" }, { value: "twist", label: "비틂" }, { value: "side", label: "옆 기울임" }, { value: "both", label: "둘 다" }, unknown] },
      { key: "legs", label: "다리 지지 상태는 어떤가요?", options: [{ value: "seated", label: "앉음" }, { value: "both", label: "양발 지지·보행" }, { value: "one", label: "한쪽 다리 지지" }, unknown] },
      { key: "unstable", label: "발밑 지지면이 불안정한가요?", options: yesNo },
      { key: "arm_abduction", label: "평가할 팔을 옆으로 벌리거나 회전했나요?", options: yesNo },
      { key: "shoulder_raised", label: "평가할 쪽 어깨를 올렸나요?", options: yesNo },
      { key: "arm_supported", label: "팔을 받치거나 몸을 기대었거나, 팔 움직임에 중력의 도움을 받았나요?", options: yesNo },
      { key: "wrist_angle", label: "평가할 손목의 굽힘·젖힘 구간은 무엇인가요?", hint: "선택한 장면의 손목을 직접 확인해 주세요.", options: [{ value: "0-15", label: "0~15°" }, { value: "over15", label: "15° 초과" }, unknown] },
      { key: "wrist_deviation", label: "손목을 옆으로 꺾거나 돌렸나요?", options: yesNo },
    ],
  },
  2: {
    name: "무게·힘",
    title: "이 장면에서 가한 힘을 알려주세요",
    description: "물체를 밀거나 당겼다면 물체 무게가 아닌 손에 실제로 가한 힘을 선택해 주세요.",
    questions: [
      { key: "force", label: "물체 무게 또는 실제 가한 힘은 어느 범위인가요?", hint: "밀기·당기기 힘을 모르면 ‘확인 불가’를 선택해 주세요.", options: [{ value: "under5", label: "5 kg 미만 (또는 49 N 미만)" }, { value: "5to10", label: "5~10 kg (또는 약 49~98 N)" }, { value: "over10", label: "10 kg 초과 (또는 98 N 초과)" }, unknown] },
      { key: "impact", label: "힘이 갑자기 커지거나 충격이 있었나요?", options: yesNo },
    ],
  },
  3: {
    name: "손잡이·지지",
    title: "물체를 어떻게 잡았나요?",
    description: "손잡이가 없는 물체와 잡을 물체가 없는 작업을 구분해 주세요.",
    questions: [
      { key: "coupling", label: "물체를 얼마나 안정적으로 잡거나 지지할 수 있었나요?", options: [{ value: "good", label: "잘 맞는 손잡이로 안정적으로 쥠" }, { value: "fair", label: "사용 가능하지만 이상적이지 않음 / 다른 신체 부위로 적절히 지지" }, { value: "poor", label: "쥘 수 있지만 불량함" }, { value: "ungraspable", label: "손잡이가 없거나 안전하게 쥐기 어려움" }, { value: "none", label: "잡거나 지지하는 물체 없음" }, unknown] },
    ],
  },
  4: {
    name: "활동",
    title: "작업의 지속과 반복을 알려주세요",
    description: "짧은 영상에 담기지 않은 시간과 반복도 실제 작업 기준으로 답해 주세요.",
    questions: [
      { key: "static", label: "같은 자세를 1분 넘게 유지했나요?", options: yesNo },
      { key: "repeated", label: "작은 동작을 분당 4회 초과 반복했나요?", hint: "걷기는 제외합니다.", options: yesNo },
      { key: "rapid_change", label: "자세가 빠르고 크게 바뀌었나요?", options: yesNo },
    ],
  },
};

export const allQuestionKeys = (Object.values(questionGroups) as (typeof questionGroups)[QuestionGroup][]).flatMap((group) => group.questions.map((question) => question.key));
