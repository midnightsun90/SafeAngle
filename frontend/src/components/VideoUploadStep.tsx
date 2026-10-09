"use client";

import { useEffect, useState, type ChangeEvent, type DragEvent } from "react";
import { useRouter } from "next/navigation";
import EvaluationShell from "@/components/EvaluationShell";
import { useVideoFiles, type VideoNumber } from "@/components/VideoFilesProvider";
import { formatVideoTime, isVideoFile } from "@/lib/video";
import { filmingNotice, uploadCopy } from "@/lib/uploadCopy";


export default function VideoUploadStep({ number }: { number: VideoNumber }) {
  const router = useRouter();
  const { files, selectedTimes, activeEvaluation, skipped, setFile, skipVideo, uploading, loadingVideos } = useVideoFiles();
  const selectedFile = files[number];
  const config = uploadCopy[number];
  const [duration, setDuration] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [message, setMessage] = useState("");
  const [hasError, setHasError] = useState(false);
  const [storageConsent, setStorageConsent] = useState(false);

  useEffect(() => {
    if (!selectedFile) return;

    const video = document.createElement("video");
    const url = URL.createObjectURL(selectedFile);
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
  }, [selectedFile]);

  async function selectFile(file: File | undefined) {
    if (!file) return;
    if (!storageConsent || uploading) { setMessage("영상 저장에 동의한 뒤 파일을 선택해 주세요."); setHasError(true); return; }
    if (!isVideoFile(file)) {
      setMessage("영상 파일을 선택해 주세요.");
      setHasError(true);
      return;
    }
    setMessage("비공개 저장소에 영상 저장 중..."); setHasError(false);
    try {
      await setFile(number, file);
      setDuration(null); setMessage("영상이 저장되었습니다.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "영상을 저장하지 못했습니다. 다시 선택해 주세요."); setHasError(true);
    }
  }

  function handleInputChange(event: ChangeEvent<HTMLInputElement>) {
    void selectFile(event.target.files?.[0]);
    event.target.value = "";
  }

  function handleDrop(event: DragEvent<HTMLLabelElement>) {
    event.preventDefault();
    setIsDragging(false);
    void selectFile(event.dataTransfer.files[0]);
  }

  function handleNext() {
    if (!selectedFile) {
      setMessage(`영상 ${number} 파일을 먼저 선택해 주세요.`);
      setHasError(true);
      return;
    }

    if (number === 3 && activeEvaluation && !activeEvaluation.lastPath.startsWith("/upload/")) {
      const allFilesReady = ([1, 2, 3] as const).every((index) => skipped[index] || Boolean(files[index]));
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

        <label className="video-storage-consent">
          <input type="checkbox" checked={storageConsent} onChange={(event) => setStorageConsent(event.target.checked)} disabled={uploading} />
          촬영 대상자의 동의를 받았으며, 영상을 비공개 저장소에 저장하는 데 동의합니다.
        </label>

        <label
          className={`upload-zone${isDragging ? " upload-zone-dragging" : ""}`}
          onDragOver={(event) => { event.preventDefault(); setIsDragging(true); }}
          onDragLeave={() => setIsDragging(false)}
          onDrop={handleDrop}
        >
          <input className="upload-file-input" type="file" accept="video/*,.mov,.mp4,.webm,.m4v" onChange={handleInputChange} aria-label={`영상 ${number} 선택`} disabled={!storageConsent || uploading || loadingVideos} />
          <span className="upload-plus" aria-hidden="true">+</span>
          <span className="upload-title">{selectedFile ? `영상 ${number} 교체` : `영상 ${number} 선택`}</span>
          <span className="upload-hint">50 MB 이하 · {uploading ? "저장 중..." : loadingVideos ? "저장된 영상 불러오는 중..." : "파일을 끌어다 놓거나 선택하세요"}</span>
        </label>

        {selectedFile && (
          <p className="selected-video" aria-live="polite">
            <span className="selected-video-name">{selectedFile.name}</span>
            <span>{duration ?? "길이 확인 중"}</span>
          </p>
        )}

        <p className="shooting-note">{config.note}</p>

        <button className="next-button" type="button" onClick={handleNext} disabled={uploading || loadingVideos}>{config.nextLabel} <span aria-hidden="true">→</span></button>
        <button className="upload-skip" type="button" disabled={uploading || loadingVideos} onClick={() => { skipVideo(number); router.push(config.nextPath); }}>이 작업은 하지 않아요 · 건너뛰기</button>
        {message && <p className={`form-status${hasError ? " form-status-error" : ""}`} role={hasError ? "alert" : "status"}>{message}</p>}
      </section>
    </EvaluationShell>
  );
}
