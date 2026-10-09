"use client";

import { useEffect, useState, type ChangeEvent, type DragEvent } from "react";
import { useRouter } from "next/navigation";
import EvaluationShell from "@/components/EvaluationShell";
import { useVideoFiles, type VideoNumber } from "@/components/VideoFilesProvider";
import { formatVideoTime } from "@/lib/video";
import { validateVideoFile } from "@/lib/videoStorage";
import { filmingNotice, uploadCopy } from "@/lib/uploadCopy";
import "./upload-status.css";


export default function VideoUploadStep({ number }: { number: VideoNumber }) {
  const router = useRouter();
  const { files, storedVideos, selectedTimes, activeEvaluation, skipped, setFile, skipVideo } = useVideoFiles();
  const selectedFile = files[number];
  const storedVideo = storedVideos[number];
  const config = uploadCopy[number];
  const [duration, setDuration] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [message, setMessage] = useState("");
  const [hasError, setHasError] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [pendingFile, setPendingFile] = useState<File | null>(null);
  const displayFile = pendingFile ?? selectedFile;

  useEffect(() => {
    if (!displayFile) return;

    const video = document.createElement("video");
    const url = URL.createObjectURL(displayFile);
    video.preload = "metadata";
    video.onloadedmetadata = () => {
      setDuration(Number.isFinite(video.duration) ? formatVideoTime(video.duration) : "길이 확인 불가");
    };
    video.onerror = () => setDuration("길이 확인 불가");
    video.src = url;

    return () => {
      video.onloadedmetadata = null;
      video.onerror = null;
      video.removeAttribute("src");
      video.load();
      URL.revokeObjectURL(url);
    };
  }, [displayFile]);

  function selectFile(file: File | undefined) {
    if (!file) return;
    const validationError = validateVideoFile(file);
    if (validationError) {
      setMessage(validationError);
      setHasError(true);
      return;
    }
    setPendingFile(file);
    setDuration(null);
    setProgress(0);
    setMessage("");
    setHasError(false);
  }

  function handleInputChange(event: ChangeEvent<HTMLInputElement>) {
    selectFile(event.target.files?.[0]);
    event.target.value = "";
  }

  function handleDrop(event: DragEvent<HTMLLabelElement>) {
    event.preventDefault();
    setIsDragging(false);
    if (uploading) return;
    selectFile(event.dataTransfer.files[0]);
  }

  async function handleNext() {
    if (uploading) return;
    if (!pendingFile && !selectedFile && !storedVideo) {
      setMessage(`영상 ${number} 파일을 먼저 선택해 주세요.`);
      setHasError(true);
      return;
    }

    if (pendingFile) {
      setUploading(true);
      setProgress(0);
      setMessage("");
      setHasError(false);
      try {
        await setFile(number, pendingFile, setProgress);
        setPendingFile(null);
      } catch (error) {
        setMessage(error instanceof Error ? error.message : "영상을 저장하지 못했습니다. 다시 시도해 주세요.");
        setHasError(true);
        setUploading(false);
        return;
      }
    }

    if (number === 3 && activeEvaluation && !activeEvaluation.lastPath.startsWith("/upload/")) {
      const allFilesReady = ([1, 2, 3] as const).every((index) => skipped[index] || Boolean(files[index] || storedVideos[index]) || (index === number && Boolean(pendingFile)));
      const beforeSceneSelection = activeEvaluation.lastPath.startsWith("/questions/") || ["/review", "/analysis", "/confirmation"].includes(activeEvaluation.lastPath);
      const readyToResume = beforeSceneSelection || ([1, 2, 3] as const).every((index) => skipped[index] || selectedTimes[index] !== null);
      if (allFilesReady && readyToResume) { router.push(activeEvaluation.lastPath); return; }
    }
    router.push(config.nextPath);
  }

  return (
    <EvaluationShell step="01" stepName="영상 올리기" title={config.title}>
      <section className="upload-content" aria-label={`영상 ${number} 올리기`}>
        <div className="shooting-guide">
          <p className="filming-notice">{filmingNotice}</p>
          <h2>촬영 안내</h2>
          <p>{config.guide[0]}<br />{config.guide[1]}</p>
        </div>

        <label
          className={`upload-zone${displayFile || storedVideo ? " upload-zone-filled" : ""}${isDragging ? " upload-zone-dragging" : ""}`}
          onDragOver={(event) => { event.preventDefault(); setIsDragging(true); }}
          onDragLeave={() => setIsDragging(false)}
          onDrop={handleDrop}
        >
          <input className="upload-file-input" type="file" accept="video/*,.mov,.mp4,.webm,.m4v" onChange={handleInputChange} aria-label={`영상 ${number} 선택`} disabled={uploading} />
          <span className="upload-plus" aria-hidden="true">+</span>
          <span className="upload-title">{displayFile || storedVideo ? `영상 ${number} 교체` : `영상 ${number} 선택`}</span>
          <span className="upload-hint">영상 파일 선택 · 최대 50MB</span>
        </label>

        {(displayFile || storedVideo) && (
          <p className="selected-video" aria-live="polite">
            <span className="selected-video-name">{displayFile?.name ?? storedVideo?.original_filename ?? "저장된 영상"}</span>
            <span>{duration ?? (storedVideo?.duration_seconds != null ? formatVideoTime(storedVideo.duration_seconds) : "길이 확인 불가")}</span>
          </p>
        )}
        {(displayFile || storedVideo) && <p className="upload-state" role="status">{uploading ? `저장 중 · ${progress}%` : pendingFile ? "선택됨 · 다음을 누르면 저장" : "저장 완료"}</p>}
        {uploading && <div className="upload-progress" role="progressbar" aria-label="영상 업로드" aria-valuenow={progress} aria-valuemin={0} aria-valuemax={100}><span style={{ width: `${progress}%` }} /></div>}

        <p className="shooting-note">{config.note}</p>

        <button className="next-button" type="button" onClick={() => { void handleNext(); }} disabled={uploading}>{uploading ? `영상 저장 중 ${progress}%` : pendingFile ? "저장하고 다음으로" : config.nextLabel} {!uploading && <span aria-hidden="true">→</span>}</button>
        <button className="upload-skip" type="button" disabled={uploading} onClick={async () => {
          try { await skipVideo(number); router.push(config.nextPath); }
          catch { setMessage("영상을 삭제하지 못했습니다. 다시 시도해 주세요."); setHasError(true); }
        }}>이 작업은 하지 않아요 · 건너뛰기</button>
        {message && <p className={`form-status${hasError ? " form-status-error" : ""}`} role={hasError ? "alert" : "status"}>{message}</p>}
      </section>
    </EvaluationShell>
  );
}
