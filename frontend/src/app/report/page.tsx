"use client";

import Link from "next/link";
import { useState } from "react";
import EvaluationShell from "@/components/EvaluationShell";
import PoseScenePreview from "@/components/PoseScenePreview";
import { usePoseAnalysis } from "@/components/PoseAnalysisProvider";
import { useVideoFiles } from "@/components/VideoFilesProvider";
import { angleParts } from "@/components/AngleBar";
import { questionGroups } from "@/lib/questions";
import { videoTitles } from "@/lib/resultData";
import { formatVideoTime } from "@/lib/video";
import type { Measurement, QualityReason, TrackingWarning } from "../../../../lib/types.ts";
import "./report.css";
import { captureFrame } from "@/lib/captureFrame";
import "./print.css";

const reasonLabels: Record<QualityReason, string> = {
  no_person: "사람이 보이지 않음", multiple_people: "여러 사람 감지", invalid_landmarks: "관절 위치 오류",
  occluded: "관절이 가려짐", out_of_frame: "관절이 화면 밖에 있음", not_side_view: "측면 자세가 아님",
  too_far: "사람이 너무 멀리 있음", invalid_geometry: "관절 각도 계산 불가", unknown_direction: "몸 방향 확인 불가",
  missing_joint: "필요한 관절이 보이지 않음", tracking_uncertain: "사람 추적 불확실",
};
const warningLabels: Record<TrackingWarning, string> = {
  tracking_gap: "사람 추적이 끊김", position_jump: "사람 위치가 갑자기 바뀜",
  segment_length_change: "관절 사이 길이가 크게 바뀜", subject_change_suspected: "추적 대상 변경 의심",
};
const questions = Object.values(questionGroups).flatMap((group) => group.questions);

function measurementText(measurement: Measurement | undefined) {
  if (measurement?.status !== "measured" || measurement.value === null) return "측정 불가";
  return `${measurement.value.toFixed(1)}°${measurement.approximate ? " · 근사값" : ""}`;
}

function measurementNote(measurement: Measurement | undefined, coverage: number | undefined) {
  const notes = (measurement?.reasons ?? []).map((reason) => reasonLabels[reason]);
  if (measurement?.minVisibility !== null && measurement?.minVisibility !== undefined) {
    notes.push(`관절 가시성 ${Math.round(measurement.minVisibility * 100)}%`);
  }
  if (coverage !== undefined) notes.push(`영상 내 측정 가능 장면 ${Math.round(coverage * 100)}%`);
  return notes.join(" · ");
}

