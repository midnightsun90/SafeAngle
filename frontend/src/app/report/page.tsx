"use client";

import Link from "next/link";
import { useState } from "react";
import AngleBar, { angleParts } from "@/components/AngleBar";
import "@/components/AngleBar.css";
import EvaluationShell from "@/components/EvaluationShell";
import ScenePreview from "@/components/ScenePreview";
import { useVideoFiles } from "@/components/VideoFilesProvider";
import { captureFrame } from "@/lib/captureFrame";
import { videoTitles } from "@/lib/resultData";
import { formatVideoTime } from "@/lib/video";
import type { AnswerName, Confirmation } from "../../../../lib/reba/types.ts";
import type { PartName, QualityReason } from "../../../../lib/types.ts";
import { VLM_JOINTS, type VlmJoint } from "../../../../lib/vlm/contract.ts";
import "./report.css";
import "./print.css";

const reasonLabels: Record<QualityReason, string> = {
  no_person: "사람이 보이지 않음", multiple_people: "여러 사람 감지", invalid_landmarks: "관절 위치 오류",
  occluded: "관절이 가려짐", out_of_frame: "관절이 화면 밖에 있음", not_side_view: "측면 자세가 아님",
  too_far: "사람이 너무 멀리 있음", invalid_geometry: "관절 각도 계산 불가", unknown_direction: "몸 방향 확인 불가",
  missing_joint: "필요한 관절이 보이지 않음", tracking_uncertain: "사람 추적 불확실",
};
const jointLabels: Record<VlmJoint, string> = {
  ear: "귀", shoulder: "어깨", elbow: "팔꿈치", wrist: "손목", index_mcp: "검지 MCP",
  hip: "고관절", knee: "무릎", ankle: "발목",
};
const inputLabels: Record<AnswerName, string> = {
  neckBase: "목 굽힘 구간", trunkUpright: "몸통 중립", trunkBase: "몸통 굽힘 구간", kneeExtra: "무릎 굽힘 구간",
  upperArmBase: "위팔 각도 구간", lowerArmBase: "팔꿈치 각도 구간", wristBase: "손목 각도 구간",
  neckTwist: "목 돌림", neckSideBend: "목 옆 기울임", trunkTwist: "몸통 비틂", trunkSideBend: "몸통 옆 기울임",
  legs: "다리 지지", unstable: "불안정한 지지면", armAbducted: "팔 벌림·회전", shoulderRaised: "어깨 올림",
  armSupported: "팔 지지", wristDeviated: "손목 옆 꺾임", wristTwisted: "손목 회전",
  loadKg: "물체 무게·가한 힘", shock: "충격·갑작스러운 힘", coupling: "잡거나 지지하는 상태",
  staticMinutes: "같은 자세 유지 시간", repeatsPerMinute: "분당 반복 횟수", repetitionIsWalking: "보행 동작",
  rapidChange: "빠른 자세 변화",
};
const inputUnits: Partial<Record<AnswerName, string>> = { loadKg: "kg 또는 kgf", staticMinutes: "분", repeatsPerMinute: "회/분" };
const bandLabels: Partial<Record<AnswerName, Record<number, string>>> = {
  neckBase: { 1: "중립·0~20° 앞굽힘", 2: "20° 초과 앞굽힘 또는 뒤젖힘" },
  trunkBase: { 1: "똑바로 섬", 2: "0~20° 앞굽힘·뒤젖힘", 3: "20° 초과~60° 앞굽힘 또는 20° 초과 뒤젖힘", 4: "60° 초과 앞굽힘" },
  kneeExtra: { 0: "30° 미만", 1: "30~60°", 2: "60° 초과" },
  upperArmBase: { 1: "뒤로 20°~앞으로 20°", 2: "뒤로 20° 초과 또는 앞으로 20° 초과~45°", 3: "앞으로 45° 초과~90°", 4: "앞으로 90° 초과" },
  lowerArmBase: { 1: "팔꿈치 60~100° 굽힘", 2: "60° 미만 또는 100° 초과" },
  wristBase: { 1: "0~15° 굽힘·젖힘", 2: "15° 초과 굽힘·젖힘" },
};

