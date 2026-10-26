"use client";

import { InnerHeader } from "@/components/InnerHeader";
import { AppShell } from "@/components/layout/AppShell";
import { BookOpen } from "@/components/icons";

export function TextbooksClient() {
  return (
    <AppShell centerMaxWidth={960}>
      <main className="min-h-screen bg-bg-soft lg:bg-transparent">
        <InnerHeader backHref="/" title="教材中心" subtitle="优先使用官方教材，按需下载到手机" flatOnDesktop />
        <div className="mx-auto max-w-3xl space-y-4 px-4 py-4 lg:px-0">
          <section className="rounded-3xl border-2 border-bg-softer bg-white p-5 sm:p-6">
            <div className="mb-3 flex items-center gap-3">
              <BookOpen className="h-7 w-7 shrink-0 text-primary" />
              <h1 className="text-lg font-extrabold text-ink">国家中小学智慧教育平台</h1>
            </div>
            <p className="text-sm leading-relaxed text-ink-light">推荐前往国家平台，按学段、年级、学科和教材版本查找课本，并使用官方页面提供的下载功能。</p>
            <ol className="my-4 list-decimal space-y-2 pl-5 text-sm leading-relaxed text-ink-light">
              <li>打开官方教材页面，选择你正在使用的教材版本。</li>
              <li>如果官方页面要求登录，请在官方平台完成登录；本应用不收集该账号。</li>
              <li>能否下载以官方页面为准。保存为 PDF 后，可用手机的 PDF 阅读器打开。</li>
            </ol>
            <a href="https://basic.smartedu.cn/tchMaterial" target="_blank" rel="noopener noreferrer" className="inline-flex min-h-11 items-center justify-center rounded-2xl bg-primary px-5 py-3 text-sm font-extrabold text-white">前往国家平台查找教材 ↗</a>
          </section>
          <section className="rounded-3xl border-2 border-bg-softer bg-white p-5">
            <h2 className="font-extrabold text-ink">GitHub 备用教材库</h2>
            <p className="mt-2 text-sm leading-relaxed text-ink-light">官方平台暂时找不到所需版本时，可以查看 ChinaTextbook。GitHub 的访问速度受网络影响。</p>
            <a href="https://github.com/TapXWorld/ChinaTextbook" target="_blank" rel="noopener noreferrer" className="mt-3 inline-flex min-h-11 items-center font-extrabold text-secondary">打开 GitHub 备用入口 ↗</a>
          </section>
          <p className="px-1 text-xs leading-relaxed text-ink-light">外部教材需要联网访问，离线阅读前请先按平台允许的方式下载保存。本应用内置的课程、练习和学习进度不依赖这些网站或在线 AI。</p>
        </div>
      </main>
    </AppShell>
  );
}
