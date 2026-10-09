import Link from "next/link";
import type { ReactNode } from "react";

type EvaluationShellProps = {
  step: "01" | "02";
  stepName: string;
  title: string;
  children: ReactNode;
};

export default function EvaluationShell({ step, stepName, title, children }: EvaluationShellProps) {
  return (
    <div className="page">
      <header className="page-header">
        <Link className="brand" href="/" aria-label="SafeAngle 첫 화면">SafeAngle</Link>
        <span className="header-step">{step} / 06</span>
      </header>

      <main className="page-main">
        <section className="work-intro" aria-labelledby="page-title">
          <p className="step-label">{step} / 06 · {stepName}</p>
          <h1 id="page-title">{title}</h1>
        </section>
        {children}
      </main>
    </div>
  );
}
