"use client";

import { useRef, useState, type ChangeEvent } from "react";
import Link from "next/link";
import Image from "next/image";
import { useRouter } from "next/navigation";
import EvaluationShell from "@/components/EvaluationShell";
import { useVideoFiles, type VideoNumber } from "@/components/VideoFilesProvider";
import { useVideoSource } from "@/components/useVideoSource";
import { validateVideoFile } from "@/lib/videoStorage";
import { demoImages } from "@/lib/demoImages";
import { uploadCopy } from "@/lib/uploadCopy";

const videos: { number: VideoNumber; title: string }[] = [
  { number: 1, title: uploadCopy[1].title },
  { number: 2, title: uploadCopy[2].title },
  { number: 3, title: uploadCopy[3].title },
];

function ReviewVideo({ number, title, onUploadingChange }: { number: VideoNumber; title: string; onUploadingChange: (number: VideoNumber, uploading: boolean) => void }) {
  const { files, storedVideos, demoMode, setFile } = useVideoFiles();
  const file = files[number];
  const storedVideo = storedVideos[number];

  const fileInputRef = useRef<HTMLInputElement>(null);
  const { src, error: sourceError } = useVideoSource(number);
  const [error, setError] = useState("");
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);

  async function replaceVideo(event: ChangeEvent<HTMLInputElement>) {
    const nextFile = event.target.files?.[0];
    event.target.value = "";
    if (!nextFile) return;
    const validationError = validateVideoFile(nextFile);
    if (validationError) { setError(validationError); return; }
    setUploading(true);
    onUploadingChange(number, true);
    setProgress(0);
    setError("");
    try { await setFile(number, nextFile, setProgress); }
    catch (uploadError) { setError(uploadError instanceof Error ? uploadError.message : "영상 교체에 실패했습니다."); }
    finally { setUploading(false); onUploadingChange(number, false); }
  }

  return (
    <section className="review-item" aria-label={`영상 ${number} 확인`}>
      <h2>{number}. {title}</h2>
      {demoMode ? (
        <div className="review-demo">
          <Image src={demoImages[number]} alt={`${title} 작업 예시 사진`} fill unoptimized sizes="(max-width: 1050px) 100vw, 33vw" />
          <span>예시 사진</span>
        </div>
      ) : file || storedVideo ? (
        <video
          className="review-player"
          src={src ?? undefined}
          controls
          playsInline
          preload="metadata"
          aria-label={`영상 ${number}: ${title}`}
          onError={() => setError("영상을 재생할 수 없습니다. 파일을 교체해 주세요.")}
        />
      ) : (
        <div className="review-empty">
          <p>영상 {number}을 먼저 선택해 주세요.</p>
          <Link className="confirmation-soft-button" href={`/upload/${number}`}>영상 선택하기</Link>
        </div>
      )}

      <div className="review-actions">
        <button type="button" onClick={() => fileInputRef.current?.click()} disabled={demoMode || uploading}>{uploading ? `업로드 중 ${progress}%` : "영상 바꾸기"}</button>
        <input
          ref={fileInputRef}
          className="visually-hidden"
          type="file"
          accept="video/*,.mov,.mp4,.webm,.m4v"
          tabIndex={-1}
          disabled={uploading}
          onChange={(event) => { void replaceVideo(event); }}
          aria-label={`영상 ${number} 교체 파일`}
        />
      </div>
      {!demoMode && (file || storedVideo) && <p className="review-filename" title={file?.name ?? storedVideo?.original_filename ?? ""}>저장 완료 · {file?.name ?? storedVideo?.original_filename ?? "저장된 영상"}</p>}
      {(error || sourceError) && <p className="review-error" role="alert">{error || sourceError}</p>}
    </section>
  );
}

export default function VideoReview() {
  const router = useRouter();
  const { files, storedVideos, demoMode, skipped, activeVideos, setResultVideo, leaveDemo } = useVideoFiles();
  const [message, setMessage] = useState("");
  const [hasError, setHasError] = useState(false);
  const [uploadingVideos, setUploadingVideos] = useState<VideoNumber[]>([]);

  function updateUploading(number: VideoNumber, uploading: boolean) {
    setUploadingVideos((current) => uploading ? [...current, number] : current.filter((item) => item !== number));
  }

  function finishReview() {
    if (uploadingVideos.length) return;
    if (demoMode) {
      router.push("/questions/1/2");
      return;
    }
    if (activeVideos.length === 0) {
      setMessage("세 작업 모두 하지 않는 것으로 선택했습니다. 평가할 작업 영상이 없습니다.");
      setHasError(true);
      return;
    }
    const missing = activeVideos.filter((number) => !files[number] && !storedVideos[number]);
    if (missing.length > 0) {
      setMessage(`영상 ${missing.join("·")}을 올려주세요.`);
      setHasError(true);
      return;
    }
    setResultVideo(activeVideos[0]);
    router.push(`/questions/${activeVideos[0]}/2`);
  }

  return (
    <EvaluationShell
      step="02"
      stepName="영상 확인"
      title="올린 영상을 확인해주세요"
      description="저장된 영상을 재생해 확인해주세요. 다음 화면에서 작업 조건을 입력합니다."
      wide
    >
      {demoMode && <p className="demo-disclaimer">예시 사진으로 보는 화면입니다. 실제 영상이나 분석 결과가 아닙니다.</p>}
      <div className="review-grid">
        {videos.map((video) => !demoMode && skipped[video.number] ? (
          <section className="review-item" key={video.number}>
            <h2>{video.number}. {video.title}</h2>
            <p>하지 않는 작업 · 건너뛰었습니다.</p>
            <Link className="confirmation-soft-button" href={`/upload/${video.number}`}>작업 선택 변경</Link>
          </section>
        ) : <ReviewVideo key={video.number} {...video} onUploadingChange={updateUploading} />)}
      </div>
      <div className="review-footer">
        <button className="next-button" type="button" onClick={finishReview} disabled={uploadingVideos.length > 0}>다음: 작업 조건 입력 <span aria-hidden="true">→</span></button>
        {demoMode && <button className="upload-skip" type="button" onClick={() => { leaveDemo(); router.replace("/"); }}>실제 영상으로 평가 시작하기</button>}
        {message && <p className={`review-message${hasError ? " form-status-error" : ""}`} role={hasError ? "alert" : "status"}>{message}</p>}
      </div>
    </EvaluationShell>
  );
}
