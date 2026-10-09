import type { Metadata } from "next";
import "./globals.css";
import "./safeangle.css";
import "./dashboard.css";
import { VideoFilesProvider } from "@/components/VideoFilesProvider";
import DashboardShell from "@/components/DashboardShell";

export const metadata: Metadata = {
  title: "SafeAngle | 작업 자세 평가",
  description: "평가 대상자별 작업 자세 평가 대시보드",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="ko">
      <body><VideoFilesProvider><DashboardShell>{children}</DashboardShell></VideoFilesProvider></body>
    </html>
  );
}
