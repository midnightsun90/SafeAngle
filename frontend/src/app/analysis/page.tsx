"use client";
import Link from "next/link";
import EvaluationShell from "@/components/EvaluationShell";
import { useVideoFiles } from "@/components/VideoFilesProvider";
import { workQuestionKeys } from "@/lib/questions";
export default function AnalysisPage() {
 const { files, answers, demoMode, activeVideos } = useVideoFiles();
 const incomplete = activeVideos.filter(n => !files[n] || workQuestionKeys.some(k => !answers[n][k]));
 return <EvaluationShell step="05" stepName="자세 분석" title={demoMode ? "자세 분석 · 예시 화면" : "분석을 준비하고 있습니다"} description="영상에서 자세를 측정하고 평가할 장면 후보를 찾습니다. 분석이 끝나면 추천 장면과 이유를 확인할 수 있습니다.">
 <div className="analysis-content"><div className="analysis-notice" role="status"><strong>{demoMode ? "예시 화면" : "분석 엔진 연결 대기"}</strong><p>{demoMode ? "실제 분석을 수행하지 않습니다. 다음 화면에서 추천 장면 확인 흐름을 체험할 수 있습니다." : "영상 분석·장면 추천 엔진이 아직 연결되지 않았습니다. 분석 결과를 받기 전에는 추천 장면이나 점수를 표시하지 않습니다."}</p></div>
 <ol className="analysis-stages">{["영상 확인", "자세 측정", "장면 추천"].map((title,index) => <li key={title}><span className="analysis-stage-number">{index+1}</span><strong>{title}</strong><span className="analysis-stage-status">{demoMode ? "예시" : "대기"}</span></li>)}</ol>
 {!demoMode && incomplete.length > 0 && <p role="alert">영상 또는 작업 조건 입력이 필요합니다: 영상 {incomplete.join("·")}</p>}
 {!demoMode && activeVideos.length === 0 && <p role="alert">평가할 작업 영상이 없습니다.</p>}
 <div className="analysis-actions"><Link href="/review">분석 취소 · 영상 확인으로</Link></div>
 {demoMode && <Link className="next-button" href="/confirmation">예시 추천 장면 확인하기 →</Link>}
 </div></EvaluationShell>;
}
