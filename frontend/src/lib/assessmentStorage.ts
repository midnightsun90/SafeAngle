import type { SupabaseClient } from "@supabase/supabase-js";
import { addEvaluation, createDashboardState, type Evaluation, type VideoNumber, type StoredPerson } from "./evaluationStore.ts";
import { isVideoFile } from "./video.ts";

export const VIDEO_BUCKET = "assessment-videos";
export const MAX_VIDEO_BYTES = 50 * 1024 * 1024;
const postures = { 1: "lift_transfer", 2: "seated_handwork", 3: "push_pull" } as const;
const numbers = [1, 2, 3] as const;
type StoredVideo = { assessment_id: string; posture_type: string; storage_path: string; original_filename: string | null };
type StoredInput = { assessment_id: string; posture_type: string; is_skipped: boolean; selected_time_seconds: number | string | null; answers: Record<string, unknown> };

function fail(error: { message: string } | null): void { if (error) throw new Error(error.message); }
function checkOwner(path: string, manager: string, assessment: string): void {
  if (!path.startsWith(`${manager}/${assessment}/`) || path.includes("..")) throw new Error("영상 경로가 평가와 일치하지 않습니다.");
}

async function videoDuration(file: File): Promise<number | null> {
  const video = document.createElement("video");
  const url = URL.createObjectURL(file);
  try {
    return await new Promise((resolve) => {
      const done = (value: number | null) => { clearTimeout(timer); video.onloadedmetadata = null; video.onerror = null; resolve(value); };
      const timer = setTimeout(() => done(null), 5000);
      video.onloadedmetadata = () => done(Number.isFinite(video.duration) && video.duration >= 0 ? video.duration : null);
      video.onerror = () => done(null);
      video.preload = "metadata"; video.src = url;
    });
  } finally { video.removeAttribute("src"); video.load(); URL.revokeObjectURL(url); }
}

export async function ensureAssessment(db: SupabaseClient, manager: string, item: Evaluation): Promise<void> {
  if (!item.assessmentId) throw new Error("평가 식별자가 없습니다.");
  const found = await db.from("assessments").select("id").eq("id", item.assessmentId).eq("manager_id", manager).maybeSingle();
  fail(found.error);
  if (!found.data) {
    const created = await db.from("assessments").insert({ id: item.assessmentId, manager_id: manager, person_id: item.id });
    fail(created.error);
  }
}

