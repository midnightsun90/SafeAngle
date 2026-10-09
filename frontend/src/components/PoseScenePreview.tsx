"use client";

import { useEffect, useRef } from "react";
import { useVideoSource } from "@/components/useVideoSource";
import type { VideoNumber } from "@/components/VideoFilesProvider";

export default function PoseScenePreview({ number, timeSec }: { number: VideoNumber; timeSec: number | null }) {
  const { src, error } = useVideoSource(number);
  const videoRef = useRef<HTMLVideoElement>(null);
  useEffect(() => {
    const video = videoRef.current;
    if (video && video.readyState >= 1 && timeSec !== null) video.currentTime = timeSec;
  }, [timeSec, src]);
  return <div className="scene-preview">
    <video ref={videoRef} src={src ?? undefined} crossOrigin="anonymous" controls playsInline preload="metadata" aria-label={`영상 ${number} 자동 측정 장면`}
      onLoadedMetadata={() => { if (videoRef.current && timeSec !== null) videoRef.current.currentTime = timeSec; }} />
    {error && <p role="alert">{error}</p>}
  </div>;
}
