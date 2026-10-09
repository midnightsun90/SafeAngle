"use client";

import Link from "next/link";
import AngleBar, { angleParts } from "@/components/AngleBar";
import "@/components/AngleBar.css";
import EvaluationShell from "@/components/EvaluationShell";
import ScenePreview from "@/components/ScenePreview";
import { useVideoFiles } from "@/components/VideoFilesProvider";
import { questionGroups } from "@/lib/questions";
import { videoTitles } from "@/lib/resultData";
import { formatVideoTime } from "@/lib/video";
import "./results.css";

const questions = Object.values(questionGroups).flatMap((group) => group.questions);

export default function ResultsPage() {
  const { demoMode, activeEvaluation, activeVideos, storedVideos, answers, rebaResults, resultVideo, setResultVideo } = useVideoFiles();
  const uploadedVideos = activeVideos.filter((number) => Boolean(storedVideos[number]));
  const selected = uploadedVideos.includes(resultVideo) ? resultVideo : uploadedVideos[0];
  const result = selected ? rebaResults[selected] : null;
  const answer = selected ? answers[selected] : null;
  const measuredCount = result?.evidence ? angleParts.filter((part) => result.parts[part.key].measurement.value !== null).length : 0;

  return <EvaluationShell step="06" stepName="결과 요약" title="작업 자세 측정 결과" wide introFull>
    <div className="pose-results">
      <p className="pose-results-lead">{demoMode ? "예시 모드에는 실제 영상 분석 결과가 없습니다." : `${activeEvaluation?.name ?? "평가 대상자"} · GPT 제안과 사람의 관절 확인으로 계산한 대표 장면 각도입니다.`}</p>
      <p className="pose-results-note">선택한 한쪽 관절만 측정했습니다. 막대는 각도 위치이며, 좋음·나쁨이나 전체 점수를 뜻하지 않습니다.</p>
      {demoMode ? <Link className="next-button" href="/output-preview">예시 결과 보기 →</Link> : <>
        <div className="pose-results-tabs" aria-label="영상 선택">
          {uploadedVideos.map((number) => <button type="button" key={number} aria-pressed={selected === number} onClick={() => setResultVideo(number)}>
            <strong>영상 {number} · {videoTitles[number]}</strong>
            <span>{rebaResults[number]?.evidence ? "관절 확인 완료" : "분석 기록 없음"}</span>
          </button>)}
        </div>
        {uploadedVideos.length === 0 && <p role="alert">평가할 영상이 없습니다. 영상을 올려주세요.</p>}
        {selected && <div className="pose-results-card">
          <div className="pose-results-heading"><div><span>영상 {selected}</span><h2>{videoTitles[selected]}</h2></div>
            {result?.evidence && <span>사람 기준 {result.scene.side === "left" ? "왼쪽" : "오른쪽"} · {formatVideoTime(result.scene.timeSec)}</span>}</div>
          {!result?.evidence ? <div className="pose-results-empty"><p>확인된 GPT 분석 기록이 없습니다.</p><Link href="/analysis">대표 장면 분석하기 →</Link></div> : <>
            <div className="pose-results-scene"><ScenePreview number={selected} /></div>
            <p className="pose-results-selected-side">사람 기준 {result.scene.side === "left" ? "왼쪽" : "오른쪽"} 각도 · {measuredCount}/6개 부위 측정</p>
            <div className="pose-results-angles">{angleParts.map((part) => {
              const reading = result.parts[part.key].measurement;
              return <div className="pose-results-angle" key={part.key}>
                <div><strong>{part.label}</strong><small>{part.note}</small></div>
                <AngleBar value={reading.value} min={part.min} max={part.max} />
                <b>{reading.value === null ? "측정 불가" : `${reading.value.toFixed(1)}°`}</b>
              </div>;
            })}</div>
            {result.pending.length > 0 && <div className="pose-results-quality"><h3>추가 확인 항목</h3><p>{result.pending.length}개 항목이 확인되지 않았습니다. 상세 평가서에서 항목별 내용을 볼 수 있습니다.</p></div>}
            {answer && <details className="pose-results-answers"><summary>사람이 입력한 작업 조건</summary><dl>{questions.map((question) => <div key={question.key}><dt>{question.label}</dt><dd>{question.options.find((option) => option.value === answer[question.key])?.label ?? "미입력"}</dd></div>)}</dl></details>}
          </>}
        </div>}
        <div className="pose-results-footer"><Link className="pose-results-report-link" href="/report" onClick={() => { if (selected) setResultVideo(selected); }}>상세 평가서 보기 →</Link><Link href="/analysis">대표 장면 평가하기</Link><Link href="/review">영상 확인으로 돌아가기</Link></div>
      </>}
    </div>
  </EvaluationShell>;
}
