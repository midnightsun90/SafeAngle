export type QuestionGroup = 1 | 2 | 3 | 4;

type Question = {
  key: string;
  label: string;
  hint?: string;
  options: { value: string; label: string }[];
};

const unknown = { value: "unknown", label: "확인 불가" };
const yesNo = [{ value: "yes", label: "있음" }, { value: "no", label: "없음" }, unknown];

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
    title: "작업 중 다루는 무게와 힘은 어느 정도인가요?",
    description: "물체를 밀거나 당겼다면 물체 무게가 아닌 손에 실제로 가한 힘을 선택해 주세요.",
    questions: [
      { key: "force", label: "물체의 무게 또는 실제로 가하는 힘은 어느 범위인가요?", hint: "들어 옮길 때는 물체 무게를, 밀거나 당길 때는 실제 힘을 기준으로 답해주세요. 힘의 kg 표기는 kgf 기준이며, 수레 전체 무게를 입력하지 않습니다. 모르면 확인 불가를 선택해주세요.", options: [{ value: "under5", label: "5 kg 미만" }, { value: "5to10", label: "5 kg 이상~10 kg 이하" }, { value: "over10", label: "10 kg 초과" }, unknown] },
      { key: "impact", label: "작업 중 충격을 받거나 갑작스럽게 힘을 쓰는 순간이 있나요?", hint: "예: 걸린 물체를 갑자기 당기거나, 떨어지는 물체를 급하게 받는 순간", options: yesNo },
    ],
  },
  3: {
    name: "손잡이·지지",
    title: "작업 중 물체를 어떻게 잡거나 지지하나요?",
    description: "손잡이가 없는 물체와 잡을 물체가 없는 작업을 구분해 주세요.",
    questions: [
      { key: "coupling", label: "물체를 잡거나 지지하는 상태는 어떤가요?", options: [{ value: "good", label: "좋음 · 무게 중심에 튼튼하고 잘 맞는 손잡이가 고정되어 있음" }, { value: "fair", label: "보통 · 어느 정도 적절한 손잡이가 있거나 다른 신체 부위로 지지할 수 있음" }, { value: "poor", label: "나쁨 · 들어 올릴 수 있지만 손으로 잡기 어렵거나 손잡이가 부적절함" }, { value: "ungraspable", label: "매우 나쁨 · 손잡이가 없거나 손잡이 형태가 위험함" }, { value: "none", label: "잡거나 지지하는 물체가 없음" }, unknown] },
    ],
  },
  4: {
    name: "활동",
    title: "작업의 지속과 반복을 알려주세요",
    description: "짧은 영상에 담기지 않은 시간과 반복도 실제 작업 기준으로 답해 주세요.",
    questions: [
      { key: "static", label: "한 곳 이상의 신체 부위를 같은 자세로 1분 이상 유지하나요?", hint: "예: 팔을 든 채로 1분 이상 잡고 있는 작업", options: yesNo },
      { key: "repeated", label: "좁은 범위의 동작을 분당 4회 이상 반복하나요?", hint: "예: 손이나 팔의 작은 동작을 반복하는 작업. 걷기는 제외합니다.", options: yesNo },
    ],
  },
};

export const allQuestionKeys = (Object.values(questionGroups) as (typeof questionGroups)[QuestionGroup][]).flatMap((group) => group.questions.map((question) => question.key));
export const workQuestionKeys = [2, 3, 4].flatMap((number) => questionGroups[number as QuestionGroup].questions.map((question) => question.key));
