import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Speck — 함께 보는 목업, 한곳에 모이는 피드백",
  description: "HTML 목업을 프로젝트별로 정리하고, 탭별 화면과 핀 코멘트로 함께 리뷰하세요.",
  other: {
    "codex-preview": "development",
  },
  icons: {
    icon: "/favicon.svg",
    shortcut: "/favicon.svg",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ko">
      <body className="antialiased">{children}</body>
    </html>
  );
}
