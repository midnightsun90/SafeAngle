"use client";

import { useEffect, useRef } from "react";
import Image from "next/image";
import Link from "next/link";
import { useVideoFiles, type VideoNumber } from "@/components/VideoFilesProvider";
import { demoImages } from "@/lib/demoImages";
import { formatVideoTime } from "@/lib/video";
import { useVideoSource } from "@/components/useVideoSource";

export default function ScenePreview({ number }: { number: VideoNumber }) {
  const { files, storedVideos, selectedTimes, demoMode } = useVideoFiles();
  const file = files[number];
  const storedVideo = storedVideos[number];
  const { src, error } = useVideoSource(number);
  const selectedTime = selectedTimes[number];
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    const video = videoRef.current;
    if (video && video.readyState >= 1 && selectedTime !== null) video.currentTime = selectedTime;
  }, [selectedTime]);

  return (
    <div className="scene-preview">
      {demoMode ? (
        <Image src={demoImages[number]} alt={`영상 ${number} 작업 예시 사진`} fill unoptimized sizes="370px" />
      ) : file || storedVideo ? (
        <video
          ref={videoRef}
          src={src ?? undefined}
          controls
          playsInline
          preload="metadata"
          aria-label={`영상 ${number} 선택 장면`}
          onLoadedMetadata={() => {
            const video = videoRef.current;
            if (video && selectedTime !== null) video.currentTime = selectedTime;
          }}
        />
      ) : (
        <div className="scene-preview-empty"><Link href={`/upload/${number}`}>영상 {number} 선택하기</Link></div>
      )}
      {error && <p role="alert">{error}</p>}
      {(demoMode || selectedTime !== null) && (
        <span className="scene-preview-caption">영상 {number} · {demoMode ? "예시 사진" : formatVideoTime(selectedTime ?? 0)}</span>
      )}
    </div>
  );
}
