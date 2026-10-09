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
  const { demoMode, files, selectedTimes, rebaResults, resultVideo, setResultVideo } = useVideoFiles();
  const [work, setWork] = useState<WorkContext | null>(null);

  useEffect(() => {
    try {
      const saved = JSON.parse(localStorage.getItem("safeangle.recentWorkContexts") ?? "[]");
      if (Array.isArray(saved) && saved[0] && typeof saved[0].company === "string" && typeof saved[0].worksite === "string" && typeof saved[0].task === "string") setWork(saved[0]);
    } catch { /* Work information is optional on this page. */ }
  }, []);

  const numbers=([1,2,3] as VideoNumber[]).filter(number=>demoMode||files[number]);
  const selected=numbers.includes(resultVideo)?resultVideo:numbers[0]??resultVideo;
  const sample = sampleResults[selected];
  const highest=numbers.map(number=>rebaResults[number]).filter(result=>result?.final!==null&&result?.final!==undefined).reduce((best,result)=>!best||result!.final!>best.final!?result:best,null as (typeof rebaResults)[VideoNumber]);
  const incompleteAnswers = numbers.filter((number) => rebaResults[number]?.final==null);

  return (
    <EvaluationShell step="06" stepName="결과 요약" title="작업 자세 평가 결과" wide introFull>
      <div className="results-topline">
        <p>{demoMode ? "회사명 · 작업장명 · 공정명" : work ? `${work.company} · ${work.worksite} · ${work.task}` : "작업 정보 미입력"}</p>
        {demoMode && <span className="sample-badge">시안용 예시</span>}
      </div>
      <p className="results-disclaimer">{demoMode ? "아래 점수는 디자인 시안의 예시입니다. 사진을 분석해 얻은 결과가 아닙니다." : "각 영상에서 선택하고 사람이 확인한 장면만 비교합니다. 전체 영상의 최고 위험이나 법적 조사 완료를 뜻하지 않습니다."}</p>
      <div className="result-metrics" aria-label="평가 결과 요약">
        <div><span>확정 장면 중 최고 점수</span><strong id="summary-final">{demoMode ? "8점" : highest?`${highest.final}점`:"미확정"}</strong></div>
        <div><span>위험 수준</span><strong>{demoMode ? "높음" : highest?.action?.risk??"미확정"}</strong></div>
        <div><span>조치 필요성</span><strong>{demoMode ? "곧 조치 필요" : highest?.action?.action??"확인 필요"}</strong></div>
      </div>

      <section className="result-scenes" aria-labelledby="result-scenes-title">
        <h2 id="result-scenes-title">영상별 주요 위험 장면</h2>
        <div className="result-scene-layout">
          <div className="result-selected-scene">
            <ScenePreview number={selected} />
            <p>영상 {selected} · {demoMode ? `예시 장면 ${sample.time || "미선택"}` : selectedTimes[selected] !== null ? `선택 장면 ${formatVideoTime(selectedTimes[selected] ?? 0)} · ${rebaResults[selected]?.scene.side==="left"?"왼쪽":"오른쪽"}` : "장면 미선택"}</p>
          </div>
          <div className="result-scene-list">
            {numbers.map((number) => {
              const result = sampleResults[number];
              const real=rebaResults[number];
              const reason = !real?"분석·장면 확인 필요":real.final===null?`확인 필요 ${real.pending.length}개`: `${formatVideoTime(real.scene.timeSec)} · ${real.scene.side==="left"?"왼쪽":"오른쪽"}`;
              return (
                <button className={selected === number ? "result-scene-active" : ""} type="button" key={number} onClick={() => setResultVideo(number)} aria-pressed={selected === number}>
                  <span className="result-scene-name">{number}. {videoTitles[number]}</span>
                  <span className="result-scene-score">{demoMode ? result.score === null ? "점수 미확정" : `${result.score}점 · ${result.risk}` : real?.final!=null?`${real.final}점 · ${real.action?.risk}`:"점수 미확정"}</span>
                  <span className="result-scene-time">{demoMode ? result.reason ?? result.time : reason}</span>
                </button>
              );
            })}
          </div>
        </div>
        {!demoMode && incompleteAnswers.length > 0 && <p className="result-note">영상 {incompleteAnswers.join(", ")}은 분석 또는 필수 확인이 끝나지 않아 확정 점수가 없습니다.</p>}
        {!demoMode&&!numbers.length&&<p>선택한 영상이 없습니다. 영상 평가부터 진행하십시오.</p>}
      </section>
      <div className="results-footer">
        <Link className="next-button" href="/report" onClick={()=>setResultVideo(selected)}>상세 평가서 보기 <span aria-hidden="true">→</span></Link>
        {!demoMode&&<Link href="/review">영상·답변 다시 평가 (이전 분석·답변 초기화)</Link>}
        <p>항목별 판정 · 전체 평가표 · 계산 과정</p>
      </div>
    </EvaluationShell>
  );
}
