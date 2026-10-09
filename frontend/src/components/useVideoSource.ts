"use client";

import { useEffect, useState } from "react";
import { useVideoFiles, type VideoNumber } from "./VideoFilesProvider";
import { supabase } from "@/lib/supabaseClient";
import { videoBucket } from "@/lib/videoStorage";

export function useVideoSource(number: VideoNumber) {
  const { files, storedVideos, demoMode } = useVideoFiles();
  const file = files[number];
  const path = storedVideos[number]?.storage_path;
  const [src, setSrc] = useState<string | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    if (demoMode) return;
    setSrc(null);
    setError("");
    if (file) {
      const url = URL.createObjectURL(file);
      setSrc(url);
      return () => URL.revokeObjectURL(url);
    }
    if (!path || !supabase) return;

    let active = true;
    let refresh: number | undefined;
    async function sign() {
      const { data, error: signError } = await supabase!.storage.from(videoBucket).createSignedUrl(path!, 3600);
      if (!active) return;
      if (signError) { setError("저장된 영상을 불러오지 못했습니다. 새로고침해 주세요."); return; }
      setSrc(data.signedUrl);
      refresh = window.setTimeout(sign, 50 * 60 * 1000);
    }
    void sign();
    return () => { active = false; window.clearTimeout(refresh); };
  }, [file, path, demoMode]);

  return { src, error };
}
