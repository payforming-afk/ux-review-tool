import type { Metadata } from "next";
import Link from "next/link";
import type { ReactNode } from "react";
import "./globals.css";

export const metadata: Metadata = {
  title: "UX 视觉走查工具",
  description: "用于设计稿与前端实现截图的可视化比对与问题标注。"
};

export default function RootLayout({
  children
}: Readonly<{
  children: ReactNode;
}>) {
  return (
    <html lang="zh-CN">
      <body>
        <div className="bg-orb bg-orb-left" />
        <div className="bg-orb bg-orb-right" />

        <div className="app-shell">
          <header className="topbar">
            <div>
              <p className="eyebrow">内部工具</p>
              <h1 className="logo-title">UX 视觉走查</h1>
            </div>

            <nav className="topbar-nav" aria-label="主导航">
              <Link href="/tasks" className="button-link">
                任务列表
              </Link>
              <Link href="/tasks/create" className="button-link button-link-primary">
                新建任务
              </Link>
            </nav>
          </header>

          <main className="page-content">{children}</main>
        </div>
      </body>
    </html>
  );
}
