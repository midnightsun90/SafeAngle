import type { SupabaseClient } from "@supabase/supabase-js";
import { postureInputRows, postureTypes as postures, type Evaluation, type VideoNumber } from "./evaluationStore.ts";
const numbers = [1, 2, 3] as const;
function fail(error: { message: string } | null): void { if (error) throw new Error(error.message); }
export async function saveAssessmentInputs(db: SupabaseClient, manager: string, item: Evaluation): Promise<void> {
  if (!item.assessmentId) throw new Error("평가 식별자가 없습니다.");
  const rows = postureInputRows(item, manager);
  const existingInputs = await db.from("assessment_posture_inputs").select("posture_type,is_skipped,selected_time_seconds,answers")
    .eq("assessment_id", item.assessmentId).eq("manager_id", manager);
  fail(existingInputs.error);
  const changed = rows.some((row) => {
    const old = existingInputs.data?.find((entry) => entry.posture_type === row.posture_type);
    const ordered = (answers: Record<string, unknown>) => JSON.stringify(Object.entries(answers).sort(([a], [b]) => a.localeCompare(b)));
    return !old || old.is_skipped !== row.is_skipped || (old.selected_time_seconds === null ? null : Number(old.selected_time_seconds)) !== row.selected_time_seconds || ordered(old.answers) !== ordered(row.answers);
  });
  const saved = await db.from("assessment_posture_inputs").upsert(rows, { onConflict: "assessment_id,posture_type" });
  fail(saved.error);
  if (!changed) return;
  const previous = await db.from("assessments").select("result").eq("id", item.assessmentId).eq("manager_id", manager).single();
  fail(previous.error);
  if (!previous.data?.result) return;
  const invalidated = await db.from("assessments").update({
    result: null, measurements: {}, reba_score: null, status: "needs_review",
  })
    .eq("id", item.assessmentId).eq("manager_id", manager).select("id").single();
  fail(invalidated.error);
}

type AnalysisSnapshot = {
  status: "complete" | "pending" | "unavailable";
  final: number | null;
  scene: { videoId: string; frameIndex: number; timeSec: number; side: "left" | "right" };
  parts: Record<string, unknown>;
  evidence?: { confirmedBy: string; capture: { scene: AnalysisSnapshot["scene"] } };
};
function analysisSnapshot(value: unknown, item: Evaluation, number: VideoNumber): AnalysisSnapshot | null {
  if (value === null) return null;
  if (!value || typeof value !== "object") throw new Error("분석 결과 형식을 확인해 주세요.");
  const result = value as AnalysisSnapshot;
  const scene = result.scene;
  if (!scene || typeof scene.videoId !== "string" || !scene.videoId || !Number.isInteger(scene.frameIndex) || scene.frameIndex < 0 ||
    !Number.isFinite(scene.timeSec) || scene.timeSec < 0 || !["left", "right"].includes(scene.side) ||
    !["complete", "pending", "unavailable"].includes(result.status) || !result.parts || typeof result.parts !== "object" || Array.isArray(result.parts) ||
    Math.abs(scene.timeSec - (item.selectedTimes[number] ?? -1)) > 0.001 || item.skipped[number]) throw new Error("분석 결과가 현재 영상·선택 장면과 일치하지 않습니다.");
  if (result.status === "complete" ? !Number.isInteger(result.final) || result.final! < 1 || result.final! > 15 : result.final !== null) throw new Error("미확정 결과를 확정 점수로 저장할 수 없습니다.");
  const parts = ["trunk", "neck", "legs", "upperArm", "lowerArm", "wrist"].map((key) => result.parts[key]);
  if (parts.some((part) => !part || typeof part !== "object" || Array.isArray(part))) throw new Error("부위별 채점 근거가 필요합니다.");
  if (result.status === "complete" && parts.some((part) => {
    const score = (part as { score: number }).score;
    return !Number.isInteger(score) || score < 1 || score > 9;
  })) throw new Error("부위별 점수를 먼저 확정해 주세요.");
  const vlm = parts.some((part) => (part as { source?: unknown }).source === "vlm");
  const evidenceScene = result.evidence?.capture?.scene;
  if ((vlm && !result.evidence) || (result.evidence && (result.evidence.confirmedBy !== "human" ||
    !evidenceScene || evidenceScene.videoId !== scene.videoId || evidenceScene.frameIndex !== scene.frameIndex || evidenceScene.timeSec !== scene.timeSec || evidenceScene.side !== scene.side))) throw new Error("관절 좌표 확인 기록이 필요합니다.");
  return result;
}

