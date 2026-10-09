"use client";

import { useEffect, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import EvaluationShell from "@/components/EvaluationShell";
import { useVideoFiles } from "@/components/VideoFilesProvider";

import type { WorkContext } from "@/lib/evaluationStore";
const emptyContext: WorkContext = { company: "", worksite: "", task: "" };

export default function Home() {
  const router = useRouter();
  const { activeEvaluation, setWork } = useVideoFiles();
  const [context, setContext] = useState<WorkContext>(emptyContext);

  useEffect(() => { if (activeEvaluation) setContext(activeEvaluation.work); }, [activeEvaluation?.id]);

  function updateField(field: keyof WorkContext, value: string) {
    setContext((current) => ({ ...current, [field]: value }));
  }

  function saveContext(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const next = {
      company: context.company.trim(),
      worksite: context.worksite.trim(),
      task: context.task.trim(),
    };
    if (!next.company || !next.worksite || !next.task) return;

    setWork(next);
    router.push("/upload/1");
  }

  return (
    <EvaluationShell step="01" stepName="회사·작업 정보" title="어떤 작업을 평가하나요?">
        <form className="work-form" onSubmit={saveContext}>
          <div className="field">
            <label htmlFor="company">회사명</label>
            <input
              id="company"
              name="company"
              type="text"
              autoComplete="organization"
              value={context.company}
              onChange={(event) => updateField("company", event.target.value)}
              required
            />
          </div>

          <div className="field">
            <label htmlFor="worksite">사업장·작업 위치</label>
            <input
              id="worksite"
              name="worksite"
              type="text"
              value={context.worksite}
              onChange={(event) => updateField("worksite", event.target.value)}
              required
            />
          </div>

          <div className="field">
            <label htmlFor="task">공정·작업명</label>
            <input
              id="task"
              name="task"
              type="text"
              value={context.task}
              onChange={(event) => updateField("task", event.target.value)}
              required
            />
          </div>

          <button className="next-button" type="submit">다음: 영상 올리기 <span aria-hidden="true">→</span></button>
        </form>
    </EvaluationShell>
  );
}
