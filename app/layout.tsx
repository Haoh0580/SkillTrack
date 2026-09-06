import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = { title: 'CODE CAMP｜工科賽電腦軟體設計訓練平台', description: '為高中與高職 C# 選手打造的題庫、模擬練習與能力地圖。' };

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="zh-Hant">
      <body>{children}</body>
    </html>
  );
}
