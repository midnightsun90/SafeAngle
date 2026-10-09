"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useVideoFiles } from "@/components/VideoFilesProvider";

export default function EvaluationPage() {
  const router = useRouter();
  const { ready, activeEvaluation } = useVideoFiles();

  useEffect(() => {
    if (ready) router.replace(activeEvaluation ? "/upload/1" : "/");
  }, [ready, activeEvaluation, router]);

  return null;
}
