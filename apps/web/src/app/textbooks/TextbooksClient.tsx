"use client";

import { useState } from "react";
import { Modal } from "@/components/Modal";
import { InnerHeader } from "@/components/InnerHeader";
import { AppShell } from "@/components/layout/AppShell";
import { BookOpen } from "@/components/icons";

export function TextbooksClient() {
  const [destination, setDestination] = useState<{ name: string; url: string } | null>(null);
  return (
    <AppShell centerMaxWidth={960}>
      <main className="min-h-screen bg-bg-soft lg:bg-transparent">
        <InnerHeader backHref="/" title="教材中心" subtitle="中小学走国家平台，大学教材保留 GitHub" flatOnDesktop />
        <div className="mx-auto max-w-3xl space-y-4 px-4 py-4 lg:px-0">
          <section className="rounded-3xl border-2 border-bg-softer bg-white p-5 sm:p-6">
            <div className="mb-3 flex items-center gap-3">
              <BookOpen className="h-7 w-7 shrink-0 text-primary" />
              <h1 className="text-lg font-extrabold text-ink">中小学教材 · 国家智慧教育平台</h1>
            </div>
            <p className="text-sm leading-relaxed text-ink-light">推荐前往国家平台，按学段、年级、学科和教材版本查找课本，并使用官方页面提供的下载功能。</p>
            <ol className="my-4 list-decimal space-y-2 pl-5 text-sm leading-relaxed text-ink-light">
              <li>打开官方教材页面，选择你正在使用的教材版本。</li>
              <li>如果官方页面要求登录，请在官方平台完成登录；本应用不收集该账号。</li>
              <li>能否下载以官方页面为准。保存为 PDF 后，可用手机的 PDF 阅读器打开。</li>
            </ol>
            <button type="button" onClick={() => setDestination({ name: "国家中小学智慧教育平台", url: "https://basic.smartedu.cn/tchMaterial" })} className="inline-flex min-h-11 items-center justify-center rounded-2xl bg-primary px-5 py-3 text-sm font-extrabold text-white">前往国家平台查找教材 ↗</button>
          </section>
          <section className="rounded-3xl border-2 border-bg-softer bg-white p-5">
            <h2 className="font-extrabold text-ink">大学教材 · GitHub</h2>
            <p className="mt-2 text-sm leading-relaxed text-ink-light">大学教材继续使用 ChinaTextbook，点击进入大学教材目录。GitHub 的访问速度受网络影响。</p>
            <button type="button" onClick={() => setDestination({ name: "GitHub 大学教材", url: "https://github.com/TapXWorld/ChinaTextbook/tree/master/%E5%A4%A7%E5%AD%A6" })} className="mt-3 inline-flex min-h-11 items-center font-extrabold text-secondary">打开 GitHub 大学教材 ↗</button>
          </section>
          <button type="button" onClick={() => setDestination({ name: "GitHub 备用教材库", url: "https://github.com/TapXWorld/ChinaTextbook" })} className="inline-flex min-h-11 items-center px-1 text-sm font-bold text-secondary">中小学教材的 GitHub 备用入口 ↗</button>
          <p className="px-1 text-xs leading-relaxed text-ink-light">外部教材需要联网访问，离线阅读前请先按平台允许的方式下载保存。本应用内置的课程、练习和学习进度不依赖这些网站或在线 AI。</p>
        </div>
      </main>
      <Modal open={destination !== null} onClose={() => setDestination(null)} ariaLabel="即将打开外部教材平台">
        <div className="w-full max-w-md rounded-3xl bg-white p-6 text-ink">
          <h2 className="text-lg font-extrabold">即将打开外部教材平台</h2>
          <p className="mt-3 text-sm leading-relaxed text-ink-light">将离开本应用，前往{destination?.name}。访问需要联网，平台可能要求登录；请在目标平台按提示操作。</p>
          <p className="mt-2 break-all text-xs text-ink-light">{destination ? new URL(destination.url).hostname : ""}</p>
          <div className="mt-5 flex justify-end gap-3">
            <button type="button" onClick={() => setDestination(null)} className="rounded-xl border-2 border-bg-softer px-4 py-2 font-bold">取消</button>
            {destination && <a href={destination.url} target="_blank" rel="noopener noreferrer" onClick={() => setDestination(null)} className="rounded-xl bg-primary px-4 py-2 font-bold text-white">继续前往</a>}
          </div>
        </div>
      </Modal>
    </AppShell>
  );
}
