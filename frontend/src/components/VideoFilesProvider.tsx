"use client";

import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { addEvaluation, createDashboardState, dashboardStorageKey, fileIdentity, mergeStoredPeople, readDashboardState, updateEvaluation, type DashboardState, type Evaluation, type StoredPerson, type VideoNumber } from "@/lib/evaluationStore";
import { supabase } from "@/lib/supabaseClient";
import { workQuestionKeys } from "@/lib/questions";

export type { VideoNumber } from "@/lib/evaluationStore";
type VideoFiles = Record<VideoNumber, File | null>;
const emptyFiles = (): VideoFiles => ({ 1: null, 2: null, 3: null });
const emptyAnswers = (): Record<VideoNumber, Record<string, string>> => ({ 1: {}, 2: {}, 3: {} });
const emptyTimes = (): Record<VideoNumber, number | null> => ({ 1: null, 2: null, 3: null });

type ContextValue = {
  dashboard: DashboardState; ready: boolean; storageError: boolean; connectionError: string; activeEvaluation: Evaluation | null;
  files: VideoFiles; selectedTimes: Record<VideoNumber, number | null>;
  answers: Record<VideoNumber, Record<string, string>>; skipped: Record<VideoNumber, boolean>;
  activeVideos: VideoNumber[]; demoMode: boolean; resultVideo: VideoNumber;
  confirmedScenes: Record<VideoNumber, boolean>;
  confirmScene: (number: VideoNumber) => void;
  setEvaluatorName: (name: string) => Promise<void>; addPerson: (name: string) => Promise<void>;
  logOut: () => Promise<void>;
  selectPerson: (id: string) => string; savePath: (path: string) => void;
  setFile: (number: VideoNumber, file: File) => void; skipVideo: (number: VideoNumber) => void;
  setSelectedTime: (number: VideoNumber, time: number) => void;
  setAnswer: (number: VideoNumber, key: string, value: string) => void;
  startDemo: () => void; setResultVideo: (number: VideoNumber) => void;
};

const VideoFilesContext = createContext<ContextValue | null>(null);

