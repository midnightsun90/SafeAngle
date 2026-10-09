"use client";

import Link from "next/link";
import { useState } from "react";
import AngleBar, { angleParts } from "@/components/AngleBar";
import "@/components/AngleBar.css";
import EvaluationShell from "@/components/EvaluationShell";
import PoseScenePreview from "@/components/PoseScenePreview";
import { usePoseAnalysis } from "@/components/PoseAnalysisProvider";
import { useVideoFiles } from "@/components/VideoFilesProvider";
import { questionGroups } from "@/lib/questions";
import { videoTitles } from "@/lib/resultData";
import { formatVideoTime } from "@/lib/video";
import "./results.css";

const questions = Object.values(questionGroups).flatMap((group) => group.questions);

export default function ResultsPage() {
  const { demoMode, activeEvaluation, activeVideos, storedVideos, answers, resultVideo, setResultVideo } = useVideoFiles();
  const { results, states, retry } = usePoseAnalysis();
  const [sideOverride, setSideOverride] = useState<"left" | "right" | null>(null);
  const uploadedVideos = activeVideos.filter((number) => Boolean(storedVideos[number]));
  const selected = uploadedVideos.includes(resultVideo) ? resultVideo : uploadedVideos[0];
  const result = selected ? results[selected] : null;
  const state = selected ? states[selected] : null;
  const answer = selected ? answers[selected] : null;
  const side = sideOverride ?? (answer?.arm === "left" ? "left" : "right");

  return <EvaluationShell step="06" stepName="결과 요약" title="작업 자세 측정 결과" wide introFull>
    <div className="pose-results">
      <p className="pose-results-lead">{demoMode ? "예시 모드에는 실제 영상 분석 결과가 없습니다." : `${activeEvaluation?.name ?? "평가 대상자"} · 영상에서 측정한 각도와 직접 입력한 작업 조건입니다.`}</p>
      <p className="pose-results-note">전체 점수와 좋음·나쁨 판정 기준은 아직 적용하지 않았습니다. 막대는 각도 위치만 나타냅니다.</p>
      {demoMode ? <Link className="next-button" href="/output-preview">예시 결과 보기 →</Link> : <>
        <div className="pose-results-tabs" aria-label="영상 선택">
          {uploadedVideos.map((number) => <button type="button" key={number} aria-pressed={selected === number} onClick={() => { setResultVideo(number); setSideOverride(null); }}>
            <strong>영상 {number} · {videoTitles[number]}</strong>
            <span>{results[number] ? "측정 완료" : states[number]?.step === "error" ? "분석 오류" : "분석 중"}</span>
          </button>)}
        </div>
        {uploadedVideos.length === 0 && <p role="alert">평가할 영상이 없습니다. 영상을 올려주세요.</p>}
        {selected && <div className="pose-results-card">
          <div className="pose-results-heading">
            <div><span>영상 {selected}</span><h2>{videoTitles[selected]}</h2></div>
            {result && <span>{result.selectionSource === "automatic" ? "자동 선택 장면" : "직접 선택 장면"} · {result.timeSec === null ? "없음" : formatVideoTime(result.timeSec)}</span>}
          </div>
          {state?.step === "error" && <div role="alert" className="pose-results-error"><p>분석 오류: {state.message}</p><button type="button" onClick={() => retry(selected)}>다시 분석</button></div>}
          {!result && state?.step !== "error" && <p role="status">영상을 분석하고 있습니다. {state?.progress ?? 0}%</p>}
          {result && <>
            <div className="pose-results-scene"><PoseScenePreview number={selected} timeSec={result.timeSec} /></div>
            <div className="pose-results-side"><p>사람 기준 {side === "left" ? "왼쪽" : "오른쪽"} 각도</p><div><button type="button" aria-pressed={side === "left"} onClick={() => setSideOverride("left")}>왼쪽</button><button type="button" aria-pressed={side === "right"} onClick={() => setSideOverride("right")}>오른쪽</button></div></div>
            <div className="pose-results-angles">{angleParts.map((part) => {
              const reading = result.measurements?.[side]?.[part.key];
              return <div className="pose-results-angle" key={part.key}>
                <div><strong>{part.label}</strong><small>{part.note}</small></div>
                <AngleBar value={reading?.value ?? null} min={part.min} max={part.max} />
                <b>{reading?.value === null || reading?.value === undefined ? "측정 불가" : `${reading.value.toFixed(1)}°`}</b>
              </div>;
            })}</div>
            <div className="pose-results-quality"><h3>측정 상태</h3><p>영상 {result.quality.videoStatus === "ready" ? "측정 가능" : result.quality.videoStatus === "partial" ? "일부 측정" : "재촬영 확인 필요"} · 한 부위 이상 측정된 장면 {Math.round(result.quality.measuredFrameRatio * 100)}% · 선택 장면 인물 {result.quality.personCount ?? "확인 불가"}명</p>{result.quality.requiresReview && <p>선택 장면을 직접 확인해 주세요.</p>}</div>
          </>}
          {answer && <details className="pose-results-answers"><summary>사람이 입력한 작업 조건</summary><dl>{questions.map((question) => <div key={question.key}><dt>{question.label}</dt><dd>{question.options.find((option) => option.value === answer[question.key])?.label ?? "미입력"}</dd></div>)}</dl></details>}
        </div>}
        <div className="pose-results-footer"><Link href="/analysis">대표 장면 평가하기</Link><Link href="/review">영상 확인으로 돌아가기</Link></div>
      </>}
    </div>
  </EvaluationShell>;
}
