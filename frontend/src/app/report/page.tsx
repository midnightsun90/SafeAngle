"use client";

import Link from "next/link";
import EvaluationShell from "@/components/EvaluationShell";
import ScenePreview from "@/components/ScenePreview";
import { useVideoFiles } from "@/components/VideoFilesProvider";
import { formatVideoTime } from "@/lib/video";
import { sampleResults, sampleRows, videoTitles } from "@/lib/resultData";
import { tableA, tableB, tableC } from "@/lib/rebaTables";
import type { AnswerName } from "../../../../lib/reba/types.ts";
import type { PartName } from "../../../../lib/types.ts";

function ReferenceTable({ title, description, data, rowLabel, columnLabels, groupSize, groupLabels, highlight }: {
  title: string;
  description: string;
  data: readonly (readonly number[])[];
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
  const { demoMode, confirmedScenes, resultVideo, selectedTimes, rebaResults } = useVideoFiles();
  const sampleDetails = demoMode && confirmedScenes[resultVideo] && resultVideo === 1;
  const real=demoMode?null:rebaResults[resultVideo];
  const time = demoMode ? sampleResults[resultVideo].time : selectedTimes[resultVideo] !== null ? formatVideoTime(selectedTimes[resultVideo] ?? 0) : "미선택";
  const answer = (key: AnswerName) => {
    const field=real?.inputs[key];
    if(!field||field.state==="unknown")return "미확인";
    if(field.state==="unavailable")return "확인 불가";
    if(field.state==="not_applicable")return "해당 없음";
    return typeof field.value==="boolean"?field.value?"예":"아니요":String(field.value);
  };
  const points=(value:number|null|undefined)=>value==null?"미확인":String(value);
  const labels:Record<PartName,string>={trunk:"몸통",neck:"목",knee:"다리·무릎",upperArm:"위팔",lowerArm:"아래팔",wrist:"손목"};
  const realRows=(Object.keys(labels) as PartName[]).map(part=>{
    const p=real?.parts[part];
    return {item:labels[part],value:p?`${p.measurement.value===null?"측정 불가":p.measurement.value.toFixed(1)+"°"}${p.measurement.approximate?" (근사)":""} · 기본 ${p.source==="human"?"사람 확인":p.source==="vlm"?"GPT 좌표·사람 확인":p.source==="video"?"영상 측정":"미확인"} · ${p.evidenceIds.join(", ")} ${p.notes.join(" ")}`:"장면·입력 확인 필요",base:points(p?.base),adjustment:points(p?.adjustment),score:points(p?.score)};
  });
  realRows.push(
    {item:"무게·힘",value:`사람 확인 ${answer("loadKg")} kg/kgf · 충격 ${answer("shock")}`,base:"해당 없음",adjustment:points(real?.load),score:points(real?.load)},
    {item:"손잡이",value:real?.inputs.coupling.state==="confirmed"?`사람 확인 ${{good:"양호",fair:"보통",poor:"나쁨",unacceptable:"안전한 쥐기 불가"}[real.inputs.coupling.value]}`:answer("coupling"),base:"해당 없음",adjustment:points(real?.coupling),score:points(real?.coupling)},
    {item:"활동",value:`사람 확인 정지 ${answer("staticMinutes")}분 · 반복 ${answer("repeatsPerMinute")}회/분 · 보행 ${answer("repetitionIsWalking")} · 변화 ${answer("rapidChange")} · 불안정 ${answer("unstable")}`,base:"해당 없음",adjustment:points(real?.activity),score:points(real?.activity)}
  );
  const rows = sampleDetails ? sampleRows : realRows;
  const aHighlight: [number,number]|undefined=real?.tableA!=null?[real.parts.trunk.score!-1,(real.parts.neck.score!-1)*4+real.parts.knee.score!-1]:undefined;
  const bHighlight: [number,number]|undefined=real?.tableB!=null?[real.parts.upperArm.score!-1,(real.parts.lowerArm.score!-1)*3+real.parts.wrist.score!-1]:undefined;
  const cHighlight: [number,number]|undefined=real?.tableC!=null?[real.scoreA!-1,real.scoreB!-1]:undefined;

  return (
    <EvaluationShell step="07" stepName="상세 평가서" title="REBA 상세 평가서" wide introFull beforeIntro={<div className="report-topline">
        <Link className="confirmation-soft-button" href="/results">← 결과 요약으로</Link>
        {demoMode && <span className="sample-badge">시안용 예시</span>}
      </div>}>
      <div className="report-heading">
        <p>영상 {resultVideo} · {videoTitles[resultVideo]} · 선택 장면 {time || "미선택"}{!demoMode && ` · ${real?real.scene.side==="left"?"왼쪽":"오른쪽":"쪽 미선택"}`}</p>
        <div className="report-metrics">
          <span>선택한 장면의 점수 <strong id="report-final">{sampleDetails ? "8점" : real?.final!=null?`${real.final}점`:"미확정"}</strong></span>
          <span>위험 수준 <strong>{sampleDetails ? "높음" : real?.action?.risk??"미확정"}</strong></span>
          <span>조치 필요성 <strong>{sampleDetails ? "곧 조치 필요" : real?.action?.action??"확인 필요"}</strong></span>
        </div>
      </div>
      <p className="results-disclaimer">{sampleDetails ? "아래 수치는 이미지 시안의 예시입니다. 실제 영상 분석 결과가 아닙니다." : demoMode ? "이 영상의 상세 항목 예시는 제공되지 않았습니다. 아래 표는 기준표이며 점수는 계산하지 않았습니다." : "같은 영상·장면·쪽의 원본 측정과 사람 확인만 사용합니다. 확인 전에는 최종 점수를 내지 않습니다. 법적 부담작업 해당 여부는 미확인, 유해요인조사 전체는 미완료입니다."}</p>
      {real&&real.final===null&&<p className="result-note">필수 확인 {real.pending.length}개가 남았습니다. 영상 평가 화면에서 현장 조건과 보이는 부위를 확인하십시오.</p>}

      {real?.evidence&&<section className="report-table-section" aria-label="GPT 관절 근거"><h2>대표 장면과 관절 확인 기록</h2>
        <p>{real.evidence.provenance.model} · {real.evidence.provenance.promptVersion} · {real.scene.timeSec.toFixed(2)}초 · {real.scene.side==="left"?"왼쪽":"오른쪽"}. 좌표는 이미지의 왼쪽 위를 기준으로 한 비율이며, 각도는 확인 후 코드로 계산했습니다.</p>
        {real.evidence.imageDataUrl ? <img src={real.evidence.imageDataUrl} alt="평가에 사용한 실제 대표 장면" style={{width:"min(100%, 560px)",height:"auto"}}/> : <ScenePreview number={resultVideo} />}
        <div className="report-table-scroll"><table className="report-item-table"><thead><tr><th>관절</th><th>GPT 원 제안 (x, y)</th><th>사람 확인·수정 (x, y)</th></tr></thead><tbody>{Object.entries(real.evidence.reviewedPoints).map(([name,p])=>{const before=real.evidence!.originalPoints[name as keyof typeof real.evidence.originalPoints];const format=(point:typeof p)=>point?`${point.x.toFixed(4)}, ${point.y.toFixed(4)}`:"관측 불가";return <tr key={name}><th>{name}</th><td>{format(before)}</td><td>{format(p)}</td></tr>;})}</tbody></table></div>
      </section>}

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
        <p>표 A·B·C의 전체 값을 표시합니다. {sampleDetails ? "주황색 칸은 시안 예시의 경로입니다." : "확인된 부위·그룹 점수의 조회 칸만 표시합니다."}</p>
        <ReferenceTable title="Table A · 몸통 × 목·다리" description={sampleDetails ? "몸통 3 · 목 1 · 다리 2 → 선택 값 4" : `몸통 ${points(real?.parts.trunk.score)} · 목 ${points(real?.parts.neck.score)} · 다리 ${points(real?.parts.knee.score)} → ${points(real?.tableA)}`} data={tableA} rowLabel="몸통" columnLabels={Array.from({ length: 12 }, (_, index) => `다리 ${index % 4 + 1}`)} groupSize={4} groupLabels={["목 1", "목 2", "목 3"]} highlight={sampleDetails ? [2, 1] : aHighlight} />
        <ReferenceTable title="Table B · 위팔 × 아래팔·손목" description={sampleDetails ? "위팔 3 · 아래팔 1 · 손목 3 → 선택 값 5" : `위팔 ${points(real?.parts.upperArm.score)} · 아래팔 ${points(real?.parts.lowerArm.score)} · 손목 ${points(real?.parts.wrist.score)} → ${points(real?.tableB)}`} data={tableB} rowLabel="위팔" columnLabels={Array.from({ length: 6 }, (_, index) => `손목 ${index % 3 + 1}`)} groupSize={3} groupLabels={["아래팔 1", "아래팔 2"]} highlight={sampleDetails ? [2, 2] : bHighlight} />
        <ReferenceTable title="Table C · 점수 A × 점수 B" description={sampleDetails ? "점수 A 5 · 점수 B 6 → 선택 값 7" : `점수 A ${points(real?.scoreA)} · 점수 B ${points(real?.scoreB)} → ${points(real?.tableC)}`} data={tableC} rowLabel="점수 A ＼ 점수 B" columnLabels={Array.from({ length: 12 }, (_, index) => String(index + 1))} highlight={sampleDetails ? [4, 5] : cHighlight} />
        <div className="report-formula">
          <div><strong>점수 A</strong><p>{sampleDetails ? "Table A 4 + 무게·힘 1 → 5" : `표 A ${points(real?.tableA)} + 무게·힘 ${points(real?.load)} → ${points(real?.scoreA)}`}</p></div>
          <div><strong>점수 B</strong><p>{sampleDetails ? "Table B 5 + 손잡이 1 → 6" : `표 B ${points(real?.tableB)} + 손잡이 ${points(real?.coupling)} → ${points(real?.scoreB)}`}</p></div>
          <div><strong>최종 점수</strong><p>{sampleDetails ? "Table C 7 + 활동 1 → 8점" : `표 C ${points(real?.tableC)} + 활동 ${points(real?.activity)} → ${points(real?.final)}`}</p></div>
        </div>
        {sampleDetails && <p className="report-risk">위험 수준: <strong>높음</strong> · 곧 조치 필요</p>}
        <p className="report-source">표 숫자와 조치 수준: <Link href="https://github.com/midnightsun90/SafeAngle/blob/main/docs/evaluation-axes.md">프로젝트 평가축 문서</Link></p>
      </section>
    </EvaluationShell>
  );
}
