"use client";

import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import { addEvaluation, createDashboardState, dashboardStorageKey, fileIdentity, mergeStoredAssessments, mergeStoredPeople, postureInputRows, readDashboardState, updateEvaluation, type DashboardState, type Evaluation, type StoredAssessment, type StoredPerson, type StoredPostureInput, type VideoNumber } from "@/lib/evaluationStore";
import { supabase } from "@/lib/supabaseClient";
import { workQuestionKeys } from "@/lib/questions";
import { storagePathForVideo, validateVideoFile, videoBucket, videoPostureTypes, type VideoPostureType } from "@/lib/videoStorage";
import { uploadVideo, videoDuration } from "@/lib/videoStorageClient";
import { saveAssessmentInputs, persistAnalysisResult, restoreAnalysisResults } from "@/lib/analysisStorage";

export type { VideoNumber } from "@/lib/evaluationStore";
type VideoFiles = Record<VideoNumber, File | null>;
export type StoredVideo = { storage_path: string; original_filename: string | null; duration_seconds: number | null };
type StoredVideos = Record<VideoNumber, StoredVideo | null>;
const emptyFiles = (): VideoFiles => ({ 1: null, 2: null, 3: null });
const emptyStoredVideos = (): StoredVideos => ({ 1: null, 2: null, 3: null });
const emptyAnswers = (): Record<VideoNumber, Record<string, string>> => ({ 1: {}, 2: {}, 3: {} });
const emptyTimes = (): Record<VideoNumber, number | null> => ({ 1: null, 2: null, 3: null });
const demoStorageKey = "safeangle-preview-demo";
export const previewRealKey = "safeangle-preview-real";
const pendingSyncKey = "safeangle.pending-inputs.v1";
function readPendingSync(): Record<string, string> {
  try {
    const value = JSON.parse(localStorage.getItem(pendingSyncKey) ?? "{}");
    return value && typeof value === "object" && !Array.isArray(value) ? value : {};
  } catch { return {}; }
}
function writePendingSync(value: Record<string, string>): void {
  if (Object.keys(value).length) localStorage.setItem(pendingSyncKey, JSON.stringify(value));
  else localStorage.removeItem(pendingSyncKey);
}
function readDemoSession(): boolean {
  try { return sessionStorage.getItem(demoStorageKey) === "1"; }
  catch { return false; }
}
function writeDemoSession(enabled: boolean): void {
  try {
    if (enabled) sessionStorage.setItem(demoStorageKey, "1");
    else sessionStorage.removeItem(demoStorageKey);
  } catch { /* Preview still works until the tab reloads. */ }
}

type ContextValue = {
  storedResults: Partial<Record<VideoNumber, unknown>>;
  persistResult: (number: VideoNumber, result: unknown) => Promise<void>;
  dashboard: DashboardState; ready: boolean; storageError: boolean; connectionError: string; activeEvaluation: Evaluation | null;
  files: VideoFiles; storedVideos: StoredVideos; selectedTimes: Record<VideoNumber, number | null>;
  answers: Record<VideoNumber, Record<string, string>>; skipped: Record<VideoNumber, boolean>;
  activeVideos: VideoNumber[]; demoMode: boolean; resultVideo: VideoNumber;
  confirmedScenes: Record<VideoNumber, boolean>;
  confirmScene: (number: VideoNumber) => void;
  setEvaluatorName: (name: string) => Promise<void>; addPerson: (name: string) => Promise<void>;
  logOut: () => Promise<void>;
  selectPerson: (id: string) => string; savePath: (path: string) => void;
  setFile: (number: VideoNumber, file: File, onProgress?: (percent: number) => void) => Promise<void>;
  skipVideo: (number: VideoNumber) => Promise<void>;
  setSelectedTime: (number: VideoNumber, time: number) => void;
  setAnswer: (number: VideoNumber, key: string, value: string) => void;
  startDemo: () => void; leaveDemo: () => void; setResultVideo: (number: VideoNumber) => void;
};

