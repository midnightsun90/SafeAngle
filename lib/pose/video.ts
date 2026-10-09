import type { PoseLandmarker } from "@mediapipe/tasks-vision";
import type { Analysis, AnalysisOptions, PoseFrame } from "../types.ts";
import { analyzePoses } from "../analysis.ts";
import { resolvePolicy } from "../config.ts";

export interface VideoOptions extends AnalysisOptions {
  signal?: AbortSignal;
  onProgress?: (processed: number, total: number) => void;
}
export interface VideoAnalysis extends Analysis {
  runtime: { modelPath: string; delegate: "GPU" | "CPU"; elapsedMs: number; inferenceMs: number };
}

function waitFor(video: HTMLVideoElement, event: string, act: () => void, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    let timer: ReturnType<typeof setTimeout>;
    const cleanup = () => {
      clearTimeout(timer);
      video.removeEventListener(event, done);
      video.removeEventListener("error", failed);
      signal?.removeEventListener("abort", aborted);
    };
    const done = () => { cleanup(); resolve(); };
    const failed = () => { cleanup(); reject(new Error("영상을 디코딩하지 못했습니다. MP4(H.264)로 다시 저장하십시오.")); };
    const aborted = () => { cleanup(); reject(signal?.reason ?? new DOMException("분석이 취소됐습니다.", "AbortError")); };
    if (signal?.aborted) { reject(signal.reason); return; }
    video.addEventListener(event, done, { once: true });
    video.addEventListener("error", failed, { once: true });
    signal?.addEventListener("abort", aborted, { once: true });
    timer = setTimeout(() => { cleanup(); reject(new Error("영상 읽기 시간이 초과됐습니다.")); }, 20_000);
    try { act(); } catch (error) { cleanup(); reject(error); }
  });
}

export async function analyzeVideo(file: File, options: VideoOptions = {}): Promise<VideoAnalysis> {
  if (typeof document === "undefined") throw new Error("영상 분석은 브라우저에서 실행해야 합니다.");
  if (!(file instanceof Blob) || file.size === 0) throw new TypeError("비어 있지 않은 영상 파일이 필요합니다.");
  if (file.size > 250 * 1024 * 1024) throw new RangeError("영상 파일은 250MB 이내로 줄여 주십시오.");
  const policy = resolvePolicy(options.policy);
  const modelPath = "/models/pose_landmarker_full.task";
  const wasmPath = "/wasm";
  const start = performance.now();
  const video = document.createElement("video");
  video.preload = "auto";
  video.muted = true;
  video.playsInline = true;
  video.style.cssText = "position:fixed;width:1px;height:1px;opacity:0;pointer-events:none";
  video.setAttribute("aria-hidden", "true");
  document.body.append(video);
  const url = URL.createObjectURL(file);
  let detector: PoseLandmarker | undefined;
  try {
    await waitFor(video, "loadeddata", () => { video.src = url; video.load(); }, options.signal);
    if (!Number.isFinite(video.duration) || video.duration <= 0 || video.duration > 60) {
      throw new RangeError("0초 초과, 60초 이하의 영상으로 잘라 주십시오.");
    }
    options.signal?.throwIfAborted();
    const { PoseLandmarker, FilesetResolver } = await import("@mediapipe/tasks-vision");
    const fileset = await FilesetResolver.forVisionTasks(wasmPath);
    options.signal?.throwIfAborted();
    const create = (delegate: "GPU" | "CPU") => PoseLandmarker.createFromOptions(fileset, {
      baseOptions: { modelAssetPath: modelPath, delegate }, runningMode: "VIDEO", numPoses: 2,
      minPoseDetectionConfidence: 0.5, minPosePresenceConfidence: 0.5, minTrackingConfidence: 0.5,
      outputSegmentationMasks: false,
    });
    let delegate: "GPU" | "CPU" = "GPU";
    try { detector = await create(delegate); }
    catch (gpuError) {
      options.signal?.throwIfAborted();
      delegate = "CPU";
      try { detector = await create(delegate); }
      catch (cpuError) { throw new AggregateError([gpuError, cpuError], "포즈 모델을 불러오지 못했습니다. 모델과 WASM 경로를 확인하십시오."); }
    }
    const frames: PoseFrame[] = [];
    let inferenceMs = 0, lastTimestamp = -1;
    const total = Math.max(1, Math.ceil(video.duration / policy.sampleIntervalSec));
    options.onProgress?.(0, total);
    for (let index = 0; index < total; index++) {
      options.signal?.throwIfAborted();
      const target = index * policy.sampleIntervalSec;
      if (Math.abs(video.currentTime - target) > 0.00001) {
        await waitFor(video, "seeked", () => { video.currentTime = target; }, options.signal);
      }
      if (video.readyState < 2) throw new Error("분석할 영상 프레임이 준비되지 않았습니다.");
      const timeSec = video.currentTime;
      if (timeSec * 1000 <= lastTimestamp) throw new Error("프레임 시각이 증가하지 않습니다. 다른 브라우저에서 시도하십시오.");
      lastTimestamp = timeSec * 1000;
      const before = performance.now();
      // shortcut: inference blocks the main thread; move to a worker if measured UI stalls are excessive.
      const result = detector.detectForVideo(video, lastTimestamp);
      inferenceMs += performance.now() - before;
      try {
        frames.push({ timeSec, personCount: result.landmarks.length,
          landmarks: result.landmarks.length === 1 ? result.landmarks[0]!.map(point => ({ ...point })) : [] });
      } finally { result.close(); }
      options.onProgress?.(index + 1, total);
      await new Promise<void>(resolve => setTimeout(resolve, 0));
    }
    const analysis = analyzePoses(frames, { width: video.videoWidth, height: video.videoHeight }, options);
    return { ...analysis, runtime: { modelPath, delegate, elapsedMs: performance.now() - start, inferenceMs } };
  } finally {
    detector?.close();
    video.pause();
    video.removeAttribute("src");
    video.load();
    video.remove();
    URL.revokeObjectURL(url);
  }
}
