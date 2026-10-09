"use client";
import { useState } from "react";
import Link from "next/link";
import EvaluationShell from "@/components/EvaluationShell";
import EvaluationFlow from "@/components/EvaluationFlow";

export default function ReviewPage(){
  const [stage,setStage]=useState(3);
  return <EvaluationShell step={String(stage).padStart(2,"0") as "03"|"04"|"06"} stepName={stage===6?"REBA 결과":stage===4?"확인 질문":"영상·장면 확인"} title="선택한 장면을 평가합니다.">
    <Link className="review-link" href="/upload/1">영상 등록으로 돌아가기 (현재 분석·답변 초기화)</Link>
    <EvaluationFlow onStage={setStage}/>
  </EvaluationShell>;
}