export default function ReportPage() {
  const { demoMode, activeEvaluation, activeVideos, storedVideos, answers, resultVideo, setResultVideo, dashboard } = useVideoFiles();
  const [printing,setPrinting]=useState(false);
  const [printError,setPrintError]=useState("");
  const [printFrame,setPrintFrame]=useState<{key:string;image:string}|null>(null);
  const { results, states, retry } = usePoseAnalysis();
  const uploadedVideos = activeVideos.filter((number) => Boolean(storedVideos[number]));
  const selected = uploadedVideos.includes(resultVideo) ? resultVideo : uploadedVideos[0];
  const result = selected ? results[selected] : null;
  const state = selected ? states[selected] : null;
  const answer = selected ? answers[selected] : null;
  const frameKey=result?`${selected}:${result.timeSec}:${result.analyzedAt}`:"";
  async function printReport(){
    setPrinting(true);setPrintError("");
    try{
      if(result?.timeSec!=null){
        const video=document.querySelector<HTMLVideoElement>("main .scene-preview video");
        if(!video)throw new Error("영상을 불러온 뒤 다시 저장하십시오.");
        const frame=await captureFrame(video,result.timeSec,AbortSignal.timeout(7000));
        setPrintFrame({key:frameKey,image:frame.imageDataUrl});
      }
      await document.fonts.ready;
      await new Promise<void>(resolve=>requestAnimationFrame(()=>requestAnimationFrame(()=>resolve())));
      await Promise.all(Array.from(document.querySelectorAll<HTMLImageElement>("main img"),image=>image.decode()));
      window.print();
    }catch(error){setPrintError(error instanceof Error?error.message:"평가서를 준비하지 못했습니다. 다시 시도하십시오.");}
    finally{setPrinting(false);}
  }

  return <EvaluationShell step="07" stepName="상세 평가서" title="작업 자세 상세 평가서" wide introFull
    beforeIntro={<div className="report-detail-back"><Link href="/results">← 결과 요약으로</Link><button type="button" className="sa-button" disabled={printing} onClick={()=>void printReport()}>{printing?"평가서 준비 중…":"인쇄 / PDF 저장"}</button></div>}>
    {printError&&<p className="report-print-error" role="alert">{printError}</p>}
    <p className="report-print-only">SafeAngle · 평가 대상자: {demoMode?"시안용 예시":activeEvaluation?.name??"미선택"} · 평가자: {dashboard.evaluatorName||"미입력"}</p>
    <div className="report-detail">
      <p className="report-detail-lead">{activeEvaluation?.name ?? "평가 대상자"} · 영상에서 측정한 각도와 직접 입력한 작업 조건입니다.</p>
      <p className="report-detail-notice">각도는 선택된 한 장면의 측정값입니다. 좋음·나쁨 판정과 전체 점수는 아직 적용하지 않았습니다.</p>

      {demoMode ? <div className="report-detail-empty"><p>예시 모드에는 실제 영상 분석 데이터가 없습니다.</p><Link href="/output-preview">예시 결과 보기 →</Link></div> : <>
        <div className="report-detail-tabs" aria-label="영상 선택">
          {uploadedVideos.map((number) => <button type="button" key={number} aria-pressed={selected === number} onClick={() => setResultVideo(number)}>
            <strong>영상 {number} · {videoTitles[number]}</strong>
            <span>{results[number] ? "측정 완료" : states[number]?.step === "error" ? "분석 오류" : "분석 중"}</span>
          </button>)}
        </div>

        {!selected && <div className="report-detail-empty"><p>등록된 영상이 없습니다.</p><Link href="/upload/1">영상 올리기 →</Link></div>}
        {selected && <>
          <div className="report-detail-heading">
            <div><span>영상 {selected}</span><h2>{videoTitles[selected]}</h2></div>
            {result && <p>{result.selectionSource === "automatic" ? "자동 선택" : "직접 선택"} · {result.timeSec === null ? "대표 장면 없음" : formatVideoTime(result.timeSec)}</p>}
          </div>

          {state?.step === "error" && <div className="report-detail-empty" role="alert"><p>분석 오류: {state.message}</p><button type="button" onClick={() => retry(selected)}>다시 분석</button></div>}
          {!result && state?.step !== "error" && <p className="report-detail-empty" role="status">영상을 분석하고 있습니다. {state?.progress ?? 0}%</p>}

          {result && <>
            {result.timeSec !== null && <section className="report-detail-section">
              <div className="report-detail-section-title"><span>01</span><h3>측정 장면</h3></div>
              <div className="report-detail-scene"><div className="report-screen-frame"><PoseScenePreview number={selected} timeSec={result.timeSec} /></div>
                {printFrame?.key===frameKey?<img className="report-print-only" src={printFrame.image} alt="평가에 사용한 대표 장면"/>:<p className="report-print-only">대표 장면을 포함하려면 ‘인쇄 / PDF 저장’ 버튼을 사용하십시오.</p>}
              </div>
            </section>}

            <section className="report-detail-section">
              <div className="report-detail-section-title"><span>02</span><h3>부위별 측정값</h3></div>
              <p className="report-detail-section-copy">사람 기준 왼쪽과 오른쪽을 모두 표시합니다. 측정 불가 항목은 점수로 바꾸지 않습니다.</p>
              <div className="report-detail-measurements">
                <div className="report-detail-measurement-head"><span>부위</span><span>왼쪽</span><span>오른쪽</span></div>
                {angleParts.map((part) => <div className="report-detail-measurement" key={part.key}>
                  <div className="report-detail-part"><strong>{part.label}</strong><small>{part.note}</small></div>
                  {(["left", "right"] as const).map((side) => {
                    const measurement = result.measurements?.[side]?.[part.key];
                    const note = measurementNote(measurement, result.quality.measurementCoverage?.[side]?.[part.key]);
                    return <div className="report-detail-reading" key={side}>
                      <strong>{measurementText(measurement)}</strong>
                      {note && <small>{note}</small>}
                    </div>;
                  })}
                </div>)}
              </div>
            </section>

            <section className="report-detail-section">
              <div className="report-detail-section-title"><span>03</span><h3>측정 상태</h3></div>
              <dl className="report-detail-facts">
                <div><dt>영상 상태</dt><dd>{result.quality.videoStatus === "ready" ? "측정 가능" : result.quality.videoStatus === "partial" ? "일부 측정" : "재촬영 확인 필요"}</dd></div>
                <div><dt>선택 장면</dt><dd>{result.quality.frameStatus === "complete" ? "모든 부위 측정" : result.quality.frameStatus === "partial" ? "일부 부위 측정" : result.quality.frameStatus === "unusable" ? "측정 불가" : "대표 장면 없음"}</dd></div>
                <div><dt>측정된 장면 비율</dt><dd>{Math.round(result.quality.measuredFrameRatio * 100)}%</dd></div>
                <div><dt>선택 장면의 사람 수</dt><dd>{result.quality.personCount === null ? "확인 불가" : `${result.quality.personCount}명`}</dd></div>
                <div><dt>영상 길이</dt><dd>{result.quality.durationSec.toFixed(1)}초</dd></div>
                <div><dt>분석 간격</dt><dd>{result.quality.sampleIntervalSec.toFixed(1)}초</dd></div>
                <div><dt>수동 확인 필요</dt><dd>{result.quality.requiresReview ? "필요" : "없음"}</dd></div>
                <div><dt>측정 제한 사유</dt><dd>{result.quality.reasons.length ? result.quality.reasons.map((reason) => reasonLabels[reason]).join(" · ") : "없음"}</dd></div>
                <div><dt>사람 추적 알림</dt><dd>{result.quality.trackingWarnings.length ? result.quality.trackingWarnings.map((warning) => warningLabels[warning]).join(" · ") : "없음"}</dd></div>
              </dl>
            </section>

            <section className="report-detail-section">
              <div className="report-detail-section-title"><span>04</span><h3>직접 입력한 작업 조건</h3></div>
              <dl className="report-detail-answers">{questions.map((question) => <div key={question.key}>
                <dt>{question.label}</dt><dd>{question.options.find((option) => option.value === answer?.[question.key])?.label ?? "미입력"}</dd>
              </div>)}</dl>
            </section>

            <section className="report-detail-section report-detail-metadata">
              <div className="report-detail-section-title"><span>05</span><h3>분석 기록</h3></div>
              <p>모델 {result.modelVersion} · 분석 시각 {new Date(result.analyzedAt).toLocaleString("ko-KR")}</p>
            </section>
          </>}
        </>}
      </>}
    </div>
  </EvaluationShell>;
}
