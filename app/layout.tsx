import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = { title: '工科賽・電腦軟體設計冠軍訓練平台', description: '題庫分類、模擬練習與能力地圖。' };

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
