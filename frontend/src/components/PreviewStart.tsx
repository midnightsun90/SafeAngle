"use client";

import { useEffect, useRef } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useVideoFiles } from "@/components/VideoFilesProvider";

export default function PreviewStart() {
  const pathname = usePathname();
  const router = useRouter();
  const { ready, startDemo } = useVideoFiles();
  const started = useRef(false);

  useEffect(() => {
    if (process.env.NODE_ENV !== "development" || !ready || pathname !== "/" || started.current) return;
    started.current = true;
    startDemo();
    router.replace("/review");
  }, [pathname, ready, router, startDemo]);

  return null;
}
