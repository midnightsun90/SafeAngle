"use client";

import { useEffect, useRef } from "react";
import { usePathname, useRouter } from "next/navigation";
import { previewRealKey, useVideoFiles } from "@/components/VideoFilesProvider";

export default function PreviewStart() {
  const pathname = usePathname();
  const router = useRouter();
  const { ready, startDemo } = useVideoFiles();
  const started = useRef(false);

  useEffect(() => {
    if (process.env.NODE_ENV !== "development" || !ready || pathname !== "/" || started.current) return;
    try { if (sessionStorage.getItem(previewRealKey) === "1") return; } catch { /* Show the example preview. */ }
    started.current = true;
    startDemo();
    router.replace("/output-preview");
  }, [pathname, ready, router, startDemo]);

  return null;
}
