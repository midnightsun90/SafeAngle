"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { useVideoFiles, type VideoNumber } from "@/components/VideoFilesProvider";
import { demoImages } from "@/lib/demoImages";
import { formatVideoTime } from "@/lib/video";

export default function ScenePreview({ number }: { number: VideoNumber }) {
  const { files, selectedTimes, demoMode } = useVideoFiles();
  const file = files[number];
  const selectedTime = selectedTimes[number];
  const videoRef = useRef<HTMLVideoElement>(null);
  const [videoUrl, setVideoUrl] = useState<string | null>(null);

  useEffect(() => {
    const video = videoRef.current;
    if (video && video.readyState >= 1 && selectedTime !== null) video.currentTime = selectedTime;
  }, [selectedTime]);

  useEffect(() => {
    if (!file || demoMode) return;
    const url = URL.createObjectURL(file);
    setVideoUrl(url);
    return () => {
      setVideoUrl(null);
      URL.revokeObjectURL(url);
    };
  }, [file, demoMode]);

  return (
    <div className="scene-preview">
      {demoMode ? (
        <Image src={demoImages[number]} alt={`영상 ${number} 작업 예시 사진`} fill unoptimized sizes="370px" />
      ) : file ? (
        <video
          ref={videoRef}
          src={videoUrl ?? undefined}
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
      {(demoMode || selectedTime !== null) && (
        <span className="scene-preview-caption">영상 {number} · {demoMode ? "예시 사진" : formatVideoTime(selectedTime ?? 0)}</span>
      )}
    </div>
  );
}
