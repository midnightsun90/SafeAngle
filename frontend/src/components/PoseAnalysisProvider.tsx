"use client";

import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import type { VideoAnalysis } from "../../../lib/pose/video.ts";
import { frameAtTime, poseResultRow, readPoseResult, representativeFrame, toPoseResult, type PoseResult } from "@/lib/poseResult";
import { supabase } from "@/lib/supabaseClient";
import { videoBucket, videoPostureTypes, type VideoPostureType } from "@/lib/videoStorage";
import { useVideoFiles, type VideoNumber } from "./VideoFilesProvider";

type AnalysisStep = "loading" | "decoding" | "loading-model" | "analyzing" | "measuring" | "saving" | "ready" | "error";
type AnalysisState = { step: AnalysisStep; progress: number; message?: string };
type ContextValue = {
  results: Partial<Record<VideoNumber, PoseResult>>;
  states: Partial<Record<VideoNumber, AnalysisState>>;
  analyses: Partial<Record<VideoNumber, VideoAnalysis>>;
  selectFrame: (number: VideoNumber, timeSec: number) => Promise<void>;
  retry: (number: VideoNumber) => void;
};

const PoseAnalysisContext = createContext<ContextValue | null>(null);

export function PoseAnalysisProvider({ children }: { children: ReactNode }) {
  const { activeEvaluation, files, storedVideos, skipped, demoMode } = useVideoFiles();
  const [results, setResults] = useState<ContextValue["results"]>({});
  const [states, setStates] = useState<ContextValue["states"]>({});
  const [analyses, setAnalyses] = useState<ContextValue["analyses"]>({});
  const [retryRequest, setRetryRequest] = useState<{ number: VideoNumber; id: number } | null>(null);
  const analysisCache = useRef(new Map<string, VideoAnalysis>());

  const assessmentId = activeEvaluation?.assessmentId ?? null;
  const ownerId = activeEvaluation?.managerId ?? null;
  const paths = ([1, 2, 3] as const).map((number) => skipped[number] ? "" : storedVideos[number]?.storage_path ?? "");
  const pathSignature = `${assessmentId ?? ""}|${ownerId ?? ""}|${paths.join("|")}`;

  useEffect(() => {
    const currentAssessmentId = assessmentId;
    if (!currentAssessmentId || !ownerId || demoMode || !supabase) return;
    const client = supabase;
    const controller = new AbortController();
    let active = true;
    setResults({});
    setAnalyses({});
    setStates({});

    async function run() {
      const { data: userData, error: authError } = await client.auth.getUser();
      if (authError || !userData.user || !active) return;
      const managerId = ownerId;
      if (!managerId) return;
      const { data: storedRows } = await client.from("assessment_pose_results")
        .select("assessment_id,posture_type,storage_path,time_seconds,selection_source,model_version,analyzed_at,measurements,quality")
        .eq("assessment_id", currentAssessmentId).eq("manager_id", managerId);
      if (!active) return;
      const saved = new Map((storedRows ?? []).map((row) => [row.posture_type, readPoseResult(row)]));

      for (const number of [1, 2, 3] as const) {
        if (!active) return;
        const path = paths[number - 1];
        if (!path) continue;
        const prior = saved.get(videoPostureTypes[number - 1]);
        if (prior?.storagePath === path && retryRequest?.number !== number) {
          setResults((current) => ({ ...current, [number]: prior }));
          setStates((current) => ({ ...current, [number]: { step: "ready", progress: 100 } }));
          continue;
        }
        try {
          setStates((current) => ({ ...current, [number]: { step: "loading", progress: 0 } }));
          let file = files[number];
          if (!file) {
            const { data: blob, error } = await client.storage.from(videoBucket).download(path);
            if (error || !blob) throw error ?? new Error("저장된 영상을 가져오지 못했습니다.");
            file = new File([blob], storedVideos[number]?.original_filename ?? `video-${number}.mp4`, { type: blob.type || "video/mp4" });
          }
          if (!active) return;
          const { analyzeVideo } = await import("../../../lib/pose/video.ts");
          const analysis = await analyzeVideo(file, {
            signal: controller.signal,
            assetBasePath: process.env.NEXT_PUBLIC_BASE_PATH ?? "",
            onState: (step) => {
              if (active) setStates((current) => ({ ...current, [number]: { step, progress: current[number]?.progress ?? 0 } }));
            },
            onProgress: (done, total) => {
              if (active) setStates((current) => ({ ...current, [number]: { step: "analyzing", progress: Math.round(done / total * 100) } }));
            },
          });
          if (!active) return;
          analysisCache.current.set(path, analysis);
          setAnalyses((current) => ({ ...current, [number]: analysis }));
          const frame = representativeFrame(analysis);
          const result = toPoseResult(analysis, frame, currentAssessmentId!, videoPostureTypes[number - 1], path,
            "automatic");
          setResults((current) => ({ ...current, [number]: result }));
          setStates((current) => ({ ...current, [number]: { step: "saving", progress: 100 } }));
          const { error: saveError } = await client.from("assessment_pose_results")
            .upsert(poseResultRow(result, managerId), { onConflict: "assessment_id,posture_type" });
          if (saveError) throw saveError;
          if (active) setStates((current) => ({ ...current, [number]: { step: "ready", progress: 100 } }));
        } catch (error) {
          if (!active || controller.signal.aborted) return;
          setStates((current) => ({ ...current, [number]: {
            step: "error", progress: current[number]?.progress ?? 0,
            message: error instanceof Error ? error.message : "영상 분석에 실패했습니다.",
          } }));
        }
      }
    }

    void run();
    return () => { active = false; controller.abort(); };
  }, [pathSignature, demoMode, retryRequest?.id]);

  async function selectFrame(number: VideoNumber, timeSec: number) {
    if (!assessmentId || !ownerId || !supabase) throw new Error("평가를 먼저 선택해 주세요.");
    const path = storedVideos[number]?.storage_path;
    const analysis = path ? analysisCache.current.get(path) : null;
    if (!analysis || !path) throw new Error("영상 전체 분석을 다시 실행한 뒤 장면을 선택해 주세요.");
    const frame = frameAtTime(analysis, timeSec);
    if (!frame || frame.personCount !== 1) throw new Error("이 시각은 측정할 수 없습니다. 다른 장면을 선택해 주세요.");
    const { data: userData, error: authError } = await supabase.auth.getUser();
    if (authError || !userData.user) throw new Error("로그인을 확인하지 못했습니다.");
    const result = toPoseResult(analysis, frame, assessmentId, videoPostureTypes[number - 1], path, "manual");
    const { error } = await supabase.from("assessment_pose_results")
      .upsert(poseResultRow(result, ownerId), { onConflict: "assessment_id,posture_type" });
    if (error) throw error;
    setResults((current) => ({ ...current, [number]: result }));
  }

  function retry(number: VideoNumber) {
    const path = storedVideos[number]?.storage_path;
    if (path) analysisCache.current.delete(path);
    setRetryRequest((current) => ({ number, id: (current?.id ?? 0) + 1 }));
  }

  const currentResults: ContextValue["results"] = {};
  for (const number of [1, 2, 3] as const) {
    if (results[number]?.assessmentId === assessmentId && results[number]?.storagePath === paths[number - 1]) {
      currentResults[number] = results[number];
    }
  }

  return <PoseAnalysisContext.Provider value={{ results: currentResults, states, analyses, selectFrame, retry }}>{children}</PoseAnalysisContext.Provider>;
}

export function usePoseAnalysis(): ContextValue {
  const value = useContext(PoseAnalysisContext);
  if (!value) throw new Error("PoseAnalysisProvider is required");
  return value;
}