export async function persistAnalysisResult(db: SupabaseClient, manager: string, item: Evaluation, number: VideoNumber, value: unknown, storagePath: string | null): Promise<void> {
  const snapshot = analysisSnapshot(value, item, number);
  if (JSON.stringify(value).length > 2_000_000) throw new Error("분석 결과가 너무 큽니다.");
  if (!item.assessmentId) throw new Error("평가 식별자가 없습니다.");
  const previous = await db.from("assessments").select("result").eq("id", item.assessmentId).eq("manager_id", manager).single();
  fail(previous.error);
  const savedVideos = await db.from("assessment_videos").select("posture_type,storage_path").eq("assessment_id", item.assessmentId).eq("manager_id", manager);
  fail(savedVideos.error);
  const currentVideo = savedVideos.data?.find((row) => row.posture_type === postures[number]);
  if (snapshot && currentVideo?.storage_path !== storagePath) throw new Error("영상이 변경되어 결과를 저장하지 않았습니다.");
  const videos: Record<string, { storagePath: string; result: AnalysisSnapshot }> = { ...previous.data?.result?.videos };
  if (snapshot) videos[number] = { storagePath: storagePath!, result: snapshot };
  else delete videos[number];
  for (const key of Object.keys(videos)) if (!["1", "2", "3"].includes(key)) delete videos[key];
  for (const n of numbers) {
    if (item.skipped[n] || videos[n]?.storagePath !== savedVideos.data?.find((row) => row.posture_type === postures[n])?.storage_path) { delete videos[n]; continue; }
    try { analysisSnapshot(videos[n].result, item, n); } catch { delete videos[n]; }
  }
  const active = numbers.filter((n) => !item.skipped[n]);
  const completed = active.length > 0 && active.every((n) => videos[n]?.result.status === "complete");
  const score = completed ? Math.max(...active.map((n) => videos[n].result.final!)) : null;
  const saved = await db.from("assessments").update({
    result: Object.keys(videos).length ? { schemaVersion: 1, videos } : null,
    measurements: { videos: Object.fromEntries(Object.entries(videos).map(([n, entry]) => [n, entry.result.parts])) },
    reba_score: score, status: completed ? "completed" : "needs_review",
  }).eq("id", item.assessmentId).eq("manager_id", manager).select("id").single();
  fail(saved.error);
}

export async function restoreAnalysisResults(db: SupabaseClient, manager: string, item: Evaluation): Promise<Partial<Record<VideoNumber, unknown>>> {
  const stored = await db.from("assessments").select("result").eq("id", item.assessmentId).eq("manager_id", manager).maybeSingle();
  fail(stored.error);
  const current = await db.from("assessment_videos").select("posture_type,storage_path").eq("assessment_id", item.assessmentId).eq("manager_id", manager);
  fail(current.error);
  const results: Partial<Record<VideoNumber, unknown>> = {};
  for (const n of numbers) {
    const entry = stored.data?.result?.videos?.[n];
    if (!entry || item.skipped[n] || entry.storagePath !== current.data?.find((row) => row.posture_type === postures[n])?.storage_path) continue;
    try { results[n] = analysisSnapshot(entry.result, item, n); } catch { /* Stale or unsupported results stay unconfirmed. */ }
  }
  return results;
}
