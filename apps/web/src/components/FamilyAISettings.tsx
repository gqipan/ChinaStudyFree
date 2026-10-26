"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import { getFamilyConnection, IS_FAMILY_APP } from "@/lib/familyConnection";

/** Optional parent setup. It is never mounted as a gate around lessons. */
export function FamilyAISettings() {
  const [origin, setOrigin] = useState("");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [status, setStatus] = useState("未连接 AI，可以直接学习本地课程");
  const [busy, setBusy] = useState(false);
  const attempt = useRef(0);
  useEffect(() => {
    if (IS_FAMILY_APP) setOrigin(getFamilyConnection().getOrigin());
    return () => { attempt.current++; };
  }, []);
  if (!IS_FAMILY_APP) return null;

  async function connect(event: FormEvent) {
    event.preventDefault();
    const currentAttempt = ++attempt.current;
    const connection = getFamilyConnection();
    setBusy(true);
    setStatus("正在验证连接，本地课程仍可使用…");
    try {
      connection.configure(origin, username, password);
      setPassword("");
      setUsername("");
      const response = await connection.request("/api/health");
      const health: { ok?: boolean; llm?: boolean; tts?: boolean } = await response.json();
      if (currentAttempt !== attempt.current) return;
      if (!health.ok) throw new Error("AI 服务暂时不可用，本地课程仍可使用");
      setStatus(health.llm || health.tts
        ? "已连接家庭 AI，在线功能可按需使用"
        : "服务已连接，在线 AI 暂未配置，本地课程仍可使用");
    } catch (error) {
      if (currentAttempt === attempt.current) {
        // Only locally generated messages are rendered; response bodies never are.
        const message = error instanceof Error && /^(请输入|家庭账号|暂时无法|AI 服务|请先连接)/u.test(error.message)
          ? error.message : "AI 暂时不可用，本地课程仍可使用";
        setStatus(message);
      }
    } finally {
      if (currentAttempt === attempt.current) setBusy(false);
      setPassword("");
    }
  }

  function disconnect() {
    attempt.current++;
    getFamilyConnection().clear();
    setOrigin(""); setUsername(""); setPassword(""); setBusy(false);
    setStatus("已断开 AI，本地课程仍可使用");
  }

  return (
    <section className="mx-auto my-4 max-w-2xl rounded-2xl border border-bg-softer bg-white p-4 lg:max-w-4xl" aria-labelledby="family-ai-title">
      <details>
        <summary id="family-ai-title" className="cursor-pointer font-extrabold text-ink">家庭 AI 服务（可选）</summary>
        <p className="mt-3 text-sm text-ink-light">由家长设置。无需连接也能学习和保存进度；在线 AI 仅用于额外出题与朗读。</p>
        <form onSubmit={connect} className="mt-4 space-y-3" autoComplete="off">
          <label className="block text-sm font-bold text-ink">服务地址
            <input type="url" required value={origin} onChange={event => setOrigin(event.target.value)} placeholder="https://study.example.com" autoCapitalize="none" spellCheck={false} disabled={busy} className="mt-1 w-full rounded-xl border border-bg-softer px-3 py-2 text-base font-normal" />
          </label>
          <label className="block text-sm font-bold text-ink">家庭账号
            <input required value={username} onChange={event => setUsername(event.target.value)} autoCapitalize="none" spellCheck={false} maxLength={200} disabled={busy} className="mt-1 w-full rounded-xl border border-bg-softer px-3 py-2 text-base font-normal" />
          </label>
          <label className="block text-sm font-bold text-ink">家庭密码
            <input type="password" required value={password} onChange={event => setPassword(event.target.value)} autoComplete="off" maxLength={500} disabled={busy} className="mt-1 w-full rounded-xl border border-bg-softer px-3 py-2 text-base font-normal" />
          </label>
          <p className="text-xs text-ink-light">密码仅在本次运行中使用，完全退出后需重新输入。这里填写家庭登录密码，无需填写模型 API Key。</p>
          <div className="flex flex-wrap gap-3">
            <button disabled={busy} type="submit" className="rounded-xl bg-primary px-4 py-2 font-bold text-white disabled:opacity-50">{busy ? "连接中…" : "连接并测试"}</button>
            <button type="button" onClick={disconnect} className="rounded-xl border border-bg-softer px-4 py-2 font-bold text-ink">断开并清除设置</button>
          </div>
        </form>
        <p role="status" aria-live="polite" className="mt-3 text-sm text-ink-light">{status}</p>
      </details>
    </section>
  );
}
