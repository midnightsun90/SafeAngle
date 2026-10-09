"use client";

import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { addEvaluation, createDashboardState, dashboardStorageKey, fileIdentity, readDashboardState, updateEvaluation, type DashboardState, type Evaluation, type VideoNumber, type WorkContext } from "@/lib/evaluationStore";

export type { VideoNumber } from "@/lib/evaluationStore";
type VideoFiles = Record<VideoNumber, File | null>;
const emptyFiles = (): VideoFiles => ({ 1: null, 2: null, 3: null });
const emptyAnswers = (): Record<VideoNumber, Record<string, string>> => ({ 1: {}, 2: {}, 3: {} });
const emptyTimes = (): Record<VideoNumber, number | null> => ({ 1: null, 2: null, 3: null });

type ContextValue = {
  dashboard: DashboardState; ready: boolean; storageError: boolean; activeEvaluation: Evaluation | null;
  files: VideoFiles; selectedTimes: Record<VideoNumber, number | null>;
  answers: Record<VideoNumber, Record<string, string>>; skipped: Record<VideoNumber, boolean>;
  activeVideos: VideoNumber[]; demoMode: boolean; resultVideo: VideoNumber;
  setEvaluatorName: (name: string) => void; addPerson: (name: string) => void;
  selectPerson: (id: string) => string; setWork: (work: WorkContext) => void; savePath: (path: string) => void;
  setFile: (number: VideoNumber, file: File) => void; skipVideo: (number: VideoNumber) => void;
  setSelectedTime: (number: VideoNumber, time: number) => void;
  setAnswer: (number: VideoNumber, key: string, value: string) => void;
  startDemo: () => void; setResultVideo: (number: VideoNumber) => void;
};

const VideoFilesContext = createContext<ContextValue | null>(null);

export function VideoFilesProvider({ children }: { children: ReactNode }) {
  const [dashboard, setDashboard] = useState<DashboardState>(() => createDashboardState());
  const [ready, setReady] = useState(false);
  const [storageError, setStorageError] = useState(false);
  const [filesByPerson, setFilesByPerson] = useState<Record<string, VideoFiles>>({});
  const [demoAnswers, setDemoAnswers] = useState(emptyAnswers);
  const [demoTimes, setDemoTimes] = useState(emptyTimes);
  const [demoMode, setDemoMode] = useState(false);
  const [resultVideo, setResultVideo] = useState<VideoNumber>(1);

  useEffect(() => {
    try {
      const saved = readDashboardState(localStorage.getItem(dashboardStorageKey));
      if (saved) setDashboard(saved);
    } catch { setStorageError(true); }
    setReady(true);
  }, []);

  useEffect(() => {
    if (!ready) return;
    try { localStorage.setItem(dashboardStorageKey, JSON.stringify(dashboard)); setStorageError(false); }
    catch { setStorageError(true); }
  }, [dashboard, ready]);

  const activeEvaluation = dashboard.evaluations.find((item) => item.id === dashboard.activeId) ?? null;
  const files = activeEvaluation ? filesByPerson[activeEvaluation.id] ?? emptyFiles() : emptyFiles();
  const selectedTimes = activeEvaluation ? activeEvaluation.selectedTimes : demoTimes;
  const answers = activeEvaluation ? activeEvaluation.answers : demoAnswers;
  const skipped = activeEvaluation ? activeEvaluation.skipped : { 1: false, 2: false, 3: false };
  const activeVideos = ([1, 2, 3] as const).filter((number) => demoMode || !skipped[number]);

  function setEvaluatorName(name: string) {
    const trimmed = name.trim();
    if (trimmed) setDashboard((current) => ({ ...current, evaluatorName: trimmed }));
  }

  function addPerson(name: string) {
    setDashboard((current) => addEvaluation(current, name, crypto.randomUUID()));
    setDemoMode(false);
    setResultVideo(1);
  }

  function selectPerson(id: string): string {
    const person = dashboard.evaluations.find((item) => item.id === id);
    if (!person) return "/";
    setDashboard((current) => ({ ...current, activeId: id }));
    setDemoMode(false);
    setResultVideo(([1, 2, 3] as const).find((number) => !person.skipped[number]) ?? 1);
    const retained = filesByPerson[id] ?? emptyFiles();
    if (person.lastPath !== "/evaluation" && [1, 2, 3].some((number) => person.fileKeys[number as VideoNumber] && !retained[number as VideoNumber])) return "/upload/1";
    return person.lastPath;
  }

  function setWork(work: WorkContext) {
    if (!dashboard.activeId) return;
    const id = dashboard.activeId;
    setDashboard((current) => updateEvaluation(current, id, (item) => ({ ...item, work })));
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
    })));
    if (resultVideo === number) setResultVideo(([1, 2, 3] as const).find((candidate) => candidate !== number && !skipped[candidate]) ?? 1);
  }

  function setSelectedTime(number: VideoNumber, time: number) {
    if (!dashboard.activeId) { setDemoTimes((current) => ({ ...current, [number]: time })); return; }
    const id = dashboard.activeId;
    setDashboard((current) => updateEvaluation(current, id, (item) => ({ ...item,
      selectedTimes: { ...item.selectedTimes, [number]: time },
      answers: item.selectedTimes[number] === time ? item.answers : { ...item.answers, [number]: {} },
    })));
  }

  function setAnswer(number: VideoNumber, key: string, value: string) {
    if (!dashboard.activeId) { setDemoAnswers((current) => ({ ...current, [number]: { ...current[number], [key]: value } })); return; }
    const id = dashboard.activeId;
    setDashboard((current) => updateEvaluation(current, id, (item) => ({ ...item,
      answers: { ...item.answers, [number]: { ...item.answers[number], [key]: value } },
    })));
  }

  function startDemo() {
    setDashboard((current) => ({ ...current, activeId: null }));
    setDemoAnswers(emptyAnswers()); setDemoTimes(emptyTimes()); setDemoMode(true); setResultVideo(1);
  }

  return <VideoFilesContext.Provider value={{ dashboard, ready, storageError, activeEvaluation, files, selectedTimes, answers,
    skipped, activeVideos, demoMode, resultVideo, setEvaluatorName, addPerson, selectPerson, setWork, savePath, setFile, skipVideo, setSelectedTime,
    setAnswer, startDemo, setResultVideo }}>{children}</VideoFilesContext.Provider>;
}

export function useVideoFiles(): ContextValue {
  const value = useContext(VideoFilesContext);
  if (!value) throw new Error("VideoFilesProvider is required");
  return value;
}
