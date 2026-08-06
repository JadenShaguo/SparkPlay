import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "SparkPlay",
  description: "Generate, remix, version and share playable mini games."
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="zh-CN">
      <body>{children}</body>
    </html>
  );
}
