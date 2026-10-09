"use client";

import { useEffect, useState, type ChangeEvent, type DragEvent } from "react";
import { useRouter } from "next/navigation";
import EvaluationShell from "@/components/EvaluationShell";
import { useVideoFiles, type VideoNumber } from "@/components/VideoFilesProvider";
import { formatVideoTime, isVideoFile } from "@/lib/video";

const videoSteps = {
  1: {
    title: "낮은 곳에서 높은 곳으로",
    guide: ["무릎 아래 물건을 집어 일어서세요.", "팔을 뻗거나 높은 곳에 놓는 모습까지 촬영하세요."],
    note: "전신·발·손이 보이게 촬영해 주세요.",
    nextLabel: "다음: 영상 2",
    nextPath: "/upload/2",
  },
  2: {
    title: "앉아서 손 작업",
    guide: ["키보드·마우스 또는 작은 부품 작업을 촬영하세요.", "손목과 팔 지지 상태가 보이게 촬영하세요."],
    note: "실제 업무를 자연스럽게 촬영해 주세요.",
    nextLabel: "다음: 영상 3",
    nextPath: "/upload/3",
  },
  3: {
    title: "물체 밀기/당기기",
    guide: ["카트·물체를 측면에서 촬영하세요.", "몸 방향과 카메라 방향을 일정하게 유지해 주세요."],
    note: "실제 작업의 힘·하중은 뒤에서 확인합니다.",
    nextLabel: "다음: 영상 확인",
    nextPath: "/review",
  },
} as const;

export default function VideoUploadStep({ number }: { number: VideoNumber }) {
  const router = useRouter();
  const { files, setFile } = useVideoFiles();
  const selectedFile = files[number];
  const config = videoSteps[number];
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

    router.push(config.nextPath);
  }

  return (
    <EvaluationShell step="02" stepName="영상 올리기" title={config.title}>
      <section className="upload-content" aria-label={`영상 ${number} 올리기`}>
        <p className="shooting-note">촬영 후보입니다. 실제 업무에 해당하는 유형만 촬영하고, 해당 없는 유형은 건너뛰십시오.</p>
        <div className="shooting-guide">
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
        {!selectedFile&&<button className="review-link" type="button" onClick={()=>router.push(config.nextPath)}>이 촬영 유형은 실제 작업에 없음, 건너뛰기</button>}
        {Object.values(files).some(Boolean)&&<button className="review-link" type="button" onClick={()=>router.push("/review")}>현재 선택한 영상으로 평가 (나머지 촬영 유형은 해당 없으면 생략)</button>}
        {message && <p className={`form-status${hasError ? " form-status-error" : ""}`} role={hasError ? "alert" : "status"}>{message}</p>}
      </section>
    </EvaluationShell>
  );
}
