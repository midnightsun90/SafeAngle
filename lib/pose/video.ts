import type { PoseLandmarker } from "@mediapipe/tasks-vision";
import type { Analysis, AnalysisOptions, PoseFrame } from "../types.ts";
import { analyzePoses } from "../analysis.ts";
import { resolvePolicy } from "../config.ts";
import { waitForLoad, waitForTask } from "./loading.ts";

export interface VideoOptions extends AnalysisOptions {
  assetBasePath?: string;
  signal?: AbortSignal;
  onProgress?: (processed: number, total: number) => void;
  onState?: (state: "decoding" | "loading-model" | "analyzing" | "measuring") => void;
}
export function assetPaths(basePath = "") {
  if(typeof basePath!=="string" || (basePath!=="" && !/^\/[A-Za-z0-9/_-]+$/.test(basePath)) || basePath.includes("//"))throw new TypeError("모델 자산 경로는 로컬 서비스의 경로 접두사여야 합니다.");
  const base=basePath.replace(/\/$/,"");
  return {modelPath:`${base}/models/pose_landmarker_full.task`,wasmPath:`${base}/wasm`};
}
export interface VideoAnalysis extends Analysis {
  runtime: { modelPath: string; modelVersion: string; packageVersion: string; startedAt: string;
    delegate: "GPU" | "CPU"; elapsedMs: number; inferenceMs: number; maxFrameInferenceMs: number;
    timestampSource: "seek_position" };
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
  const {modelPath,wasmPath} = assetPaths(options.assetBasePath);
  const start = performance.now();
  const startedAt = new Date().toISOString();
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
    options.signal?.throwIfAborted();
    options.onState?.("decoding");
    await waitFor(video, "loadeddata", () => { video.src = url; video.load(); }, options.signal);
    if (!Number.isFinite(video.duration) || video.duration <= 0 || video.duration > 60) {
      throw new RangeError("0초 초과, 60초 이하의 영상으로 잘라 주십시오.");
    }
    options.signal?.throwIfAborted();
    options.onState?.("loading-model");
    const { PoseLandmarker, FilesetResolver } = await waitForLoad(import("@mediapipe/tasks-vision"),options.signal);
    const fileset = await waitForLoad(FilesetResolver.forVisionTasks(wasmPath),options.signal);
    options.signal?.throwIfAborted();
    const create = (delegate: "GPU" | "CPU") => PoseLandmarker.createFromOptions(fileset, {
      baseOptions: { modelAssetPath: modelPath, delegate }, runningMode: "VIDEO", numPoses: 2,
      minPoseDetectionConfidence: 0.5, minPosePresenceConfidence: 0.5, minTrackingConfidence: 0.5,
      outputSegmentationMasks: false,
    });
    let delegate: "GPU" | "CPU" = "GPU";
    try { detector = await waitForTask(create(delegate), options.signal); }
    catch (gpuError) {
      options.signal?.throwIfAborted();
      delegate = "CPU";
      try { detector = await waitForTask(create(delegate), options.signal); }
      catch (cpuError) { options.signal?.throwIfAborted();throw new AggregateError([gpuError, cpuError], "포즈 모델을 불러오지 못했습니다. 모델과 WASM 경로를 확인하십시오."); }
    }
    const frames: PoseFrame[] = [];
    let inferenceMs = 0, maxFrameInferenceMs = 0, lastTimestamp = -1;
    const total = Math.max(1, Math.ceil(video.duration / policy.sampleIntervalSec));
    options.onProgress?.(0, total);
    options.signal?.throwIfAborted();
    options.onState?.("analyzing");
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
      let result: ReturnType<PoseLandmarker["detectForVideo"]>;
      try { result = detector.detectForVideo(video, lastTimestamp); }
      catch(error) { throw new Error("포즈 추론에 실패했습니다. Chrome의 그래픽 가속을 켜거나 다른 노트북에서 시도하십시오.",{cause:error}); }
      const elapsed = performance.now() - before;
      inferenceMs += elapsed;
      maxFrameInferenceMs = Math.max(maxFrameInferenceMs, elapsed);
      try {
        frames.push({ timeSec, personCount: result.landmarks.length,
          landmarks: result.landmarks.length === 1 ? result.landmarks[0]!.map(point => ({ ...point })) : [] });
      } finally { result.close(); }
      options.onProgress?.(index + 1, total);
      await new Promise<void>(resolve => setTimeout(resolve, 0));
    }
    options.signal?.throwIfAborted();
    options.onState?.("measuring");
    const analysis = analyzePoses(frames, { width: video.videoWidth, height: video.videoHeight }, options);
    return { ...analysis, durationSec: video.duration, sampleIntervalSec: policy.sampleIntervalSec,
      runtime: { modelPath,modelVersion:"full/float16/1",packageVersion:"0.10.34",startedAt,
        delegate,elapsedMs:performance.now()-start,inferenceMs,maxFrameInferenceMs,timestampSource:"seek_position" } };
  } finally {
    try { detector?.close(); }
    finally {
      try { video.pause();video.removeAttribute("src");video.load(); }
      finally { video.remove();URL.revokeObjectURL(url); }
    }
  }
}
