"use client";

import { createContext, useCallback, useContext, useState, type ReactNode } from "react";
import type { RebaResult } from "../../../lib/reba/types.ts";

export type VideoNumber = 1 | 2 | 3;

type VideoFilesContextValue = {
  files: Record<VideoNumber, File | null>;
  selectedTimes: Record<VideoNumber, number | null>;
  answers: Record<VideoNumber, Record<string, string>>;
  rebaResults: Record<VideoNumber, RebaResult | null>;
  demoMode: boolean;
  resultVideo: VideoNumber;
  setFile: (number: VideoNumber, file: File) => void;
  replaceFiles: (files: readonly File[]) => void;
  publishResult: (number: VideoNumber, result: RebaResult | null) => void;
  setSelectedTime: (number: VideoNumber, time: number) => void;
  setAnswer: (number: VideoNumber, key: string, value: string) => void;
  startDemo: () => void;
  startNewEvaluation: () => void;
  setResultVideo: (number: VideoNumber) => void;
};

const VideoFilesContext = createContext<VideoFilesContextValue | null>(null);

export function VideoFilesProvider({ children }: { children: ReactNode }) {
  const [files, setFiles] = useState<Record<VideoNumber, File | null>>({ 1: null, 2: null, 3: null });
  const [selectedTimes, setSelectedTimes] = useState<Record<VideoNumber, number | null>>({ 1: null, 2: null, 3: null });
  const [answers, setAnswers] = useState<Record<VideoNumber, Record<string, string>>>({ 1: {}, 2: {}, 3: {} });
  const [rebaResults, setRebaResults] = useState<Record<VideoNumber, RebaResult | null>>({1:null,2:null,3:null});
  const [demoMode, setDemoMode] = useState(false);
  const [resultVideo, setResultVideo] = useState<VideoNumber>(1);

  function setFile(number: VideoNumber, file: File) {
    setFiles((current) => ({ ...current, [number]: file }));
    setSelectedTimes((current) => ({ ...current, [number]: null }));
    setAnswers((current) => ({ ...current, [number]: {} }));
    setRebaResults((current)=>({...current,[number]:null}));
  }
  function replaceFiles(selected: readonly File[]) {
    if(selected.length>3)throw new RangeError("영상은 최대 3편입니다.");
    setFiles({1:selected[0]??null,2:selected[1]??null,3:selected[2]??null});
    setSelectedTimes({1:null,2:null,3:null});setAnswers({1:{},2:{},3:{}});setRebaResults({1:null,2:null,3:null});
  }
  const publishResult=useCallback((number:VideoNumber,result:RebaResult|null)=>{
    setRebaResults(current=>current[number]===result?current:{...current,[number]:result});
    setSelectedTimes(current=>current[number]===(result?.scene.timeSec??null)?current:{...current,[number]:result?.scene.timeSec??null});
  },[]);

  function setSelectedTime(number: VideoNumber, time: number) {
    setSelectedTimes((current) => ({ ...current, [number]: time }));
    if (selectedTimes[number] !== time) {setAnswers((current) => ({ ...current, [number]: {} }));setRebaResults(current=>({...current,[number]:null}));}
  }

  function setAnswer(number: VideoNumber, key: string, value: string) {
    setAnswers((current) => ({ ...current, [number]: { ...current[number], [key]: value } }));
  }

  function startDemo() {
    setDemoMode(true);
    setResultVideo(1);
  }

  function startNewEvaluation() {
    setDemoMode(false);
    setFiles({ 1: null, 2: null, 3: null });
    setSelectedTimes({ 1: null, 2: null, 3: null });
    setAnswers({ 1: {}, 2: {}, 3: {} });
    setRebaResults({1:null,2:null,3:null});
    setResultVideo(1);
  }

  return <VideoFilesContext.Provider value={{ files, selectedTimes, answers, rebaResults, demoMode, resultVideo, setFile, replaceFiles, publishResult, setSelectedTime, setAnswer, startDemo, startNewEvaluation, setResultVideo }}>{children}</VideoFilesContext.Provider>;
}

export function useVideoFiles(): VideoFilesContextValue {
  const value = useContext(VideoFilesContext);
  if (!value) throw new Error("VideoFilesProvider is required");
  return value;
}
