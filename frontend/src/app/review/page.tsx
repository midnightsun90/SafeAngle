"use client";

import { useEffect, useRef, useState, type ChangeEvent } from "react";
import Link from "next/link";
import Image from "next/image";
import { useRouter } from "next/navigation";
import EvaluationShell from "@/components/EvaluationShell";
import { useVideoFiles, type VideoNumber } from "@/components/VideoFilesProvider";
import { formatVideoTime, isVideoFile } from "@/lib/video";
import { demoImages } from "@/lib/demoImages";
import { uploadCopy } from "@/lib/uploadCopy";

const videos: { number: VideoNumber; title: string }[] = [
  { number: 1, title: uploadCopy[1].title },
  { number: 2, title: uploadCopy[2].title },
  { number: 3, title: uploadCopy[3].title },
];

function ReviewVideo({ number, title }: { number: VideoNumber; title: string }) {
  const { files, selectedTimes, demoMode, setFile, setSelectedTime } = useVideoFiles();
  const file = files[number];
  const selectedTime = selectedTimes[number];
  const videoRef = useRef<HTMLVideoElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!file) return;
    const url = URL.createObjectURL(file);
    setVideoUrl(url);
    return () => {
      setVideoUrl(null);
      URL.revokeObjectURL(url);
    };
  }, [file]);

  function selectScene() {
    const video = videoRef.current;
    if (!video || video.readyState < HTMLMediaElement.HAVE_METADATA) {
      setError("영상을 재생할 수 없습니다. 파일을 교체해 주세요.");
      return;
    }
    video.pause();
    setSelectedTime(number, video.currentTime);
    setError("");
  }

  function replaceVideo(event: ChangeEvent<HTMLInputElement>) {
    const nextFile = event.target.files?.[0];
    event.target.value = "";
    if (!nextFile) return;
    if (!isVideoFile(nextFile)) {
      setError("영상 파일을 선택해 주세요.");
      return;
    }
    setFile(number, nextFile);
    setVideoUrl(null);
    setError("");
  }

  return (
    <section className="review-item" aria-label={`영상 ${number} 확인`}>
      <h2>{number}. {title}</h2>
      {demoMode ? (
        <div className="review-demo">
          <Image src={demoImages[number]} alt={`${title} 작업 예시 사진`} fill unoptimized sizes="(max-width: 1050px) 100vw, 33vw" />
          <span>예시 사진</span>
        </div>
      ) : file ? (
        <video
          ref={videoRef}
          className="review-player"
          src={videoUrl ?? undefined}
          controls
          playsInline
          preload="metadata"
          aria-label={`영상 ${number}: ${title}`}
          onError={() => setError("영상을 재생할 수 없습니다. 파일을 교체해 주세요.")}
        />
      ) : (
        <div className="review-empty">
          <p>영상 {number}을 먼저 선택해 주세요.</p>
          <Link href={`/upload/${number}`}>영상 선택하기</Link>
        </div>
      )}

      <div className="review-actions">
        <button type="button" onClick={selectScene} disabled={demoMode || !file}>장면 선택</button>
        <span aria-hidden="true" />
        <button type="button" onClick={() => fileInputRef.current?.click()} disabled={demoMode}>영상 교체</button>
        <input
          ref={fileInputRef}
          className="visually-hidden"
          type="file"
          accept="video/*,.mov,.mp4,.webm,.m4v"
          tabIndex={-1}
          onChange={replaceVideo}
          aria-label={`영상 ${number} 교체 파일`}
        />
      </div>
      {!demoMode && file && <p className="review-filename" title={file.name}>{file.name}</p>}
      {!demoMode && selectedTime !== null && <p className="review-scene" role="status">선택한 장면 {formatVideoTime(selectedTime)}</p>}
      {error && <p className="review-error" role="alert">{error}</p>}
    </section>
  );
}

export default function VideoReview() {
  const router = useRouter();
  const { files, selectedTimes, demoMode, skipped, activeVideos, setResultVideo } = useVideoFiles();
  const [message, setMessage] = useState("");
  const [hasError, setHasError] = useState(false);

  function finishReview() {
    if (demoMode) {
      router.push("/questions/1/1");
      return;
    }
    if (activeVideos.length === 0) {
      setMessage("세 작업 모두 하지 않는 것으로 선택했습니다. 평가할 작업 영상이 없습니다.");
      setHasError(true);
      return;
    }
    const missing = activeVideos.filter((number) => !files[number] || selectedTimes[number] === null);
    if (missing.length > 0) {
      setMessage(`영상 ${missing.join("·")}의 평가 장면을 선택해 주세요.`);
      setHasError(true);
      return;
    }
    setResultVideo(activeVideos[0]);
    router.push(`/questions/${activeVideos[0]}/1`);
  }

  return (
    <EvaluationShell
      step="03"
      stepName="영상 확인"
      title="영상을 확인해 주세요"
      description="올린 영상을 재생하고 평가할 장면을 선택해주세요."
      wide
    >
      {demoMode && <p className="demo-disclaimer">예시 사진으로 보는 화면입니다. 실제 영상이나 분석 결과가 아닙니다.</p>}
      <div className="review-grid">
        {videos.map((video) => !demoMode && skipped[video.number] ? (
          <section className="review-item" key={video.number}>
            <h2>{video.number}. {video.title}</h2>
            <p>하지 않는 작업 · 건너뛰었습니다.</p>
            <Link href={`/upload/${video.number}`}>작업 선택 변경</Link>
          </section>
        ) : <ReviewVideo key={video.number} {...video} />)}
      </div>
      <div className="review-footer">
        <button className="next-button" type="button" onClick={finishReview}>확인 완료 · 질문으로 <span aria-hidden="true">→</span></button>
        {message && <p className={`review-message${hasError ? " form-status-error" : ""}`} role={hasError ? "alert" : "status"}>{message}</p>}
      </div>
    </EvaluationShell>
  );
}
