import type { Metadata } from "next";
import "./globals.css";
import "./safeangle.css";

export const metadata: Metadata = {
  title: "SafeAngle | 새 작업 평가",
  description: "작업 자세 평가를 위한 회사 및 작업 정보 입력",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="ko">
      <body>{children}</body>
    </html>
  );
}
