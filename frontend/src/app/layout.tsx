import type { Metadata } from "next";
import "./globals.css";
import "./safeangle.css";
import { VideoFilesProvider } from "@/components/VideoFilesProvider";

export const metadata: Metadata = {
  title: "SafeAngle | 새 작업 평가",
  description: "작업 자세 평가를 위한 회사 및 작업 정보 입력",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="ko">
      <body><VideoFilesProvider>{children}</VideoFilesProvider></body>
    </html>
  );
}
