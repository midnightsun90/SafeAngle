"use client";

import { useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import EvaluationShell from "@/components/EvaluationShell";
import ScenePreview from "@/components/ScenePreview";
import { useVideoFiles } from "@/components/VideoFilesProvider";
import { formatVideoTime } from "@/lib/video";
import { questionGroups, workQuestionKeys } from "@/lib/questions";

// Screen examples only: never substitute these for an uploaded video's analysis.
const examples = [
  { time: 12, reason: "몸통을 숙인 자세가 보이는 장면입니다.", uncertain: true, unavailable: false },
  { time: 20, reason: "다른 작업 자세를 비교할 수 있는 장면입니다.", uncertain: false, unavailable: false },
  { time: 28, reason: "손목이 가려진 장면의 처리 예시입니다.", uncertain: false, unavailable: true },
];

export default function ConfirmationPage() {
  const { activeEvaluation, demoMode } = useVideoFiles();
  return <ConfirmationContent key={demoMode ? "demo" : activeEvaluation?.id ?? "none"} />;
}

function ConfirmationContent() {
  const router = useRouter();
  const { demoMode, activeVideos, answers, selectedTimes, setSelectedTime, setAnswer, confirmScene, setResultVideo } = useVideoFiles();
  const [videoNumber, setVideoNumber] = useState(activeVideos[0] ?? 1);
  const [candidateIndex, setCandidateIndex] = useState<number | null>(null);
  const [manual, setManual] = useState(false);
  const [message, setMessage] = useState("");
  const candidate = demoMode && candidateIndex !== null ? examples[candidateIndex] : null;
  const timeInput = useRef<HTMLInputElement>(null);
  const uncertaintyResolved = !candidate?.uncertain || ["yes", "no"].includes(answers[videoNumber].scene_trunk_twist);
  const workResolved = workQuestionKeys.every((key) => answers[videoNumber][key] && answers[videoNumber][key] !== "unknown");
  const ready = Boolean(candidate && !candidate.unavailable && uncertaintyResolved && workResolved);

  function choose(index: number) {
    setSelectedTime(videoNumber, examples[index].time);
    setCandidateIndex(index);
    setManual(false);
    setMessage("");
  }

  function evaluate() {
    if (!ready) return;
    confirmScene(videoNumber);
    const next = activeVideos.find((number) => number > videoNumber);
    if (next) {
      setVideoNumber(next);
      setCandidateIndex(null);
      setManual(false);
      setMessage("다음 영상의 추천 장면을 확인해주세요.");
    } else {
      setResultVideo(activeVideos[0]);
      router.push("/results");
    }
  }

  return (
    <EvaluationShell step="05" stepName="추천 장면 확인" title="AI 추천 장면을 확인해주세요" description="추천 이유를 확인하고 평가할 장면을 골라주세요. 추가 확인이 필요한 항목이 있다면 답해주세요." wide>
      <div className="confirmation-content">
      {demoMode ? <p className="demo-disclaimer">추천 이유·시간·불확실한 항목은 화면 확인용 예시입니다. 실제 AI 분석 결과가 아닙니다.</p> : <p className="analysis-notice" role="status">분석 결과 대기 · 아직 추천 장면을 받지 못했습니다. <Link href="/analysis">분석 화면으로</Link></p>}
      <h2>평가 추천 장면 · 영상 {videoNumber}{candidate ? ` · ${formatVideoTime(candidate.time)}` : ""}</h2>
      <ScenePreview number={videoNumber} />
      {demoMode && <div className="analysis-actions">{examples.map((example, index) => <button type="button" key={example.time} aria-pressed={index === candidateIndex} onClick={() => choose(index)}>추천 장면 {index + 1} · {formatVideoTime(example.time)}</button>)}</div>}
      {candidate && <p>추천 이유: {candidate.reason}</p>}
      <p>입력한 작업 조건도 함께 확인해주세요. <Link href={`/questions/${videoNumber}/2`}>작업 조건 수정하기</Link></p>
      <dl className="confirmation-conditions">{[2, 3, 4].flatMap((group) => questionGroups[group as 2 | 3 | 4].questions).map((question) => <div key={question.key}><dt>{question.label}</dt><dd>{question.options.find((option) => option.value === answers[videoNumber][question.key])?.label ?? "미입력"}</dd></div>)}</dl>
      {demoMode && <button type="button" onClick={() => setManual(!manual)}>직접 장면 선택하기</button>}
      {manual && <div className="question-field"><label>장면 시간(초) <input ref={timeInput} type="number" min="0" step="0.1" /></label><button type="button" onClick={() => { const raw = timeInput.current?.value; const time = Number(raw); if (!raw || !Number.isFinite(time) || time < 0) { setMessage("0 이상의 장면 시간을 입력해주세요."); return; } setSelectedTime(videoNumber, time); setCandidateIndex(null); setMessage("직접 선택한 장면은 재분석이 필요합니다. 엔진 연결 전에는 평가할 수 없습니다."); }}>이 시간 선택하기</button></div>}
      {selectedTimes[videoNumber] !== null && !candidate && <p>선택한 시간 {formatVideoTime(selectedTimes[videoNumber] ?? 0)} · 측정 대기</p>}
      {candidate?.uncertain && <fieldset className="question-field"><legend>불확실함 · 몸통 비틀림</legend><p>영상만으로는 비틀림 여부를 구분하기 어렵습니다. 이 장면에서 몸통을 비틀고 있나요?</p><div className="question-options">{[{ value: "yes", label: "있음" }, { value: "no", label: "없음" }, { value: "unknown", label: "확인 불가" }].map((option) => <label className="question-option" key={option.value}><input type="radio" name="scene_trunk_twist" checked={answers[videoNumber].scene_trunk_twist === option.value} onChange={() => setAnswer(videoNumber, "scene_trunk_twist", option.value)} />{option.label}</label>)}</div><p className="question-hint">판단하기 어렵다면 확인 불가를 선택해주세요.</p></fieldset>}
      {candidate?.unavailable && <p className="question-warning">측정 불가 · 관절이 가려져 있습니다. 자세가 보이는 다른 장면을 선택해주세요. 적절한 장면이 없다면 다시 촬영해주세요. <Link href={`/upload/${videoNumber}`}>영상 다시 올리기</Link></p>}
      <p role="status">{ready ? "확인됨 · 평가에 필요한 값이 확인됐습니다." : `점수 미확정 · 확인할 항목 ${workQuestionKeys.filter((key) => !answers[videoNumber][key] || answers[videoNumber][key] === "unknown").length + (candidate?.uncertain && !uncertaintyResolved ? 1 : 0)}개${!candidate || candidate.unavailable ? " · 측정 가능한 장면을 선택해주세요." : ""}`}</p>
      {message && <p role="status">{message}</p>}
      <div className="question-footer"><p>장면을 바꾸면 확인 항목도 다시 확인해주세요. 작업 조건이 다르면 입력한 답변을 수정해주세요. 확인 불가인 필수 항목이 있으면 점수는 미확정입니다.</p><button className="next-button" type="button" disabled={!ready} onClick={evaluate}>이 장면으로 평가하기 →</button></div>
      </div>
    </EvaluationShell>
  );
}
