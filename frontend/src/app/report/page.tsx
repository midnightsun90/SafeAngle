"use client";

import Link from "next/link";
import EvaluationShell from "@/components/EvaluationShell";
import { useVideoFiles } from "@/components/VideoFilesProvider";
import { formatVideoTime } from "@/lib/video";
import { questionGroups } from "@/lib/questions";
import { sampleResults, sampleRows, videoTitles } from "@/lib/resultData";
import { tableA, tableB, tableC } from "@/lib/rebaTables";

function ReferenceTable({ title, description, data, rowLabel, columnLabels, groupSize, groupLabels, highlight }: {
  title: string;
  description: string;
  data: number[][];
  rowLabel: string;
  columnLabels: string[];
  groupSize?: number;
  groupLabels?: string[];
  highlight?: [number, number];
}) {
  return (
    <section className="report-table-section">
      <h2>{title}</h2>
      <p>{description}</p>
      <div className="report-table-scroll">
        <table className="report-matrix">
          <thead>
            {groupSize && groupLabels && (
              <tr><th scope="col" rowSpan={2}>{rowLabel}</th>{groupLabels.map((label) => <th scope="colgroup" colSpan={groupSize} key={label}>{label}</th>)}</tr>
            )}
            <tr>{!groupSize && <th scope="col">{rowLabel}</th>}{columnLabels.map((label, index) => <th scope="col" key={`${label}-${index}`}>{label}</th>)}</tr>
          </thead>
          <tbody>
            {data.map((row, rowIndex) => (
              <tr key={rowIndex} className={highlight?.[0] === rowIndex ? "report-row-highlight" : ""}>
                <th scope="row">{rowIndex + 1}</th>
                {row.map((value, columnIndex) => <td className={highlight?.[0] === rowIndex && highlight?.[1] === columnIndex ? "report-cell-highlight" : ""} key={columnIndex}>{value}</td>)}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

export default function ReportPage() {
  const { demoMode, resultVideo, selectedTimes, answers } = useVideoFiles();
  const sampleDetails = demoMode && resultVideo === 1;
  const time = demoMode ? sampleResults[resultVideo].time : selectedTimes[resultVideo] !== null ? formatVideoTime(selectedTimes[resultVideo] ?? 0) : "미선택";
  const answer = (key: string) => {
    const value = answers[resultVideo][key];
    if (!value) return "미입력";
    for (const group of Object.values(questionGroups)) {
      const option = group.questions.find((question) => question.key === key)?.options.find((item) => item.value === value);
      if (option) return option.label;
    }
    return "미입력";
  };
  const realRows = [
    { item: "몸통", value: `각도 미측정 · 보정 ${answer("trunk")}`, base: "—", adjustment: "—", score: "—" },
    { item: "목", value: `각도 미측정 · 보정 ${answer("neck")}`, base: "—", adjustment: "—", score: "—" },
    { item: "다리", value: `${answer("legs")} · 지지면 ${answer("unstable")} · 무릎 각도 미측정`, base: "—", adjustment: "—", score: "—" },
    { item: "위팔", value: `각도 미측정 · 벌림·회전 ${answer("arm_abduction")} · 어깨 상승 ${answer("shoulder_raised")} · 지지·중력 도움 ${answer("arm_supported")}`, base: "—", adjustment: "—", score: "—" },
    { item: "아래팔", value: "각도 미측정", base: "—", adjustment: "—", score: "—" },
    { item: "손목", value: `${answer("wrist_angle")} · 꺾임 ${answer("wrist_deviation")}`, base: "—", adjustment: "—", score: "—" },
    { item: "무게·힘", value: `${answer("force")} · 충격 ${answer("impact")}`, base: "—", adjustment: "—", score: "—" },
    { item: "손잡이", value: answer("coupling"), base: "—", adjustment: "—", score: "—" },
    { item: "활동", value: `유지 ${answer("static")} · 반복 ${answer("repeated")} · 변화 ${answer("rapid_change")}`, base: "—", adjustment: "—", score: "—" },
  ];
  const rows = sampleDetails ? sampleRows : realRows;

  return (
    <EvaluationShell step="06" stepName="상세 평가서" title="REBA 상세 평가서" wide introFull beforeIntro={<div className="report-topline">
        <Link href="/results">← 결과 요약으로</Link>
        {demoMode && <span className="sample-badge">시안용 예시</span>}
      </div>}>
      <div className="report-heading">
        <p>영상 {resultVideo} · {videoTitles[resultVideo]} · 선택 장면 {time || "미선택"}{!demoMode && ` · 평가할 팔 ${answer("arm")}`}</p>
        <div className="report-metrics">
          <span>확정 장면 중 최고 점수 <strong>{sampleDetails ? "8점" : "미확정"}</strong></span>
          <span>위험 수준 <strong>{sampleDetails ? "높음" : "미확정"}</strong></span>
          <span>조치 필요성 <strong>{sampleDetails ? "곧 조치 필요" : "확인 필요"}</strong></span>
        </div>
      </div>
      <p className="results-disclaimer">{sampleDetails ? "아래 수치는 이미지 시안의 예시입니다. 실제 영상 분석 결과가 아닙니다." : demoMode ? "이 영상의 상세 항목 예시는 제공되지 않았습니다. 아래 표는 기준표이며 점수는 계산하지 않았습니다." : "각도 측정과 채점 엔진이 연결되지 않아 기본 점수와 최종 점수를 확정할 수 없습니다."}</p>

      <section className="report-items" aria-labelledby="report-items-title">
        <h2 id="report-items-title">항목별 판정 요약</h2>
        <div className="report-table-scroll">
          <table className="report-item-table">
            <thead><tr><th scope="col">항목</th><th scope="col">측정값 · 확인값</th><th scope="col">기본점수</th><th scope="col">보정</th><th scope="col">항목점수</th></tr></thead>
            <tbody>{rows.map((row) => <tr key={row.item}><th scope="row">{row.item}</th><td>{row.value}</td><td>{row.base}</td><td>{row.adjustment}</td><td>{row.score}</td></tr>)}</tbody>
          </table>
        </div>
        <p>선택 장면과 사람이 확인한 값을 함께 기록합니다. 미확인·미측정 항목은 점수로 바꾸지 않습니다.</p>
      </section>

      <section className="report-calculation" aria-label="전체 평가표와 계산 과정">
        <h2>전체 평가표와 계산 과정</h2>
        <p>표 A·B·C의 전체 값을 표시합니다. {sampleDetails ? "주황색 칸은 시안 예시의 경로입니다." : "측정값이 없어 선택된 칸은 없습니다."}</p>
        <ReferenceTable title="Table A · 몸통 × 목·다리" description={sampleDetails ? "몸통 3 · 목 1 · 다리 2 → 선택 값 4" : "몸통·목·다리 점수 확인 후 선택"} data={tableA} rowLabel="몸통" columnLabels={Array.from({ length: 12 }, (_, index) => `다리 ${index % 4 + 1}`)} groupSize={4} groupLabels={["목 1", "목 2", "목 3"]} highlight={sampleDetails ? [2, 1] : undefined} />
        <ReferenceTable title="Table B · 위팔 × 아래팔·손목" description={sampleDetails ? "위팔 3 · 아래팔 1 · 손목 3 → 선택 값 5" : "위팔·아래팔·손목 점수 확인 후 선택"} data={tableB} rowLabel="위팔" columnLabels={Array.from({ length: 6 }, (_, index) => `손목 ${index % 3 + 1}`)} groupSize={3} groupLabels={["아래팔 1", "아래팔 2"]} highlight={sampleDetails ? [2, 2] : undefined} />
        <ReferenceTable title="Table C · 점수 A × 점수 B" description={sampleDetails ? "점수 A 5 · 점수 B 6 → 선택 값 7" : "점수 A·B 확인 후 선택"} data={tableC} rowLabel="점수 A ＼ 점수 B" columnLabels={Array.from({ length: 12 }, (_, index) => String(index + 1))} highlight={sampleDetails ? [4, 5] : undefined} />
        <div className="report-formula">
          <div><strong>점수 A</strong><p>{sampleDetails ? "Table A 4 + 무게·힘 1 → 5" : "표 A + 무게·힘 → 미확정"}</p></div>
          <div><strong>점수 B</strong><p>{sampleDetails ? "Table B 5 + 손잡이 1 → 6" : "표 B + 손잡이 → 미확정"}</p></div>
          <div><strong>최종 점수</strong><p>{sampleDetails ? "Table C 7 + 활동 1 → 8점" : "표 C + 활동 → 미확정"}</p></div>
        </div>
        {sampleDetails && <p className="report-risk">위험 수준: <strong>높음</strong> · 곧 조치 필요</p>}
        <p className="report-source">표 숫자와 조치 수준: <Link href="https://github.com/midnightsun90/SafeAngle/blob/main/docs/evaluation-axes.md">프로젝트 평가축 문서</Link></p>
      </section>
    </EvaluationShell>
  );
}
