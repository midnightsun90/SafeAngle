"use client";

import { createContext, useContext, useState, type ReactNode } from "react";

export type VideoNumber = 1 | 2 | 3;

type VideoFilesContextValue = {
  files: Record<VideoNumber, File | null>;
  setFile: (number: VideoNumber, file: File) => void;
};

const VideoFilesContext = createContext<VideoFilesContextValue | null>(null);

export function VideoFilesProvider({ children }: { children: ReactNode }) {
  const [files, setFiles] = useState<Record<VideoNumber, File | null>>({ 1: null, 2: null, 3: null });

  function setFile(number: VideoNumber, file: File) {
    setFiles((current) => ({ ...current, [number]: file }));
  }

  return <VideoFilesContext.Provider value={{ files, setFile }}>{children}</VideoFilesContext.Provider>;
}

export function useVideoFiles(): VideoFilesContextValue {
  const value = useContext(VideoFilesContext);
  if (!value) throw new Error("VideoFilesProvider is required");
  return value;
}
