import type { Metadata } from "next";
import localFont from "next/font/local";
import "./globals.css";
import "./safeangle.css";
import "./dashboard.css";
import { VideoFilesProvider } from "@/components/VideoFilesProvider";
import DashboardShell from "@/components/DashboardShell";
import PreviewStart from "@/components/PreviewStart";
import { PoseAnalysisProvider } from "@/components/PoseAnalysisProvider";

const pretendard = localFont({ src: "./fonts/PretendardVariable.woff2", variable: "--font-pretendard", weight: "100 900", display: "swap" });

export const metadata: Metadata = {
  title: "SafeAngle | 작업 자세 평가",
  description: "평가 대상자별 작업 자세 평가 대시보드",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="ko" className={pretendard.variable}>
      <body><VideoFilesProvider><PoseAnalysisProvider><PreviewStart /><DashboardShell>{children}</DashboardShell></PoseAnalysisProvider></VideoFilesProvider></body>
    </html>
  );
}