function answerText(name: AnswerName, input: Confirmation<unknown>): string {
  if (input.state === "unknown") return "미입력";
  if (input.state === "unavailable") return "확인 불가";
  if (input.state === "not_applicable") return "해당 없음";
  if (typeof input.value === "boolean") return input.value ? "예" : "아니요";
  if (typeof input.value === "number" && bandLabels[name]) return bandLabels[name][input.value] ?? "확인 불가";
  if (name === "legs") return ({ bilateral: "양발 지지", walking: "보행", sitting: "앉음", unilateral: "한쪽 다리 지지" } as Record<string, string>)[String(input.value)] ?? String(input.value);
  if (name === "coupling") return ({ good: "양호", fair: "보통", poor: "나쁨", unacceptable: "안전하게 잡기 어려움" } as Record<string, string>)[String(input.value)] ?? String(input.value);
  return `${input.value}${inputUnits[name] ? ` ${inputUnits[name]}` : ""}`;
}

function pointText(point: { x: number; y: number } | null): string {
  return point ? `가로 ${(point.x * 100).toFixed(1)}% · 세로 ${(point.y * 100).toFixed(1)}%` : "관측 불가";
}

export default function ReportPage() {
  const { demoMode, dashboard, activeEvaluation, activeVideos, storedVideos, rebaResults, resultVideo, setResultVideo } = useVideoFiles();
  const [printing, setPrinting] = useState(false);
  const [printError, setPrintError] = useState("");
  const [printFrame, setPrintFrame] = useState<{ key: string; image: string } | null>(null);
  const uploadedVideos = activeVideos.filter((number) => Boolean(storedVideos[number]));
  const selected = uploadedVideos.includes(resultVideo) ? resultVideo : uploadedVideos[0];
  const result = selected ? rebaResults[selected] : null;
  const evidence = result?.evidence;
  const frameKey = result ? `${result.scene.videoId}:${result.scene.timeSec}:${result.scene.side}` : "";
  const measuredCount = result ? angleParts.filter((part) => result.parts[part.key].measurement.value !== null).length : 0;

  async function printReport() {
    if (!result || !selected) return;
    setPrinting(true); setPrintError("");
    try {
      if (!evidence?.imageDataUrl) {
        const video = document.querySelector<HTMLVideoElement>(".report-detail-scene video");
        if (!video) throw new Error("영상을 불러온 뒤 다시 저장해 주세요.");
        const frame = await captureFrame(video, result.scene.timeSec, AbortSignal.timeout(7000));
        setPrintFrame({ key: frameKey, image: frame.imageDataUrl });
      }
      await document.fonts.ready;
      await new Promise<void>((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => resolve())));
      await Promise.all(Array.from(document.querySelectorAll<HTMLImageElement>(".report-detail img"), (image) => image.decode()));
      window.print();
    } catch (error) {
      setPrintError(error instanceof Error ? error.message : "PDF를 준비하지 못했습니다. 다시 시도해 주세요.");
    } finally { setPrinting(false); }
  }

  return <EvaluationShell step="07" stepName="상세 평가서" title="작업 자세 상세 평가서" wide introFull
    beforeIntro={<div className="report-detail-back"><Link href="/results">← 결과 요약으로</Link><button type="button" disabled={!evidence || printing} onClick={() => void printReport()}>{printing ? "평가서 준비 중…" : "인쇄 / PDF 저장"}</button></div>}>
    <div className="report-detail">
      {printError && <p className="report-print-error" role="alert">{printError}</p>}
      <p className="report-detail-print-heading">SafeAngle · 평가자 {dashboard.evaluatorName || "미입력"} · 평가 대상자 {activeEvaluation?.name ?? "미선택"}</p>
      <p className="report-detail-lead">{activeEvaluation?.name ?? "평가 대상자"} · GPT가 제안하고 사람이 확인한 대표 장면의 측정 기록입니다.</p>
      <p className="report-detail-notice">선택한 쪽의 한 장면만 측정했습니다. 영상 전체의 위험도와 최종 점수는 표시하지 않습니다.</p>

      {demoMode ? <div className="report-detail-empty"><p>예시 모드에는 실제 분석 기록이 없습니다.</p><Link href="/output-preview">예시 결과 보기 →</Link></div> : <>
        <div className="report-detail-tabs" aria-label="영상 선택">
          {uploadedVideos.map((number) => <button type="button" key={number} aria-pressed={selected === number} onClick={() => setResultVideo(number)}>
            <strong>영상 {number} · {videoTitles[number]}</strong>
            <span>{rebaResults[number]?.evidence ? "관절 확인 완료" : "분석 기록 없음"}</span>
          </button>)}
        </div>
        {!selected && <div className="report-detail-empty"><p>등록된 영상이 없습니다.</p><Link href="/upload/1">영상 올리기 →</Link></div>}
        {selected && !evidence && <div className="report-detail-empty"><p>이 영상의 확인된 GPT 분석 기록이 없습니다.</p><Link href="/analysis">대표 장면 분석하기 →</Link></div>}
        {selected && result && evidence && <>
          <div className="report-detail-heading"><div><span>영상 {selected}</span><h2>{videoTitles[selected]}</h2></div><p>사람 기준 {result.scene.side === "left" ? "왼쪽" : "오른쪽"} · {formatVideoTime(result.scene.timeSec)}</p></div>

          <section className="report-detail-section">
            <div className="report-detail-section-title"><span>01</span><h3>측정 장면</h3></div>
            <div className="report-detail-scene"><ScenePreview number={selected} /></div>
            {!evidence.imageDataUrl && printFrame?.key === frameKey && <img className="report-detail-print-frame" src={printFrame.image} alt="PDF에 포함할 대표 장면" />}
          </section>

          <section className="report-detail-section">
            <div className="report-detail-section-title"><span>02</span><h3>부위별 각도</h3></div>
            <p className="report-detail-section-copy">선택한 {result.scene.side === "left" ? "왼쪽" : "오른쪽"} 관절만 GPT가 제안했습니다. 관절 좌표를 사람이 확인한 뒤 각도를 계산했습니다.</p>
            <div className="report-detail-measurements">
              {angleParts.map((part) => {
                const reading = result.parts[part.key].measurement;
                return <div className="report-detail-measurement" key={part.key}>
                  <div className="report-detail-part"><strong>{part.label}</strong><small>{part.note}</small></div>
                  <AngleBar value={reading.value} min={part.min} max={part.max} />
                  <div className="report-detail-reading"><strong>{reading.value === null ? "측정 불가" : `${reading.value.toFixed(1)}°${reading.approximate ? " · 근사" : ""}`}</strong>
                    {reading.reasons.length > 0 && <small>{reading.reasons.map((reason) => reasonLabels[reason]).join(" · ")}</small>}
                  </div>
                </div>;
              })}
            </div>
          </section>

          <section className="report-detail-section">
            <div className="report-detail-section-title"><span>03</span><h3>측정 상태</h3></div>
            <dl className="report-detail-facts">
              <div><dt>각도 측정</dt><dd>{measuredCount} / 6개 부위</dd></div>
              <div><dt>관절 좌표</dt><dd>사람 확인 완료</dd></div>
              <div><dt>장면</dt><dd>{result.status === "unavailable" ? "재촬영·현장 확인 필요" : "선택한 대표 장면"}</dd></div>
              <div><dt>화면에서 몸이 향하는 방향</dt><dd>{evidence.capture.facing === 1 ? "오른쪽" : "왼쪽"}</dd></div>
              {result.pending.length > 0 && <div className="report-detail-fact-wide"><dt>추가 확인 항목</dt><dd>{result.pending.map((item) => item.reason).join(" · ")}</dd></div>}
            </dl>
          </section>

          <section className="report-detail-section">
            <div className="report-detail-section-title"><span>04</span><h3>사람이 입력한 작업 조건</h3></div>
            <dl className="report-detail-answers">{(Object.keys(inputLabels) as AnswerName[]).map((name) => <div key={name}>
              <dt>{inputLabels[name]}</dt><dd>{answerText(name, result.inputs[name])}</dd>
            </div>)}</dl>
          </section>

          <section className="report-detail-section">
            <div className="report-detail-section-title"><span>05</span><h3>관절 확인 기록</h3></div>
            <div className="report-detail-points"><div className="report-detail-points-head"><span>관절</span><span>GPT 제안</span><span>사람 확인·수정</span></div>
              {VLM_JOINTS.map((joint) => <div key={joint}><strong>{jointLabels[joint]}</strong><span>{pointText(evidence.originalPoints[joint])}</span><span>{pointText(evidence.reviewedPoints[joint])}</span></div>)}
            </div>
            <p className="report-detail-metadata">모델 {evidence.provenance.model} · 요청 형식 {evidence.provenance.promptVersion} · 응답 시간 {(evidence.provenance.elapsedMs / 1000).toFixed(1)}초</p>
          </section>
        </>}
      </>}
    </div>
  </EvaluationShell>;
}
