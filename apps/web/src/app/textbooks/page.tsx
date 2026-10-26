import { Suspense } from "react";
import { TextbooksClient } from "./TextbooksClient";

/**
 * 教材中心 —— 官方教材下载指引与 GitHub 备用入口。
 * 客户端组件（静态导出下 useSearchParams 需包在 Suspense 内）。
 */
export default function TextbooksPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-bg" />}>
      <TextbooksClient />
    </Suspense>
  );
}
