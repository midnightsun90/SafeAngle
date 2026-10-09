"use client";

import type { ReactNode } from "react";
import { useEffect } from "react";
import { usePathname } from "next/navigation";
import { useVideoFiles } from "@/components/VideoFilesProvider";

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
  const pathname = usePathname();
  const { activeEvaluation, savePath } = useVideoFiles();
  useEffect(() => { savePath(pathname); }, [pathname, activeEvaluation?.id]);

  return (
    <div className="page">
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
