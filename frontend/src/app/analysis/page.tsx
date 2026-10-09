"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import EvaluationShell from "@/components/EvaluationShell";
import { useVideoFiles } from "@/components/VideoFilesProvider";
import { allQuestionKeys } from "@/lib/questions";

const stages = [
  { title: "영상 장면 확인", description: "선택한 장면과 영상 3개를 확인합니다." },
  { title: "자세 각도 측정", description: "목·몸통·다리·팔의 각도를 영상에서 측정합니다." },
  { title: "사람 답변 반영", description: "Q1~Q4의 자세·힘·손잡이·활동 답변을 장면별로 적용합니다." },
  { title: "장면별 결과 계산", description: "확인된 값만으로 각 장면의 평가 결과를 계산합니다." },
];

export default function AnalysisPage() {
  const { files, selectedTimes, answers, demoMode } = useVideoFiles();
  const [demoProgress, setDemoProgress] = useState(0);
  const [demoRunning, setDemoRunning] = useState(true);

  useEffect(() => {
    if (!demoMode || !demoRunning || demoProgress >= 100) return;
    const timer = window.setTimeout(() => setDemoProgress((progress) => Math.min(progress + 5, 100)), 350);
    return () => window.clearTimeout(timer);
  }, [demoMode, demoRunning, demoProgress]);

  const missingScenes = ([1, 2, 3] as const).filter((number) => !files[number] || selectedTimes[number] === null);
  const missingAnswers = ([1, 2, 3] as const).filter((number) => allQuestionKeys.some((key) => !answers[number][key]));
  const unknownAnswers = ([1, 2, 3] as const).filter((number) => allQuestionKeys.some((key) => answers[number][key] === "unknown"));
  const progress = demoMode ? demoProgress : 0;
  const stageIndex = demoMode ? Math.min(Math.floor(progress / 25), stages.length) : -1;

  return (
    <EvaluationShell
      step="05"
      stepName="분석 진행"
      title={demoMode ? "분석을 진행하고 있습니다" : "분석을 준비 중입니다"}
      description={demoMode ? "세 장면의 자세와 답변을 각각 확인합니다." : "세 장면의 입력 상태를 확인합니다."}
    >
      <div className="analysis-content">
        {demoMode ? (
          <p className="demo-disclaimer">예시 화면입니다. 사진이나 답변을 분석하지 않으며, 아래 진행률은 화면 흐름을 보여주기 위한 것입니다.</p>
        ) : (
          <div className="analysis-notice" role="status">
            <strong>분석 엔진 연결 대기</strong>
            <p>현재 영상 각도 측정과 REBA 점수 계산은 연결되지 않았습니다. 실제 점수는 표시하지 않습니다.</p>
          </div>
        )}

        <div className="analysis-progress-heading">
          <strong>{demoMode ? (progress === 100 ? "예시 진행 완료" : "예시 진행 중") : "분석 대기"}</strong>
          <span>{progress}%</span>
        </div>
        <div className="analysis-progress" role="progressbar" aria-label={demoMode ? "예시 진행률" : "분석 진행률"} aria-valuemin={0} aria-valuemax={100} aria-valuenow={progress}>
          <span style={{ width: `${progress}%` }} />
        </div>

        <ol className="analysis-stages">
          {stages.map((stage, index) => (
            <li className={demoMode && index < stageIndex ? "analysis-stage-done" : demoMode && index === stageIndex && demoRunning ? "analysis-stage-current" : ""} key={stage.title}>
              <span className="analysis-stage-number" aria-hidden="true">{demoMode && index < stageIndex ? "✓" : String(index + 1).padStart(2, "0")}</span>
              <div><strong>{stage.title}</strong><p>{stage.description}</p></div>
              <span className="analysis-stage-status">{demoMode && index < stageIndex ? "예시 완료" : demoMode && index === stageIndex && demoRunning ? "표시 중" : "대기"}</span>
            </li>
          ))}
        </ol>

        {!demoMode && (missingScenes.length > 0 || missingAnswers.length > 0 || unknownAnswers.length > 0) && (
          <div className="analysis-inputs">
            <strong>입력 확인</strong>
            {missingScenes.length > 0 && <p>장면 미선택: 영상 {missingScenes.join(", ")}</p>}
            {missingAnswers.length > 0 && <p>질문 미완료: 영상 {missingAnswers.join(", ")}</p>}
            {unknownAnswers.length > 0 && <p>확인 불가 답변: 영상 {unknownAnswers.join(", ")} · 확정 점수 없음</p>}
          </div>
        )}

        <div className="analysis-actions">
          <Link href={demoMode ? "/questions/1/1" : "/review"}>이전 화면으로</Link>
          {demoMode && <button type="button" onClick={() => { setDemoProgress(0); setDemoRunning(true); }}>예시 다시 보기</button>}
          {demoMode && demoRunning && progress < 100 && <button type="button" onClick={() => setDemoRunning(false)}>예시 멈추기</button>}
          {demoMode && !demoRunning && progress < 100 && <button type="button" onClick={() => setDemoRunning(true)}>예시 이어 보기</button>}
        </div>
        {(demoMode ? progress === 100 : true) && <Link className="next-button analysis-result-link" href="/results">결과 요약 보기 <span aria-hidden="true">→</span></Link>}
      </div>
    </EvaluationShell>
  );
}
