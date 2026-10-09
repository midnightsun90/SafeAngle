"use client";

import { useEffect, useState, type FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import EvaluationShell from "@/components/EvaluationShell";
import ScenePreview from "@/components/ScenePreview";
import { useVideoFiles, type VideoNumber } from "@/components/VideoFilesProvider";
import { questionGroups, type QuestionGroup } from "@/lib/questions";

export default function QuestionFlow({ videoNumber, groupNumber }: { videoNumber: VideoNumber; groupNumber: QuestionGroup }) {
  const router = useRouter();
  const { files, answers, demoMode, setAnswer, activeVideos } = useVideoFiles();
  const [error, setError] = useState("");
  useEffect(() => { if (groupNumber === 1) router.replace(`/questions/${videoNumber}/2`); }, [groupNumber, videoNumber, router]);
  const group = questionGroups[groupNumber === 1 ? 2 : groupNumber];
  const values = answers[videoNumber];
  const ready = activeVideos.includes(videoNumber) && (demoMode || files[videoNumber]);
  const nextVideo = activeVideos.find((number) => number > videoNumber);

  function continueToNext(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!ready) {
      setError(`영상 ${videoNumber}을 먼저 올려주세요.`);
      return;
    }
    const missing = group.questions.find((question) => !values[question.key]);
    if (missing) {
      setError(`‘${missing.label}’에 답해 주세요. 판단할 수 없다면 ‘확인 불가’를 선택하세요.`);
      document.getElementById(`${videoNumber}-${missing.key}`)?.focus();
      return;
    }
    setError("");
    if (groupNumber < 4) router.push(`/questions/${videoNumber}/${groupNumber + 1}`);
    else if (nextVideo) router.push(`/questions/${nextVideo}/2`);
    else router.push("/analysis");
  }

  return (
    <EvaluationShell
      step="04"
      stepName="작업 조건 입력"
      eyebrow={`04 / 08 · 영상 ${videoNumber} / 3 · Q${groupNumber} ${group.name}`}
      title={group.title}
      description={group.description}
      media={<ScenePreview number={videoNumber} />}
      wide
    >
      {demoMode && <p className="demo-disclaimer">예시 사진으로 보는 질문 화면입니다. 답변과 사진으로 실제 점수를 계산하지 않습니다.</p>}
      {!ready && <p className="question-warning">작업 영상이 없습니다. <Link href="/review">영상 확인 화면으로 돌아가기</Link></p>}
      <form className="question-form" onSubmit={continueToNext} noValidate>
        <div className="question-grid">
          {group.questions.map((question) => (
            <fieldset className="question-field" key={question.key}>
              <legend id={`${videoNumber}-${question.key}`}>{question.label}</legend>
              {question.hint && <p className="question-hint">{question.hint}</p>}
              <div className="question-options">
                {question.options.map((option) => (
                  <label className={`question-option${values[question.key] === option.value ? " question-option-selected" : ""}`} key={option.value}>
                    <input
                      type="radio"
                      name={`${videoNumber}-${question.key}`}
                      value={option.value}
                      checked={values[question.key] === option.value}
                      onChange={() => { setAnswer(videoNumber, question.key, option.value); setError(""); }}
                    />
                    <span>{option.label}</span>
                  </label>
                ))}
              </div>
            </fieldset>
          ))}
        </div>
        <div className="question-footer">
          <p>확인 불가는 0점으로 처리하지 않습니다. 해당 장면은 확정 점수를 낼 수 없습니다.</p>
          {error && <p className="form-status form-status-error" role="alert">{error}</p>}
          <button className="next-button" type="submit">{groupNumber === 4 && !nextVideo ? "분석 진행 화면으로" : "다음 질문으로"}<span aria-hidden="true">→</span></button>
          {demoMode && <Link className="demo-skip" href="/analysis">예시 분석 화면 바로 보기</Link>}
        </div>
      </form>
    </EvaluationShell>
  );
}