export async function saveAssessmentInputs(db: SupabaseClient, manager: string, item: Evaluation): Promise<void> {
  await ensureAssessment(db, manager, item);
  const rows = numbers.map((n) => ({
    assessment_id: item.assessmentId, manager_id: manager, posture_type: postures[n],
    is_skipped: item.skipped[n], selected_time_seconds: item.skipped[n] ? null : item.selectedTimes[n],
    answers: item.skipped[n] ? {} : { ...item.answers[n], __storage_path: item.fileKeys[n] },
    question_schema_version: 1,
  }));
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
  // Keep navigation separate from the analysis result and never mark an unscored assessment completed.
  const previous = await db.from("assessments").select("answers,result").eq("id", item.assessmentId).eq("manager_id", manager).single();
  fail(previous.error);
  const navigation = await db.from("assessments").update({
    answers: { ...previous.data?.answers, __navigation: { lastPath: item.lastPath } },
    ...(changed && previous.data?.result ? { result: null, measurements: {}, reba_score: null, status: "needs_review" } : {}),
  })
    .eq("id", item.assessmentId).eq("manager_id", manager).select("id").single();
  fail(navigation.error);
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
  if (!scene || typeof scene.videoId !== "string" || !Number.isInteger(scene.frameIndex) || scene.frameIndex < 0 ||
    !Number.isFinite(scene.timeSec) || scene.timeSec < 0 || !["left", "right"].includes(scene.side) ||
    !["complete", "pending", "unavailable"].includes(result.status) || !result.parts ||
    Math.abs(scene.timeSec - (item.selectedTimes[number] ?? -1)) > 0.001 || item.skipped[number] || !item.fileKeys[number]) throw new Error("분석 결과가 현재 영상·선택 장면과 일치하지 않습니다.");
  if (result.status === "complete" ? !Number.isInteger(result.final) || result.final! < 1 || result.final! > 15 : result.final !== null) throw new Error("미확정 결과를 확정 점수로 저장할 수 없습니다.");
  const parts = ["trunk", "neck", "legs", "upperArm", "lowerArm", "wrist"].map((key) => result.parts[key]);
  if (parts.some((part) => !part || typeof part !== "object")) throw new Error("부위별 채점 근거가 필요합니다.");
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

export async function persistAnalysisResult(db: SupabaseClient, manager: string, item: Evaluation, number: VideoNumber, value: unknown): Promise<void> {
  const snapshot = analysisSnapshot(value, item, number);
  if (JSON.stringify(value).length > 2_000_000) throw new Error("분석 결과가 너무 큽니다.");
  await ensureAssessment(db, manager, item);
  const previous = await db.from("assessments").select("result").eq("id", item.assessmentId).eq("manager_id", manager).single();
  fail(previous.error);
  const savedVideos = await db.from("assessment_videos").select("posture_type,storage_path").eq("assessment_id", item.assessmentId).eq("manager_id", manager);
  fail(savedVideos.error);
  const currentVideo = savedVideos.data?.find((row) => row.posture_type === postures[number]);
  if (snapshot && currentVideo?.storage_path !== item.fileKeys[number]) throw new Error("영상이 변경되어 결과를 저장하지 않았습니다.");
  const videos: Record<string, { storagePath: string; result: AnalysisSnapshot }> = { ...previous.data?.result?.videos };
  if (snapshot) videos[number] = { storagePath: item.fileKeys[number]!, result: snapshot };
  else delete videos[number];
  for (const key of Object.keys(videos)) if (!["1", "2", "3"].includes(key)) delete videos[key];
  for (const n of numbers) {
    if (item.skipped[n] || videos[n]?.storagePath !== item.fileKeys[n]) { delete videos[n]; continue; }
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
  const results: Partial<Record<VideoNumber, unknown>> = {};
  for (const n of numbers) {
    const entry = stored.data?.result?.videos?.[n];
    if (!entry || item.skipped[n] || entry.storagePath !== item.fileKeys[n]) continue;
    try { results[n] = analysisSnapshot(entry.result, item, n); } catch { /* Stale or unsupported results stay unconfirmed. */ }
  }
  return results;
}

export async function restoreAssessments(db: SupabaseClient, manager: string, people: StoredPerson[], local: Evaluation[]): Promise<Evaluation[]> {
  const [assessments, inputs, videos] = await Promise.all([
    db.from("assessments").select("id,person_id,created_at,answers").eq("manager_id", manager).order("created_at", { ascending: false }),
    db.from("assessment_posture_inputs").select("assessment_id,posture_type,is_skipped,selected_time_seconds,answers").eq("manager_id", manager),
    db.from("assessment_videos").select("assessment_id,posture_type,storage_path,original_filename").eq("manager_id", manager),
  ]);
  fail(assessments.error); fail(inputs.error); fail(videos.error);
  return people.map((person) => {
    const record = assessments.data?.find((row) => row.person_id === person.id);
    const cached = local.find((row) => row.id === person.id);
    const item = addEvaluation(createDashboardState(), person.name, person.id).evaluations[0];
    item.createdAt = person.created_at;
    item.assessmentId = record?.id ?? cached?.assessmentId ?? crypto.randomUUID();
    item.pendingSave = !record;
    if (!record) return cached ? { ...cached, assessmentId: item.assessmentId, pendingSave: true } : item;
    const path: unknown = record.answers?.__navigation?.lastPath;
    if (typeof path === "string" && /^\/(upload\/[123]|questions\/[123]\/[1234]|review|analysis|confirmation|results|report)$/.test(path)) item.lastPath = path;
    for (const n of numbers) {
      const input = (inputs.data as StoredInput[]).find((row) => row.assessment_id === record.id && row.posture_type === postures[n]);
      const video = (videos.data as StoredVideo[]).find((row) => row.assessment_id === record.id && row.posture_type === postures[n]);
      item.skipped[n] = input?.is_skipped ?? false;
      if (video && !item.skipped[n]) { checkOwner(video.storage_path, manager, record.id); item.fileKeys[n] = video.storage_path; }
      // A replacement may commit before inputs do: never apply the previous file's posture to it.
      if (!input || item.skipped[n] || input.answers?.__storage_path !== item.fileKeys[n]) continue;
      const time = input.selected_time_seconds === null ? null : Number(input.selected_time_seconds);
      item.selectedTimes[n] = time !== null && Number.isFinite(time) && time >= 0 ? time : null;
      item.answers[n] = Object.fromEntries(Object.entries(input.answers).filter(([key, value]) => !key.startsWith("__") && typeof value === "string")) as Record<string, string>;
    }
    if (cached?.pendingSave && cached.assessmentId === record.id) {
      item.pendingSave = true;
      for (const n of numbers) {
        if (cached.skipped[n]) {
          item.skipped[n] = true; item.fileKeys[n] = null; item.selectedTimes[n] = null; item.answers[n] = {};
        } else if (cached.fileKeys[n] === item.fileKeys[n]) {
          item.skipped[n] = false; item.selectedTimes[n] = cached.selectedTimes[n]; item.answers[n] = cached.answers[n];
        }
      }
      if (/^\/(upload\/[123]|questions\/[123]\/[1234]|review|analysis|confirmation|results|report)$/.test(cached.lastPath)) item.lastPath = cached.lastPath;
    }
    return item;
  });
}

export async function uploadAssessmentVideo(db: SupabaseClient, manager: string, item: Evaluation, number: VideoNumber, file: File): Promise<string> {
  if (!isVideoFile(file) || file.size === 0 || file.size > MAX_VIDEO_BYTES) throw new Error("50 MB 이하의 영상 파일을 선택해 주세요.");
  await ensureAssessment(db, manager, item);
  const old = await db.from("assessment_videos").select("storage_path").eq("assessment_id", item.assessmentId).eq("posture_type", postures[number]).maybeSingle();
  fail(old.error);
  if (old.data?.storage_path) checkOwner(old.data.storage_path, manager, item.assessmentId!);
  const duration = await videoDuration(file);
  const extension = file.name.match(/\.(mp4|mov|webm|m4v|avi)$/i)?.[1].toLowerCase() ?? "mp4";
  const path = `${manager}/${item.assessmentId}/${crypto.randomUUID()}.${extension}`;
  const uploaded = await db.storage.from(VIDEO_BUCKET).upload(path, file, { upsert: false, contentType: file.type || "application/octet-stream" });
  fail(uploaded.error);
  const saved = await db.from("assessment_videos").upsert({
    manager_id: manager, assessment_id: item.assessmentId, posture_type: postures[number],
    storage_path: path, original_filename: file.name, duration_seconds: duration,
  }, { onConflict: "assessment_id,posture_type" });
  if (saved.error) {
    await db.storage.from(VIDEO_BUCKET).remove([path]);
    throw new Error("영상 기록을 저장하지 못했습니다. 이전 영상은 유지됩니다.");
  }
  // shortcut: cleanup failures leave an unreferenced private object; add a cleanup job after the MVP.
  if (old.data?.storage_path) {
    checkOwner(old.data.storage_path, manager, item.assessmentId!);
    await db.storage.from(VIDEO_BUCKET).remove([old.data.storage_path]);
  }
  return path;
}

export async function downloadAssessmentVideos(db: SupabaseClient, manager: string, item: Evaluation): Promise<Partial<Record<VideoNumber, File>>> {
  const rows = await db.from("assessment_videos").select("assessment_id,posture_type,storage_path,original_filename").eq("assessment_id", item.assessmentId).eq("manager_id", manager);
  fail(rows.error);
  const files: Partial<Record<VideoNumber, File>> = {};
  for (const n of numbers) {
    const video = (rows.data as StoredVideo[]).find((row) => row.posture_type === postures[n] && row.storage_path === item.fileKeys[n]);
    if (!video || item.skipped[n]) continue;
    checkOwner(video.storage_path, manager, item.assessmentId!);
    const downloaded = await db.storage.from(VIDEO_BUCKET).download(video.storage_path);
    fail(downloaded.error);
    if (!downloaded.data || downloaded.data.size > MAX_VIDEO_BYTES) throw new Error("저장된 영상의 크기를 확인해 주세요.");
    files[n] = new File([downloaded.data], video.original_filename ?? `video-${n}.mp4`, { type: downloaded.data.type, lastModified: 0 });
  }
  return files;
}
