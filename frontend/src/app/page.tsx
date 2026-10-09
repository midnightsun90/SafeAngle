"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import EvaluationShell from "@/components/EvaluationShell";

type WorkContext = {
  company: string;
  worksite: string;
  task: string;
};

const storageKey = "safeangle.recentWorkContexts";
const emptyContext: WorkContext = { company: "", worksite: "", task: "" };

export default function Home() {
  const router = useRouter();
  const [context, setContext] = useState<WorkContext>(emptyContext);
  const [saveError, setSaveError] = useState(false);

  function updateField(field: keyof WorkContext, value: string) {
    setContext((current) => ({ ...current, [field]: value }));
    setSaveError(false);
  }

  function saveContext(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const next = {
      company: context.company.trim(),
      worksite: context.worksite.trim(),
      task: context.task.trim(),
    };
    if (!next.company || !next.worksite || !next.task) return;

    try {
      const stored = JSON.parse(localStorage.getItem(storageKey) ?? "[]");
      const recent: WorkContext[] = Array.isArray(stored) ? stored : [];
      const updated = [
        next,
        ...recent.filter((item) =>
          item.company !== next.company || item.worksite !== next.worksite || item.task !== next.task,
        ),
      ].slice(0, 8);
      localStorage.setItem(storageKey, JSON.stringify(updated));
      router.push("/upload/1");
    } catch {
      setSaveError(true);
    }
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
          {saveError && <p className="form-status form-status-error" role="alert">이 브라우저에 작업 정보를 저장할 수 없습니다. 저장 공간 설정을 확인해 주세요.</p>}
        </form>
    </EvaluationShell>
  );
}
