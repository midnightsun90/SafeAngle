"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import EvaluationShell from "@/components/EvaluationShell";
import ScenePreview from "@/components/ScenePreview";
import { useVideoFiles, type VideoNumber } from "@/components/VideoFilesProvider";
import { formatVideoTime } from "@/lib/video";
import { sampleResults, videoTitles } from "@/lib/resultData";

type WorkContext = { company: string; worksite: string; task: string };

export default function ResultsPage() {
  const { demoMode, files, selectedTimes, answers, resultVideo, setResultVideo, activeVideos } = useVideoFiles();
  const [work, setWork] = useState<WorkContext | null>(null);

  useEffect(() => {
    try {
      const saved = JSON.parse(localStorage.getItem("safeangle.recentWorkContexts") ?? "[]");
      if (Array.isArray(saved) && saved[0] && typeof saved[0].company === "string" && typeof saved[0].worksite === "string" && typeof saved[0].task === "string") setWork(saved[0]);
    } catch { /* Work information is optional on this page. */ }
  }, []);

  const numbers: VideoNumber[] = activeVideos;
  const sample = sampleResults[resultVideo];
  const incompleteAnswers = numbers.filter((number) => Object.values(answers[number]).includes("unknown"));

  return (
    <EvaluationShell step="06" stepName="결과 요약" title="작업 자세 평가 결과" wide introFull>
      <div className="results-topline">
        <p>{demoMode ? "회사명 · 작업장명 · 공정명" : work ? `${work.company} · ${work.worksite} · ${work.task}` : "작업 정보 미입력"}</p>
        {demoMode && <span className="sample-badge">시안용 예시</span>}
      </div>
      <p className="results-disclaimer">{demoMode ? "아래 점수는 디자인 시안의 예시입니다. 사진을 분석해 얻은 결과가 아닙니다." : "영상 각도 측정과 REBA 계산 엔진 연결 전입니다. 현재 확정 점수는 없습니다."}</p>
      <p className="result-note">평가 범위는 올린 영상과 선택한 장면입니다. 하지 않는 것으로 선택한 작업은 평가 대상에서 제외됩니다.</p>
      <div className="result-metrics" aria-label="평가 결과 요약">
        <div><span>확정 장면 중 최고 점수</span><strong>{demoMode ? "8점" : "미확정"}</strong></div>
        <div><span>위험 수준</span><strong>{demoMode ? "높음" : "미확정"}</strong></div>
        <div><span>조치 필요성</span><strong>{demoMode ? "곧 조치 필요" : "확인 필요"}</strong></div>
      </div>

      <section className="result-scenes" aria-labelledby="result-scenes-title">
        <h2 id="result-scenes-title">영상별 주요 위험 장면</h2>
        <div className="result-scene-layout">
          <div className="result-selected-scene">
            <ScenePreview number={resultVideo} />
            <p>영상 {resultVideo} · {demoMode ? `예시 장면 ${sample.time || "미선택"}` : selectedTimes[resultVideo] !== null ? `선택 장면 ${formatVideoTime(selectedTimes[resultVideo] ?? 0)}` : "장면 미선택"}</p>
          </div>
          <div className="result-scene-list">
            {numbers.map((number) => {
              const result = sampleResults[number];
              const reason = !files[number] || selectedTimes[number] === null ? "장면 미선택" : Object.values(answers[number]).includes("unknown") ? "확인 불가 입력" : "분석 엔진 연결 대기";
              return (
                <button className={resultVideo === number ? "result-scene-active" : ""} type="button" key={number} onClick={() => setResultVideo(number)} aria-pressed={resultVideo === number}>
                  <span className="result-scene-name">{number}. {videoTitles[number]}</span>
                  <span className="result-scene-score">{demoMode ? result.score === null ? "점수 미확정" : `${result.score}점 · ${result.risk}` : "점수 미확정"}</span>
                  <span className="result-scene-time">{demoMode ? result.reason ?? result.time : reason}</span>
                </button>
              );
            })}
          </div>
        </div>
        {!demoMode && incompleteAnswers.length > 0 && <p className="result-note">영상 {incompleteAnswers.join(", ")}에 확인 불가 답변이 있어 확정 점수를 낼 수 없습니다.</p>}
      </section>
      <div className="results-footer">
        <Link className="next-button" href="/report">상세 평가서 보기 <span aria-hidden="true">→</span></Link>
        <p>항목별 판정 · 전체 평가표 · 계산 과정</p>
      </div>
    </EvaluationShell>
  );
}
