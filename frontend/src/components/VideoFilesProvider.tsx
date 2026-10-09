"use client";

import { createContext, useContext, useState, type ReactNode } from "react";

export type VideoNumber = 1 | 2 | 3;

type VideoFilesContextValue = {
  files: Record<VideoNumber, File | null>;
  skipped: Record<VideoNumber, boolean>;
  activeVideos: VideoNumber[];
  selectedTimes: Record<VideoNumber, number | null>;
  answers: Record<VideoNumber, Record<string, string>>;
  demoMode: boolean;
  resultVideo: VideoNumber;
  setFile: (number: VideoNumber, file: File) => void;
  skipVideo: (number: VideoNumber) => void;
  setSelectedTime: (number: VideoNumber, time: number) => void;
  setAnswer: (number: VideoNumber, key: string, value: string) => void;
  startDemo: () => void;
  startNewEvaluation: () => void;
  setResultVideo: (number: VideoNumber) => void;
};

const VideoFilesContext = createContext<VideoFilesContextValue | null>(null);

export function VideoFilesProvider({ children }: { children: ReactNode }) {
  const [files, setFiles] = useState<Record<VideoNumber, File | null>>({ 1: null, 2: null, 3: null });
  const [skipped, setSkipped] = useState<Record<VideoNumber, boolean>>({ 1: false, 2: false, 3: false });
  const [selectedTimes, setSelectedTimes] = useState<Record<VideoNumber, number | null>>({ 1: null, 2: null, 3: null });
  const [answers, setAnswers] = useState<Record<VideoNumber, Record<string, string>>>({ 1: {}, 2: {}, 3: {} });
  const [demoMode, setDemoMode] = useState(false);
  const [resultVideo, setResultVideo] = useState<VideoNumber>(1);

  function setFile(number: VideoNumber, file: File) {
    setSkipped((current) => ({ ...current, [number]: false }));
    setFiles((current) => ({ ...current, [number]: file }));
    setSelectedTimes((current) => ({ ...current, [number]: null }));
    setAnswers((current) => ({ ...current, [number]: {} }));
  }

  function skipVideo(number: VideoNumber) {
    setSkipped((current) => ({ ...current, [number]: true }));
    setFiles((current) => ({ ...current, [number]: null }));
    setSelectedTimes((current) => ({ ...current, [number]: null }));
    setAnswers((current) => ({ ...current, [number]: {} }));
  }

  function setSelectedTime(number: VideoNumber, time: number) {
    setSelectedTimes((current) => ({ ...current, [number]: time }));
    if (selectedTimes[number] !== time) setAnswers((current) => ({ ...current, [number]: {} }));
  }

  function setAnswer(number: VideoNumber, key: string, value: string) {
    setAnswers((current) => ({ ...current, [number]: { ...current[number], [key]: value } }));
  }

  function startDemo() {
    setDemoMode(true);
    setResultVideo(1);
  }

  function startNewEvaluation() {
    setSkipped({ 1: false, 2: false, 3: false });
    setDemoMode(false);
    setFiles({ 1: null, 2: null, 3: null });
    setSelectedTimes({ 1: null, 2: null, 3: null });
    setAnswers({ 1: {}, 2: {}, 3: {} });
    setResultVideo(1);
  }

  const activeVideos = ([1, 2, 3] as const).filter((number) => demoMode || !skipped[number]);

  return <VideoFilesContext.Provider value={{ files, skipped, activeVideos, skipVideo, selectedTimes, answers, demoMode, resultVideo, setFile, setSelectedTime, setAnswer, startDemo, startNewEvaluation, setResultVideo }}>{children}</VideoFilesContext.Provider>;
}

export function useVideoFiles(): VideoFilesContextValue {
  const value = useContext(VideoFilesContext);
  if (!value) throw new Error("VideoFilesProvider is required");
  return value;
}
