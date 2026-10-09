"use client";

import { useState } from "react";
import AngleBar, { angleParts } from "@/components/AngleBar";
import "@/components/AngleBar.css";
import "./preview.css";

type Side = "left" | "right";
type ExampleJudgment = "좋음" | "나쁨" | "확인 필요";
type Reading = { value: number | null; judgment: ExampleJudgment };
type Measurement = { name: string; note: string; left: Reading; right: Reading };
type ExampleVideo = {
  number: 1 | 2 | 3;
  title: string;
  time: string;
  side: Side;
  quality: { label: string; value: string }[];
  measurements: Measurement[];
  answers: { label: string; value: string }[];
  unresolved: string;
};

const measured = (value: number, judgment: ExampleJudgment): Reading => ({ value, judgment });
const unavailable: Reading = { value: null, judgment: "확인 필요" };

const videos: ExampleVideo[] = [
  {
    number: 1,
    title: "물체를 들어 옮기는 작업",
    time: "00:12.4",
    side: "right",
    quality: [
      { label: "영상 길이", value: "25.6초" },
      { label: "분석 간격", value: "0.1초" },
      { label: "선택 장면 인물", value: "1명" },
      { label: "화면상 방향", value: "오른쪽" },
      { label: "한 부위 이상 측정된 장면", value: "93%" },
      { label: "선택 장면 추적 경고", value: "없음" },
    ],
    measurements: [
      { name: "목", note: "몸통 대비 기울기 · 근사", left: measured(16, "좋음"), right: measured(18, "좋음") },
      { name: "몸통", note: "수직축 대비 기울기", left: measured(42, "나쁨"), right: measured(47, "나쁨") },
      { name: "무릎", note: "곧게 펴면 0°", left: measured(34, "좋음"), right: measured(72, "나쁨") },
      { name: "위팔", note: "몸통 대비 각도", left: measured(25, "좋음"), right: measured(68, "나쁨") },
      { name: "팔꿈치", note: "굽힘 각도 · 곧게 펴면 0°", left: measured(87, "좋음"), right: measured(81, "좋음") },
      { name: "손목", note: "굽힘 각도 · 근사", left: measured(11, "좋음"), right: unavailable },
    ],
    answers: [
      { label: "평가할 팔", value: "오른쪽" },
      { label: "목 비틀림", value: "없음" },
      { label: "목 옆 기울임", value: "없음" },
      { label: "몸통 비틀림", value: "없음" },
      { label: "몸통 옆 기울임", value: "없음" },
      { label: "다리 지지", value: "한쪽 다리 지지" },
      { label: "발밑 지지면 불안정", value: "없음" },
      { label: "위팔 벌림·회전", value: "있음" },
      { label: "어깨 상승", value: "없음" },
      { label: "물체 무게", value: "7 kg · 사람 입력" },
      { label: "팔 지지", value: "없음 · 사람 입력" },
      { label: "손목 굽힘·젖힘 구간", value: "확인 불가" },
      { label: "손목 옆 꺾임·회전", value: "확인 불가" },
      { label: "충격·갑작스러운 힘", value: "없음" },
      { label: "손잡이", value: "보통 · 사람 입력" },
      { label: "1분 초과 같은 자세 유지", value: "없음" },
      { label: "분당 4회 초과 작은 반복", value: "있음 · 사람 입력" },
      { label: "빠르고 큰 자세 변화", value: "있음 · 사람 입력" },
    ],
    unresolved: "오른쪽 손목이 가려져 각도를 측정하지 못했습니다. 이 항목은 사람 확인이 필요합니다.",
  },
  {
    number: 2,
    title: "앉아서 손으로 하는 작업",
    time: "00:09.1",
    side: "right",
    quality: [
      { label: "영상 길이", value: "23.2초" },
      { label: "분석 간격", value: "0.1초" },
      { label: "선택 장면 인물", value: "1명" },
      { label: "화면상 방향", value: "오른쪽" },
      { label: "한 부위 이상 측정된 장면", value: "95%" },
      { label: "선택 장면 추적 경고", value: "없음" },
    ],
    measurements: [
      { name: "목", note: "몸통 대비 기울기 · 근사", left: measured(14, "좋음"), right: measured(17, "좋음") },
      { name: "몸통", note: "수직축 대비 기울기", left: measured(13, "좋음"), right: measured(15, "좋음") },
      { name: "무릎", note: "앉은 자세 · 각도 참고", left: measured(81, "확인 필요"), right: measured(86, "확인 필요") },
      { name: "위팔", note: "몸통 대비 각도", left: measured(22, "좋음"), right: measured(31, "나쁨") },
      { name: "팔꿈치", note: "굽힘 각도 · 곧게 펴면 0°", left: measured(74, "좋음"), right: measured(77, "좋음") },
      { name: "손목", note: "굽힘 각도 · 근사", left: measured(17, "확인 필요"), right: measured(24, "확인 필요") },
    ],
    answers: [
      { label: "평가할 팔", value: "오른쪽" },
      { label: "목 비틀림", value: "없음" },
      { label: "목 옆 기울임", value: "없음" },
      { label: "몸통 비틀림", value: "없음" },
      { label: "몸통 옆 기울임", value: "없음" },
      { label: "다리 지지", value: "앉음 · 사람 입력" },
      { label: "발밑 지지면 불안정", value: "해당 없음" },
      { label: "위팔 벌림·회전", value: "없음" },
      { label: "어깨 상승", value: "없음" },
      { label: "팔 지지", value: "있음 · 사람 입력" },
      { label: "손목 굽힘·젖힘 구간", value: "15° 초과 · 사람 확인" },
      { label: "손목 옆 꺾임·회전", value: "없음" },
      { label: "물체 무게·실제 힘", value: "5 kg 미만 · 사람 입력" },
      { label: "충격·갑작스러운 힘", value: "없음" },
      { label: "손잡이", value: "잡을 물체 없음" },
      { label: "1분 초과 같은 자세 유지", value: "있음 · 사람 입력" },
      { label: "분당 4회 초과 작은 반복", value: "있음 · 사람 입력" },
      { label: "빠르고 큰 자세 변화", value: "없음" },
    ],
    unresolved: "손목 각도는 근삿값입니다. 손가락 움직임과 실제 작업 반복 횟수는 이 각도로 확정할 수 없습니다.",
  },
  {
    number: 3,
    title: "물체를 밀거나 당기는 작업",
    time: "00:16.8",
    side: "left",
    quality: [
      { label: "영상 길이", value: "21.8초" },
      { label: "분석 간격", value: "0.1초" },
      { label: "선택 장면 인물", value: "1명" },
      { label: "화면상 방향", value: "왼쪽" },
      { label: "한 부위 이상 측정된 장면", value: "87%" },
      { label: "선택 장면 추적 경고", value: "없음" },
    ],
    measurements: [
      { name: "목", note: "몸통 대비 기울기 · 근사", left: measured(11, "좋음"), right: measured(12, "좋음") },
      { name: "몸통", note: "수직축 대비 기울기", left: measured(29, "나쁨"), right: measured(34, "나쁨") },
      { name: "무릎", note: "곧게 펴면 0°", left: measured(28, "좋음"), right: measured(42, "나쁨") },
      { name: "위팔", note: "몸통 대비 각도", left: measured(40, "나쁨"), right: measured(58, "나쁨") },
      { name: "팔꿈치", note: "굽힘 각도 · 곧게 펴면 0°", left: measured(62, "좋음"), right: measured(71, "좋음") },
      { name: "손목", note: "굽힘 각도 · 근사", left: measured(8, "확인 필요"), right: measured(13, "확인 필요") },
    ],
    answers: [
      { label: "평가할 팔", value: "왼쪽" },
      { label: "목 비틀림", value: "없음" },
      { label: "목 옆 기울임", value: "없음" },
      { label: "몸통 비틀림", value: "확인 불가" },
      { label: "몸통 옆 기울임", value: "없음" },
      { label: "다리 지지", value: "양발 지지 · 사람 입력" },
      { label: "발밑 지지면 불안정", value: "없음" },
      { label: "위팔 벌림·회전", value: "확인 불가" },
      { label: "어깨 상승", value: "없음" },
      { label: "팔 지지", value: "없음" },
      { label: "손목 굽힘·젖힘 구간", value: "0~15° · 사람 확인" },
      { label: "손목 옆 꺾임·회전", value: "확인 불가" },
      { label: "실제 미는 힘", value: "확인 불가 · 사람 입력" },
      { label: "충격·갑작스러운 힘", value: "없음" },
      { label: "손잡이", value: "보통 · 사람 입력" },
      { label: "1분 초과 같은 자세 유지", value: "없음" },
      { label: "분당 4회 초과 작은 반복", value: "없음" },
      { label: "빠르고 큰 자세 변화", value: "있음 · 사람 입력" },
    ],
    unresolved: "영상만으로 실제 미는 힘을 알 수 없습니다. 수레의 무게를 힘으로 바꾸어 표시하지 않습니다.",
  },
];

