import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "하남 미사 부동산 브리핑 | 센트럴자이 미사금호부동산",
  description: "하남 미사지구 아파트 실거래·시세·추천매물·입지분석 대시보드",
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
