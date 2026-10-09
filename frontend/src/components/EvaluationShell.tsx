import Link from "next/link";
import type { ReactNode } from "react";

type EvaluationShellProps = {
  step: "01" | "02" | "03" | "04" | "05" | "06";
  stepName: string;
  title: string;
  description?: string;
  eyebrow?: string;
  media?: ReactNode;
  wide?: boolean;
  introFull?: boolean;
  beforeIntro?: ReactNode;
  children: ReactNode;
};

export default function EvaluationShell({ step, stepName, title, description, eyebrow, media, wide = false, introFull = false, beforeIntro, children }: EvaluationShellProps) {
  return (
    <div className="page">
      <header className="page-header">
        <Link className="brand" href="/" aria-label="SafeAngle 첫 화면">SafeAngle</Link>
        <span className="header-step">{step} / 06</span>
      </header>

      <main className={`page-main${wide ? " page-main-wide" : ""}${introFull ? " page-main-intro-full" : ""}`}>
        {beforeIntro}
        <section className={`work-intro${media ? " work-intro-media" : ""}`} aria-labelledby="page-title">
          {media}
          <div>
            <p className="step-label">{eyebrow ?? `${step} / 06 · ${stepName}`}</p>
            <h1 id="page-title">{title}</h1>
            {description && <p className="page-description">{description}</p>}
          </div>
        </section>
        {children}
      </main>
    </div>
  );
}
