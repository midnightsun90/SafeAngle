"use client";

import { useState, type FormEvent } from "react";

type WorkContext = {
  company: string;
  worksite: string;
  task: string;
};

const storageKey = "safeangle.recentWorkContexts";
const emptyContext: WorkContext = { company: "", worksite: "", task: "" };

export default function Home() {
  const [context, setContext] = useState<WorkContext>(emptyContext);
  const [saved, setSaved] = useState(false);

  function updateField(field: keyof WorkContext, value: string) {
    setContext((current) => ({ ...current, [field]: value }));
    setSaved(false);
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
      setSaved(true);
    } catch {
      setSaved(false);
    }
  }

  return (
    <div className="page">
      <header className="page-header">
        <a className="brand" href="." aria-label="SafeAngle 첫 화면">SafeAngle</a>
        <span className="header-step">01 / 06</span>
      </header>

      <main className="page-main">
        <section className="work-intro" aria-labelledby="page-title">
          <p className="step-label">01 / 06 · 회사·작업 정보</p>
          <h1 id="page-title">어떤 작업을 평가하나요?</h1>
        </section>

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
          {saved && <p className="save-status" role="status">회사·작업 정보를 저장했습니다. 영상 올리기 화면은 준비 중입니다.</p>}
        </form>
      </main>
    </div>
  );
}