const VideoFilesContext = createContext<ContextValue | null>(null);

export function VideoFilesProvider({ children }: { children: ReactNode }) {
  const [dashboard, setDashboard] = useState<DashboardState>(() => createDashboardState());
  const [ready, setReady] = useState(false);
  const [canPersist, setCanPersist] = useState(false);
  const [storageError, setStorageError] = useState(false);
  const [connectionError, setConnectionError] = useState("");
  const [managerId, setManagerId] = useState<string | null>(null);
  const writeQueue = useRef<Promise<void>>(Promise.resolve());
  const lastSaved = useRef(new Map<string, string>());
  const syncVersion = useRef(0);
  const [filesByPerson, setFilesByPerson] = useState<Record<string, VideoFiles>>({});
  const [storedVideosByPerson, setStoredVideosByPerson] = useState<Record<string, StoredVideos>>({});
  const [demoAnswers, setDemoAnswers] = useState(emptyAnswers);
  const [demoTimes, setDemoTimes] = useState(emptyTimes);
  const [demoConfirmed, setDemoConfirmed] = useState<Record<VideoNumber, boolean>>({ 1: false, 2: false, 3: false });
  const [demoMode, setDemoMode] = useState(false);
  const [resultVideo, setResultVideo] = useState<VideoNumber>(1);
  const [storedResults, setStoredResults] = useState<Partial<Record<VideoNumber, unknown>>>({});
  const [resultVersion, setResultVersion] = useState(0);
  const latest = useRef({ dashboard, managerId, storedVideosByPerson });
  latest.current = { dashboard, managerId, storedVideosByPerson };

  async function persistResult(number: VideoNumber, result: unknown): Promise<void> {
    const current = latest.current;
    const item = current.dashboard.evaluations.find((row) => row.id === current.dashboard.activeId);
    const path = item ? current.storedVideosByPerson[item.id]?.[number]?.storage_path ?? null : null;
    if (!item || !current.managerId || !supabase) throw new Error("평가와 로그인 상태를 확인해 주세요.");
    const client = supabase;
    const owner = current.managerId;
    const version = syncVersion.current;
    const fingerprint = JSON.stringify(postureInputRows(item, owner));
    const next = writeQueue.current.catch(() => {}).then(async () => {
      const fresh = latest.current.dashboard.evaluations.find((row) => row.id === item.id);
      if (version !== syncVersion.current || !fresh || JSON.stringify(postureInputRows(fresh, owner)) !== fingerprint || latest.current.storedVideosByPerson[item.id]?.[number]?.storage_path !== path) throw new Error("입력이 변경되어 이전 결과를 저장하지 않았습니다.");
      await saveAssessmentInputs(client, owner, item);
      await persistAnalysisResult(client, owner, item, number, result, path);
      lastSaved.current.set(item.assessmentId!, fingerprint);
      const after = latest.current.dashboard.evaluations.find((row) => row.id === item.id);
      if (version === syncVersion.current && after && latest.current.dashboard.activeId === item.id && JSON.stringify(postureInputRows(after, owner)) === fingerprint && latest.current.storedVideosByPerson[item.id]?.[number]?.storage_path === path) setStoredResults((previous) => ({ ...previous, [number]: result }));
    });
    writeQueue.current = next.catch(() => { setConnectionError("분석 결과를 저장하지 못했습니다. 결과 확인 후 다시 저장해 주세요."); });
    await next;
  }

  useEffect(() => {
    let cancelled = false;
    async function restore() {
      try {
        const previewDemo = process.env.NODE_ENV === "development" && readDemoSession();
        if (previewDemo) setDemoMode(true);
        if (!supabase) throw new Error("DB 설정이 없습니다.");
        const savedState = readDashboardState(localStorage.getItem(dashboardStorageKey)) ?? createDashboardState();
        const saved = previewDemo ? { ...savedState, activeId: null } : savedState;
        const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
        if (sessionError) throw sessionError;
        let user = sessionData.session?.user ?? null;
        if (!user && saved.evaluatorName) {
          const { data, error } = await supabase.auth.signInAnonymously();
          if (error) throw error;
          user = data.user;
        }
        if (!user) { if (!cancelled) setCanPersist(true); return; }
        const { data: profile, error: profileError } = await supabase.from("managers").select("name").eq("id", user.id).maybeSingle();
        if (profileError) throw profileError;
        let managerName = profile?.name ?? "";
        if (!managerName && saved.evaluatorName) {
          const { error } = await supabase.from("managers").insert({ id: user.id, name: saved.evaluatorName });
          if (error) throw error;
          managerName = saved.evaluatorName;
        }
        if (!managerName) { if (!cancelled) setCanPersist(true); return; }
        const { data: existing, error: peopleError } = await supabase.from("people")
          .select("id,name,created_at").eq("manager_id", user.id).order("created_at", { ascending: false });
        if (peopleError) throw peopleError;
        const existingIds = new Set((existing ?? []).map((item) => item.id));
        const missing = saved.evaluations.filter((item) => !existingIds.has(item.id));
        if (missing.length) {
          const { error } = await supabase.from("people").insert(missing.map((item) => ({
            id: item.id, manager_id: user.id, name: item.name, created_at: item.createdAt,
          })));
          if (error) throw error;
        }
        const { data: people, error: refreshError } = missing.length
          ? await supabase.from("people").select("id,name,created_at").eq("manager_id", user.id).order("created_at", { ascending: false })
          : { data: existing, error: null };
        if (refreshError) throw refreshError;
        const mergedPeople = mergeStoredPeople(saved, managerName, (people ?? []) as StoredPerson[]);
        const { data: existingAssessments, error: assessmentError } = await supabase.from("assessments")
          .select("id,person_id,created_at").eq("manager_id", user.id).order("created_at", { ascending: false });
        if (assessmentError) throw assessmentError;
        const assessedPeople = new Set((existingAssessments ?? []).map((row) => row.person_id));
        const missingAssessments = mergedPeople.evaluations.filter((item) => !assessedPeople.has(item.id));
        if (missingAssessments.length) {
          const { error } = await supabase.from("assessments").insert(missingAssessments.map((item) => ({
            id: item.assessmentId ?? crypto.randomUUID(), manager_id: user.id, person_id: item.id,
          })));
          if (error) throw error;
        }
        const { data: assessments, error: assessmentRefreshError } = missingAssessments.length
          ? await supabase.from("assessments").select("id,person_id,created_at").eq("manager_id", user.id).order("created_at", { ascending: false })
          : { data: existingAssessments, error: null };
        if (assessmentRefreshError) throw assessmentRefreshError;
        const { data: inputs, error: inputError } = await supabase.from("assessment_posture_inputs")
          .select("assessment_id,posture_type,is_skipped,selected_time_seconds,answers").eq("manager_id", user.id);
        if (inputError) throw inputError;
        const { data: videos, error: videoError } = await supabase.from("assessment_videos")
          .select("assessment_id,posture_type,storage_path,original_filename,duration_seconds").eq("manager_id", user.id);
        if (videoError) throw videoError;
        if (!cancelled) {
          const pending = new Set(Object.keys(readPendingSync()));
          setDashboard(mergeStoredAssessments(mergedPeople, (assessments ?? []) as StoredAssessment[], (inputs ?? []) as StoredPostureInput[], pending));
          const latestAssessmentIds = new Map<string, string>();
          for (const assessment of assessments ?? []) {
            if (!latestAssessmentIds.has(assessment.person_id)) latestAssessmentIds.set(assessment.person_id, assessment.id);
          }
          const personByAssessment = new Map([...latestAssessmentIds].map(([personId, assessmentId]) => [assessmentId, personId]));
          const restoredVideos: Record<string, StoredVideos> = {};
          for (const video of videos ?? []) {
            const personId = personByAssessment.get(video.assessment_id);
            const postureIndex = videoPostureTypes.indexOf(video.posture_type as VideoPostureType);
            if (!personId || postureIndex < 0) continue;
            const number = (postureIndex + 1) as VideoNumber;
            restoredVideos[personId] ??= emptyStoredVideos();
            restoredVideos[personId][number] = video;
          }
          setStoredVideosByPerson(restoredVideos);
          setManagerId(user.id);
          setCanPersist(true);
        }
      } catch {
        if (!cancelled) setConnectionError("DB에 연결하지 못했습니다. 인터넷 연결을 확인하고 새로고침해 주세요.");
      } finally {
        if (!cancelled) setReady(true);
      }
    }
    void restore();
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    if (!ready || !canPersist) return;
    try { localStorage.setItem(dashboardStorageKey, JSON.stringify(dashboard)); setStorageError(false); }
    catch { setStorageError(true); }
  }, [dashboard, ready, canPersist]);

  useEffect(() => {
    const client = supabase;
    if (!ready || !canPersist || !managerId || demoMode || !client) return;
    const currentVersion = syncVersion.current;
    const evaluations = dashboard.evaluations.filter((item) => item.assessmentId);
    try {
      const pending = readPendingSync();
      for (const item of evaluations) {
        if (!item.assessmentId) continue;
        const snapshot = JSON.stringify(postureInputRows(item, managerId));
        if (lastSaved.current.get(item.assessmentId) !== snapshot) pending[item.assessmentId] = snapshot;
      }
      writePendingSync(pending);
    } catch { setStorageError(true); }
    const timer = window.setTimeout(() => {
      writeQueue.current = writeQueue.current.catch(() => {}).then(async () => {
        if (currentVersion !== syncVersion.current) return;
        for (const item of evaluations) {
          const rows = postureInputRows(item, managerId);
          const snapshot = JSON.stringify(rows);
          if (!item.assessmentId || lastSaved.current.get(item.assessmentId) === snapshot) continue;
          const current = latest.current.dashboard.evaluations.find((entry) => entry.id === item.id);
          if (!current || JSON.stringify(postureInputRows(current, managerId)) !== snapshot) continue;
          await saveAssessmentInputs(client, managerId, item);
          lastSaved.current.set(item.assessmentId, snapshot);
          setResultVersion((value) => value + 1);
          const pending = readPendingSync();
          if (pending[item.assessmentId] === snapshot) {
            delete pending[item.assessmentId];
            writePendingSync(pending);
          }
        }
        if (currentVersion === syncVersion.current) setConnectionError("");
      }).catch(() => {
        if (currentVersion === syncVersion.current) setConnectionError("평가 내용을 DB에 저장하지 못했습니다. 인터넷 연결을 확인하고 새로고침해 주세요.");
      });
    }, 300);
    return () => window.clearTimeout(timer);
  }, [dashboard, ready, canPersist, managerId, demoMode]);

  const activeEvaluation = dashboard.evaluations.find((item) => item.id === dashboard.activeId) ?? null;
  const files = activeEvaluation ? filesByPerson[activeEvaluation.id] ?? emptyFiles() : emptyFiles();
  const storedVideos = activeEvaluation ? storedVideosByPerson[activeEvaluation.id] ?? emptyStoredVideos() : emptyStoredVideos();
  const selectedTimes = activeEvaluation ? activeEvaluation.selectedTimes : demoTimes;
  const answers = activeEvaluation ? activeEvaluation.answers : demoAnswers;
  const confirmedScenes = activeEvaluation ? activeEvaluation.confirmedScenes : demoConfirmed;
  const skipped = activeEvaluation ? activeEvaluation.skipped : { 1: false, 2: false, 3: false };
  const activeVideos = ([1, 2, 3] as const).filter((number) => demoMode || !skipped[number]);

  useEffect(() => {
    let cancelled = false;
    setStoredResults({});
    if (!activeEvaluation?.assessmentId || !supabase || !managerId || demoMode) return;
    const snapshot = JSON.stringify(postureInputRows(activeEvaluation, managerId));
    if (lastSaved.current.get(activeEvaluation.assessmentId) !== snapshot) return;
    void restoreAnalysisResults(supabase, managerId, activeEvaluation).then((results) => { if (!cancelled) setStoredResults(results); })
      .catch(() => { if (!cancelled) setConnectionError("저장된 결과를 불러오지 못했습니다."); });
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dashboard.activeId, managerId, demoMode, resultVersion, JSON.stringify(activeEvaluation), JSON.stringify(storedVideos)]);

  async function setEvaluatorName(name: string) {
    const trimmed = name.trim();
    if (!trimmed || !supabase) throw new Error("DB 설정이 없습니다.");
    const { data: session } = await supabase.auth.getSession();
    let user = session.session?.user;
    if (!user) {
      const { data, error } = await supabase.auth.signInAnonymously();
      if (error) throw error;
      user = data.user ?? undefined;
    }
    if (!user) throw new Error("로그인에 실패했습니다.");
    const { error } = await supabase.from("managers").upsert({ id: user.id, name: trimmed });
    if (error) throw error;
    setConnectionError("");
    setCanPersist(true);
    setManagerId(user.id);
    setDashboard((current) => ({ ...current, evaluatorName: trimmed }));
  }

  async function addPerson(name: string) {
    if (!supabase) throw new Error("DB 설정이 없습니다.");
    const { data: userData, error: authError } = await supabase.auth.getUser();
    if (authError || !userData.user) throw authError ?? new Error("로그인이 필요합니다.");
    const id = crypto.randomUUID();
    const assessmentId = crypto.randomUUID();
    const { error } = await supabase.from("people").insert({ id, manager_id: userData.user.id, name: name.trim() });
    if (error) throw error;
    const { error: assessmentError } = await supabase.from("assessments").insert({
      id: assessmentId, manager_id: userData.user.id, person_id: id,
    });
    if (assessmentError) {
      await supabase.from("people").delete().eq("id", id).eq("manager_id", userData.user.id);
      throw assessmentError;
    }
    setDashboard((current) => addEvaluation(current, name, id, assessmentId));
    setDemoMode(false);
    writeDemoSession(false);
    setResultVideo(1);
  }

  async function logOut() {
    if (!supabase) throw new Error("DB 설정이 없습니다.");
    await writeQueue.current;
    if (managerId) {
      for (const item of dashboard.evaluations) {
        if (!item.assessmentId) continue;
        const rows = postureInputRows(item, managerId);
        const snapshot = JSON.stringify(rows);
        if (lastSaved.current.get(item.assessmentId) === snapshot) continue;
        await saveAssessmentInputs(supabase, managerId, item);
        lastSaved.current.set(item.assessmentId, snapshot);
      }
    }
    syncVersion.current += 1;
    const { error } = await supabase.auth.signOut({ scope: "local" });
    if (error) throw error;
    try { localStorage.removeItem(dashboardStorageKey); localStorage.removeItem(pendingSyncKey); setStorageError(false); }
    catch { setStorageError(true); }
    setDashboard(createDashboardState());
    setManagerId(null);
    lastSaved.current.clear();
    setFilesByPerson({});
    setStoredVideosByPerson({});
    setDemoAnswers(emptyAnswers());
    setDemoTimes(emptyTimes());
    setDemoConfirmed({ 1: false, 2: false, 3: false });
    setDemoMode(false);
    writeDemoSession(false);
    setResultVideo(1);
    setConnectionError("");
  }

  function selectPerson(id: string): string {
    const person = dashboard.evaluations.find((item) => item.id === id);
    if (!person) return "/";
    setDashboard((current) => ({ ...current, activeId: id }));
    setDemoMode(false);
    writeDemoSession(false);
    setResultVideo(([1, 2, 3] as const).find((number) => !person.skipped[number]) ?? 1);
    const retained = filesByPerson[id] ?? emptyFiles();
    const stored = storedVideosByPerson[id] ?? emptyStoredVideos();
    if ([1, 2, 3].some((number) => person.fileKeys[number as VideoNumber] && !retained[number as VideoNumber] && !stored[number as VideoNumber])) return "/upload/1";
    return person.lastPath === "/evaluation" ? "/upload/1" : person.lastPath;
  }

  function savePath(path: string) {
    if (!dashboard.activeId || demoMode || path === "/") return;
    const id = dashboard.activeId;
    const retained = filesByPerson[id] ?? emptyFiles();
    const stored = storedVideosByPerson[id] ?? emptyStoredVideos();
    setDashboard((current) => updateEvaluation(current, id, (item) => {
      const restoringFiles = path.startsWith("/upload/") && !item.lastPath.startsWith("/upload/") &&
        ([1, 2, 3] as const).some((number) => item.fileKeys[number] && !retained[number] && !stored[number]);
      return restoringFiles || item.lastPath === path ? item : { ...item, lastPath: path };
    }));
  }

  async function setFile(number: VideoNumber, file: File, onProgress?: (percent: number) => void) {
    const validationError = validateVideoFile(file);
    if (validationError) throw new Error(validationError);
    if (!activeEvaluation?.assessmentId || !managerId || !supabase) throw new Error("평가를 먼저 시작해 주세요.");
    const { data: userData, error: authError } = await supabase.auth.getUser();
    if (authError || userData.user?.id !== managerId) throw new Error("로그인을 확인하지 못했습니다. 새로고침해 주세요.");
    const id = activeEvaluation.id;
    const posture = videoPostureTypes[number - 1];
    const path = storagePathForVideo(managerId, activeEvaluation.assessmentId, posture, file.name);
    const previousPath = storedVideos[number]?.storage_path;
    const duration = await videoDuration(file);
    await uploadVideo(file, path, onProgress);
    const { error } = await supabase.from("assessment_videos").upsert({
      manager_id: managerId, assessment_id: activeEvaluation.assessmentId, posture_type: posture,
      storage_path: path, original_filename: file.name, duration_seconds: duration,
    }, { onConflict: "assessment_id,posture_type" });
    if (error) {
      await supabase.storage.from(videoBucket).remove([path]);
      throw error;
    }
    setStoredVideosByPerson((current) => ({ ...current, [id]: {
      ...(current[id] ?? emptyStoredVideos()),
      [number]: { storage_path: path, original_filename: file.name, duration_seconds: duration },
    } }));
    setFilesByPerson((current) => ({ ...current, [id]: { ...(current[id] ?? emptyFiles()), [number]: file } }));
    setDashboard((current) => updateEvaluation(current, id, (item) => {
      const sameFile = item.fileKeys[number] === fileIdentity(file);
      return { ...item,
        fileKeys: { ...item.fileKeys, [number]: fileIdentity(file) },
        skipped: { ...item.skipped, [number]: false },
        selectedTimes: sameFile ? item.selectedTimes : { ...item.selectedTimes, [number]: null },
        answers: sameFile ? item.answers : { ...item.answers, [number]: {} },
        confirmedScenes: sameFile ? item.confirmedScenes : { ...item.confirmedScenes, [number]: false },
      };
    }));
    if (previousPath && previousPath !== path) await supabase.storage.from(videoBucket).remove([previousPath]);
  }

  async function skipVideo(number: VideoNumber) {
    if (!activeEvaluation || !supabase) return;
    const id = activeEvaluation.id;
    const existing = storedVideos[number];
    if (existing && activeEvaluation.assessmentId) {
      const { error } = await supabase.from("assessment_videos").delete()
        .eq("assessment_id", activeEvaluation.assessmentId).eq("posture_type", videoPostureTypes[number - 1]);
      if (error) throw error;
    }
    setStoredVideosByPerson((current) => ({ ...current, [id]: { ...(current[id] ?? emptyStoredVideos()), [number]: null } }));
    setFilesByPerson((current) => ({ ...current, [id]: { ...(current[id] ?? emptyFiles()), [number]: null } }));
    setDashboard((current) => updateEvaluation(current, id, (item) => ({ ...item,
      skipped: { ...item.skipped, [number]: true },
      fileKeys: { ...item.fileKeys, [number]: null },
      selectedTimes: { ...item.selectedTimes, [number]: null },
      answers: { ...item.answers, [number]: {} },
      confirmedScenes: { ...item.confirmedScenes, [number]: false },
    })));
    if (resultVideo === number) setResultVideo(([1, 2, 3] as const).find((candidate) => candidate !== number && !skipped[candidate]) ?? 1);
    if (existing) await supabase.storage.from(videoBucket).remove([existing.storage_path]);
  }

  function setSelectedTime(number: VideoNumber, time: number) {
    if (!dashboard.activeId) {
      setDemoTimes((current) => ({ ...current, [number]: time }));
      if (demoTimes[number] !== time) {
        setDemoAnswers((current) => ({ ...current, [number]: Object.fromEntries(Object.entries(current[number]).filter(([key]) => workQuestionKeys.includes(key))) }));
        setDemoConfirmed((current) => ({ ...current, [number]: false }));
      }
      return;
    }
    const id = dashboard.activeId;
    setDashboard((current) => updateEvaluation(current, id, (item) => ({ ...item,
      selectedTimes: { ...item.selectedTimes, [number]: time },
      answers: item.selectedTimes[number] === time ? item.answers : { ...item.answers, [number]: Object.fromEntries(Object.entries(item.answers[number]).filter(([key]) => workQuestionKeys.includes(key))) },
      confirmedScenes: item.selectedTimes[number] === time ? item.confirmedScenes : { ...item.confirmedScenes, [number]: false },
    })));
  }

  function setAnswer(number: VideoNumber, key: string, value: string) {
    if (!dashboard.activeId) {
      setDemoAnswers((current) => ({ ...current, [number]: { ...current[number], [key]: value } }));
      setDemoConfirmed((current) => ({ ...current, [number]: false }));
      return;
    }
    const id = dashboard.activeId;
    setDashboard((current) => updateEvaluation(current, id, (item) => ({ ...item,
      answers: { ...item.answers, [number]: { ...item.answers[number], [key]: value } },
      confirmedScenes: { ...item.confirmedScenes, [number]: false },
    })));
  }

  function startDemo() {
    setDemoConfirmed({ 1: false, 2: false, 3: false });
    setDashboard((current) => ({ ...current, activeId: null }));
    setDemoAnswers(emptyAnswers()); setDemoTimes(emptyTimes()); setDemoMode(true); setResultVideo(1);
    writeDemoSession(true);
  }

  function leaveDemo() {
    writeDemoSession(false);
    try { sessionStorage.setItem(previewRealKey, "1"); } catch { /* Real evaluation remains available until reload. */ }
    setDemoMode(false);
  }

  function confirmScene(number: VideoNumber) {
    if (!dashboard.activeId) { setDemoConfirmed((current) => ({ ...current, [number]: true })); return; }
    const id = dashboard.activeId;
    setDashboard((current) => updateEvaluation(current, id, (item) => ({ ...item,
      confirmedScenes: { ...item.confirmedScenes, [number]: true },
    })));
  }

  return <VideoFilesContext.Provider value={{ storedResults, persistResult, dashboard, ready, storageError, connectionError, activeEvaluation, files, storedVideos, selectedTimes, answers,
    confirmedScenes, confirmScene, skipped, activeVideos, demoMode, resultVideo, setEvaluatorName, addPerson, logOut, selectPerson, savePath, setFile, skipVideo, setSelectedTime,
    setAnswer, startDemo, leaveDemo, setResultVideo }}>{children}</VideoFilesContext.Provider>;
}

export function useVideoFiles(): ContextValue {
  const value = useContext(VideoFilesContext);
  if (!value) throw new Error("VideoFilesProvider is required");
  return value;
}