export default function OutputPreviewPage() {
  const [videoNumber, setVideoNumber] = useState<1 | 2 | 3>(1);
  const [side, setSide] = useState<Side>(videos[0].side);
  const video = videos.find((item) => item.number === videoNumber)!;

  function selectVideo(next: ExampleVideo) {
    setVideoNumber(next.number);
    setSide(next.side);
  }

  return (
    <div className="output-preview">
      <header className="output-preview-header">
        <strong>SafeAngle<span>.</span></strong>
        <span>결과 화면 미리보기</span>
      </header>

      <main className="output-preview-main">
        <p className="output-preview-eyebrow">예시 데이터 · 실제 분석 아님</p>
        <h1>작업 자세 측정 결과</h1>
        <p className="output-preview-lead">영상마다 선택한 한 장면의 각도와 사람이 확인한 작업 조건을 보여줍니다.</p>
        <div className="output-preview-notice" role="note">
          이 화면의 숫자와 좋음·나쁨 표시는 가상 예시입니다. 실제 결과 화면에는 영상에서 측정한 각도가 표시되며, 항목별 좋음·나쁨 판정은 아직 적용하지 않았습니다.
        </div>

        <section className="output-preview-section" aria-labelledby="output-preview-video-heading">
          <div className="output-preview-section-heading">
            <h2 id="output-preview-video-heading">영상별 결과</h2>
            <span>전체 점수 없음</span>
          </div>
          <div className="output-preview-video-list" aria-label="영상 선택">
            {videos.map((item) => (
              <button className={item.number === videoNumber ? "output-preview-video output-preview-video-active" : "output-preview-video"} type="button" key={item.number} onClick={() => selectVideo(item)} aria-pressed={item.number === videoNumber}>
                <span className="output-preview-video-number">0{item.number}</span>
                <strong>{item.title}</strong>
                <small>선택 장면 {item.time}</small>
                <span className="output-preview-video-arrow" aria-hidden="true">→</span>
              </button>
            ))}
          </div>
        </section>

        <section className="output-preview-detail" aria-labelledby="output-preview-detail-heading">
          <div className="output-preview-detail-heading">
            <div>
              <p>영상 0{video.number} / 선택 장면 {video.time}</p>
              <h2 id="output-preview-detail-heading">{video.title}</h2>
            </div>
            <div className="output-preview-side" aria-label="측정값 좌우 선택">
              <button type="button" aria-pressed={side === "left"} onClick={() => setSide("left")}>왼쪽</button>
              <button type="button" aria-pressed={side === "right"} onClick={() => setSide("right")}>오른쪽</button>
            </div>
          </div>
          <p className="output-preview-side-note">사람 기준 {side === "left" ? "왼쪽" : "오른쪽"} 측정값 · 같은 장면의 값만 표시</p>

          <div className="output-preview-table-scroll">
            <table className="output-preview-table">
              <thead><tr><th scope="col">측정 항목</th><th scope="col">각도 위치</th><th scope="col">엔진 출력 예시</th><th scope="col">판정 예시</th></tr></thead>
              <tbody>
                {video.measurements.map((item) => {
                  const reading = item[side];
                  return <tr key={item.name}>
                    <th scope="row"><strong>{item.name}</strong><small>{item.note}</small></th>
                    <td><AngleBar value={reading.value} min={angleParts.find((part) => part.label === item.name)?.min ?? 0} max={angleParts.find((part) => part.label === item.name)?.max ?? 180} /></td>
                    <td className="output-preview-value">{reading.value === null ? "측정 불가" : `${reading.value}°`}</td>
                    <td><span className={`output-preview-judgment output-preview-judgment-${reading.judgment === "좋음" ? "good" : reading.judgment === "나쁨" ? "bad" : "review"}`}>{reading.judgment}</span></td>
                  </tr>;
                })}
              </tbody>
            </table>
          </div>

          <section className="output-preview-quality" aria-labelledby="output-preview-quality-heading">
            <div className="output-preview-section-heading"><h3 id="output-preview-quality-heading">영상·측정 상태</h3><span>자세 판정이 아닌 측정 정보</span></div>
            <dl>{video.quality.map((item) => <div key={item.label}><dt>{item.label}</dt><dd>{item.value}</dd></div>)}</dl>
          </section>

          <div className="output-preview-bottom">
            <section aria-labelledby="output-preview-answers-heading">
              <details className="output-preview-answers">
                <summary id="output-preview-answers-heading">사람이 확인한 조건 전체 보기 <span>{video.answers.length}항목</span></summary>
                <dl>{video.answers.map((answer) => <div key={answer.label}><dt>{answer.label}</dt><dd>{answer.value}</dd></div>)}</dl>
              </details>
            </section>
            <section aria-labelledby="output-preview-check-heading">
              <h3 id="output-preview-check-heading">확인할 항목</h3>
              <p>{video.unresolved}</p>
              <small>측정 불가와 확인 불가는 0° 또는 좋음으로 바꾸지 않습니다.</small>
            </section>
          </div>
        </section>
      </main>
    </div>
  );
}