export function VideoFilesProvider({ children }: { children: ReactNode }) {
  const [dashboard, setDashboard] = useState<DashboardState>(() => createDashboardState());
  const [ready, setReady] = useState(false);
  const [canPersist, setCanPersist] = useState(false);
  const [storageError, setStorageError] = useState(false);
  const [connectionError, setConnectionError] = useState("");
  const [filesByPerson, setFilesByPerson] = useState<Record<string, VideoFiles>>({});
  const [demoAnswers, setDemoAnswers] = useState(emptyAnswers);
  const [demoTimes, setDemoTimes] = useState(emptyTimes);
  const [demoConfirmed, setDemoConfirmed] = useState<Record<VideoNumber, boolean>>({ 1: false, 2: false, 3: false });
  const [demoMode, setDemoMode] = useState(false);
  const [resultVideo, setResultVideo] = useState<VideoNumber>(1);

  useEffect(() => {
    let cancelled = false;
    async function restore() {
      try {
        if (!supabase) throw new Error("DB 설정이 없습니다.");
        const saved = readDashboardState(localStorage.getItem(dashboardStorageKey)) ?? createDashboardState();
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
        if (!cancelled) {
          setDashboard(mergeStoredPeople(saved, managerName, (people ?? []) as StoredPerson[]));
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

  const activeEvaluation = dashboard.evaluations.find((item) => item.id === dashboard.activeId) ?? null;
  const files = activeEvaluation ? filesByPerson[activeEvaluation.id] ?? emptyFiles() : emptyFiles();
  const selectedTimes = activeEvaluation ? activeEvaluation.selectedTimes : demoTimes;
  const answers = activeEvaluation ? activeEvaluation.answers : demoAnswers;
  const confirmedScenes = activeEvaluation ? activeEvaluation.confirmedScenes : demoConfirmed;
  const skipped = activeEvaluation ? activeEvaluation.skipped : { 1: false, 2: false, 3: false };
  const activeVideos = ([1, 2, 3] as const).filter((number) => demoMode || !skipped[number]);

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
    setDashboard((current) => ({ ...current, evaluatorName: trimmed }));
  }

  async function addPerson(name: string) {
    if (!supabase) throw new Error("DB 설정이 없습니다.");
    const { data: userData, error: authError } = await supabase.auth.getUser();
    if (authError || !userData.user) throw authError ?? new Error("로그인이 필요합니다.");
    const id = crypto.randomUUID();
    const { error } = await supabase.from("people").insert({ id, manager_id: userData.user.id, name: name.trim() });
    if (error) throw error;
    setDashboard((current) => addEvaluation(current, name, id));
    setDemoMode(false);
    setResultVideo(1);
  }

  async function logOut() {
    if (!supabase) throw new Error("DB 설정이 없습니다.");
    const { error } = await supabase.auth.signOut({ scope: "local" });
    if (error) throw error;
    try { localStorage.removeItem(dashboardStorageKey); setStorageError(false); }
    catch { setStorageError(true); }
    setDashboard(createDashboardState());
    setFilesByPerson({});
    setDemoAnswers(emptyAnswers());
    setDemoTimes(emptyTimes());
    setDemoConfirmed({ 1: false, 2: false, 3: false });
    setDemoMode(false);
    setResultVideo(1);
    setConnectionError("");
  }

  function selectPerson(id: string): string {
    const person = dashboard.evaluations.find((item) => item.id === id);
    if (!person) return "/";
    setDashboard((current) => ({ ...current, activeId: id }));
    setDemoMode(false);
    setResultVideo(([1, 2, 3] as const).find((number) => !person.skipped[number]) ?? 1);
    const retained = filesByPerson[id] ?? emptyFiles();
    if ([1, 2, 3].some((number) => person.fileKeys[number as VideoNumber] && !retained[number as VideoNumber])) return "/upload/1";
    return person.lastPath === "/evaluation" ? "/upload/1" : person.lastPath;
  }

  function savePath(path: string) {
    if (!dashboard.activeId || demoMode || path === "/") return;
    const id = dashboard.activeId;
    const retained = filesByPerson[id] ?? emptyFiles();
    setDashboard((current) => updateEvaluation(current, id, (item) => {
      const restoringFiles = path.startsWith("/upload/") && !item.lastPath.startsWith("/upload/") &&
        ([1, 2, 3] as const).some((number) => item.fileKeys[number] && !retained[number]);
      return restoringFiles || item.lastPath === path ? item : { ...item, lastPath: path };
    }));
  }

  function setFile(number: VideoNumber, file: File) {
    if (!dashboard.activeId) return;
    const id = dashboard.activeId;
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
  }

  function skipVideo(number: VideoNumber) {
    if (!dashboard.activeId) return;
    const id = dashboard.activeId;
    setFilesByPerson((current) => ({ ...current, [id]: { ...(current[id] ?? emptyFiles()), [number]: null } }));
    setDashboard((current) => updateEvaluation(current, id, (item) => ({ ...item,
      skipped: { ...item.skipped, [number]: true },
      fileKeys: { ...item.fileKeys, [number]: null },
      selectedTimes: { ...item.selectedTimes, [number]: null },
      answers: { ...item.answers, [number]: {} },
      confirmedScenes: { ...item.confirmedScenes, [number]: false },
    })));
    if (resultVideo === number) setResultVideo(([1, 2, 3] as const).find((candidate) => candidate !== number && !skipped[candidate]) ?? 1);
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
  }

  function confirmScene(number: VideoNumber) {
    if (!dashboard.activeId) { setDemoConfirmed((current) => ({ ...current, [number]: true })); return; }
    const id = dashboard.activeId;
    setDashboard((current) => updateEvaluation(current, id, (item) => ({ ...item,
      confirmedScenes: { ...item.confirmedScenes, [number]: true },
    })));
  }

  return <VideoFilesContext.Provider value={{ dashboard, ready, storageError, connectionError, activeEvaluation, files, selectedTimes, answers,
    confirmedScenes, confirmScene, skipped, activeVideos, demoMode, resultVideo, setEvaluatorName, addPerson, logOut, selectPerson, savePath, setFile, skipVideo, setSelectedTime,
    setAnswer, startDemo, setResultVideo }}>{children}</VideoFilesContext.Provider>;
}

export function useVideoFiles(): ContextValue {
  const value = useContext(VideoFilesContext);
  if (!value) throw new Error("VideoFilesProvider is required");
  return value;
}
