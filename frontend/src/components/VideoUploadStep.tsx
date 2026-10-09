"use client";

import { useEffect, useState, type ChangeEvent, type DragEvent } from "react";
import { useRouter } from "next/navigation";
import EvaluationShell from "@/components/EvaluationShell";
import { useVideoFiles, type VideoNumber } from "@/components/VideoFilesProvider";
import { formatVideoTime, isVideoFile } from "@/lib/video";
import { filmingNotice, uploadCopy } from "@/lib/uploadCopy";


export default function VideoUploadStep({ number }: { number: VideoNumber }) {
  const router = useRouter();
  const { files, selectedTimes, activeEvaluation, skipped, setFile, skipVideo } = useVideoFiles();
  const selectedFile = files[number];
  const config = uploadCopy[number];
  const [duration, setDuration] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [message, setMessage] = useState("");
  const [hasError, setHasError] = useState(false);

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

  function selectFile(file: File | undefined) {
    if (!file) return;
    if (!isVideoFile(file)) {
      setMessage("영상 파일을 선택해 주세요.");
      setHasError(true);
      return;
    }
    setFile(number, file);
    setDuration(null);
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
    selectFile(event.dataTransfer.files[0]);
  }

  function handleNext() {
    if (!selectedFile) {
      setMessage(`영상 ${number} 파일을 먼저 선택해 주세요.`);
      setHasError(true);
      return;
    }

    if (number === 3 && activeEvaluation && !activeEvaluation.lastPath.startsWith("/upload/") && activeEvaluation.lastPath !== "/evaluation") {
      const allFilesReady = ([1, 2, 3] as const).every((index) => skipped[index] || Boolean(files[index]));
      const readyToResume = activeEvaluation.lastPath.startsWith("/questions/")
        ? selectedTimes[Number(activeEvaluation.lastPath.split("/")[2]) as VideoNumber] !== null
        : activeEvaluation.lastPath === "/review" || ([1, 2, 3] as const).every((index) => skipped[index] || selectedTimes[index] !== null);
      if (allFilesReady && readyToResume) { router.push(activeEvaluation.lastPath); return; }
    }
    router.push(config.nextPath);
  }

  return (
    <EvaluationShell step="02" stepName="영상 올리기" title={config.title}>
      <section className="upload-content" aria-label={`영상 ${number} 올리기`}>
        <div className="shooting-guide">
          <p className="filming-notice">{filmingNotice}</p>
          <h2>촬영 안내</h2>
          <p>{config.guide[0]}<br />{config.guide[1]}</p>
        </div>

        <label
          className={`upload-zone${isDragging ? " upload-zone-dragging" : ""}`}
          onDragOver={(event) => { event.preventDefault(); setIsDragging(true); }}
          onDragLeave={() => setIsDragging(false)}
          onDrop={handleDrop}
        >
          <input className="upload-file-input" type="file" accept="video/*,.mov,.mp4,.webm,.m4v" onChange={handleInputChange} aria-label={`영상 ${number} 선택`} />
          <span className="upload-plus" aria-hidden="true">+</span>
          <span className="upload-title">{selectedFile ? `영상 ${number} 교체` : `영상 ${number} 선택`}</span>
          <span className="upload-hint">파일을 끌어다 놓거나 선택하세요</span>
        </label>

        {selectedFile && (
          <p className="selected-video" aria-live="polite">
            <span className="selected-video-name">{selectedFile.name}</span>
            <span>{duration ?? "길이 확인 중"}</span>
          </p>
        )}

        <p className="shooting-note">{config.note}</p>

        <button className="next-button" type="button" onClick={handleNext}>{config.nextLabel} <span aria-hidden="true">→</span></button>
        <button className="upload-skip" type="button" onClick={() => { skipVideo(number); router.push(config.nextPath); }}>이 작업은 하지 않아요 · 건너뛰기</button>
        {message && <p className={`form-status${hasError ? " form-status-error" : ""}`} role={hasError ? "alert" : "status"}>{message}</p>}
      </section>
    </EvaluationShell>
  );
}
