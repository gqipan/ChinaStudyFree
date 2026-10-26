"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import { AI_PROVIDERS, getFamilyConnection, IS_FAMILY_APP, type AIProvider } from "@/lib/familyConnection";

/** Optional parent setup. It is never mounted as a gate around lessons. */
export function FamilyAISettings() {
  const [mode, setMode] = useState<"direct" | "family">("direct");
  const [provider, setProvider] = useState<AIProvider>("deepseek");
  const [base, setBase] = useState<string>(AI_PROVIDERS.deepseek.base);
  const [model, setModel] = useState<string>(AI_PROVIDERS.deepseek.model);
  const [apiKey, setApiKey] = useState("");
  const [origin, setOrigin] = useState("");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [status, setStatus] = useState("未连接 AI，可以直接学习本地课程");
  const [busy, setBusy] = useState(false);
  const attempt = useRef(0);
  useEffect(() => {
    if (!IS_FAMILY_APP) return;
    const connection = getFamilyConnection();
    const direct = connection.getDirectAI();
    if (direct) {
      setMode("direct"); setProvider(direct.provider); setBase(direct.base); setModel(direct.model);
      setStatus(`已配置${direct.provider === "custom" ? "自定义模型" : AI_PROVIDERS[direct.provider].name}，Key 保存在本机`);
    } else {
      setOrigin(connection.getOrigin());
      if (connection.getOrigin()) setMode("family");
    }
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
      if (mode === "direct") connection.configureDirect({ provider, base, model, apiKey });
      else connection.configure(origin, username, password);
      setPassword("");
      setUsername("");
      setApiKey("");
      const response = await connection.request("/api/health");
      const health: { ok?: boolean; llm?: boolean; tts?: boolean } = await response.json();
      if (currentAttempt !== attempt.current) return;
      if (!health.ok) throw new Error("AI 服务暂时不可用，本地课程仍可使用");
      setStatus(mode === "direct"
        ? "已连接模型服务。题目从手机直接发出，Key 保存在本机。"
        : health.llm || health.tts
          ? "已连接家庭转发服务，在线功能可按需使用"
          : "家庭服务已连接，在线 AI 暂未配置，本地课程仍可使用");
    } catch (error) {
      if (currentAttempt === attempt.current) {
        // Only locally generated messages are rendered; response bodies never are.
        const message = error instanceof Error && /^(请输入|家庭账号|暂时无法|AI 服务|请先配置|API Key 验证失败)/u.test(error.message)
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
    setOrigin(""); setUsername(""); setPassword(""); setApiKey(""); setBusy(false);
    setStatus("已断开 AI，本地课程仍可使用");
  }

  return (
    <section className="rounded-3xl border-2 border-bg-softer bg-white p-5 lg:col-span-2" aria-labelledby="family-ai-title">
      <details>
        <summary id="family-ai-title" className="cursor-pointer font-extrabold text-ink">家庭 AI 服务（可选）</summary>
        <p className="mt-3 text-sm text-ink-light">由家长设置。不配置也能学习和保存进度。直接连接时，模型 Key 只保存在这台手机；家庭转发时，Key 留在家里的服务器。</p>
        <div className="mt-4 space-y-3">
          <div className="grid grid-cols-2 gap-2">
            <button type="button" onClick={() => setMode("direct")} className={`rounded-xl border-2 px-3 py-2 text-sm font-extrabold ${mode === "direct" ? "border-primary bg-primary text-white" : "border-bg-softer"}`}>手机直接连接</button>
            <button type="button" onClick={() => setMode("family")} className={`rounded-xl border-2 px-3 py-2 text-sm font-extrabold ${mode === "family" ? "border-primary bg-primary text-white" : "border-bg-softer"}`}>家庭网络转发</button>
          </div>
          {mode === "direct" ? <form onSubmit={connect} className="space-y-3" autoComplete="off">
            <label className="block text-sm font-bold text-ink">模型服务
              <select value={provider} disabled={busy} onChange={event => { const next = event.target.value as AIProvider; setProvider(next); if (next !== "custom") { setBase(AI_PROVIDERS[next].base); setModel(AI_PROVIDERS[next].model); } }} className="mt-1 w-full rounded-xl border border-bg-softer px-3 py-2 text-base font-normal">
                <option value="deepseek">1. DeepSeek</option><option value="qwen">2. 阿里云百炼 / 通义千问</option><option value="openai">3. OpenAI 官方</option><option value="custom">4. 其他 OpenAI 兼容接口</option>
              </select>
            </label>
            <label className="block text-sm font-bold text-ink">API Base URL
              <input required value={base} onChange={event => { setProvider("custom"); setBase(event.target.value); }} disabled={busy} spellCheck={false} className="mt-1 w-full rounded-xl border border-bg-softer px-3 py-2 text-base font-normal" />
            </label>
            <label className="block text-sm font-bold text-ink">模型名
              <input required value={model} onChange={event => setModel(event.target.value)} disabled={busy} spellCheck={false} className="mt-1 w-full rounded-xl border border-bg-softer px-3 py-2 text-base font-normal" />
            </label>
            <label className="block text-sm font-bold text-ink">API Key（输入时不显示）
              <input type="password" required value={apiKey} onChange={event => setApiKey(event.target.value)} autoComplete="off" disabled={busy} className="mt-1 w-full rounded-xl border border-bg-softer px-3 py-2 text-base font-normal" />
            </label>
            <p className="text-xs text-ink-light">题目请求直接发给所选服务。Key 保存在本机，不上传到家庭服务器；更换设备或清除数据后需要重新输入。</p>
            <div className="flex flex-wrap gap-3">
              <button disabled={busy} type="submit" className="rounded-xl bg-primary px-4 py-2 font-bold text-white disabled:opacity-50">{busy ? "连接中…" : "连接并测试"}</button>
              <button type="button" onClick={disconnect} className="rounded-xl border border-bg-softer px-4 py-2 font-bold text-ink">断开并清除设置</button>
            </div>
          </form> : <form onSubmit={connect} className="space-y-3" autoComplete="off">
          <label className="block text-sm font-bold text-ink">家庭服务地址
            <input type="url" required value={origin} onChange={event => setOrigin(event.target.value)} placeholder="https://study.example.com" autoCapitalize="none" spellCheck={false} disabled={busy} className="mt-1 w-full rounded-xl border border-bg-softer px-3 py-2 text-base font-normal" />
          </label>
          <label className="block text-sm font-bold text-ink">家庭账号
            <input required value={username} onChange={event => setUsername(event.target.value)} autoCapitalize="none" spellCheck={false} maxLength={200} disabled={busy} className="mt-1 w-full rounded-xl border border-bg-softer px-3 py-2 text-base font-normal" />
          </label>
          <label className="block text-sm font-bold text-ink">家庭密码
            <input type="password" required value={password} onChange={event => setPassword(event.target.value)} autoComplete="off" maxLength={500} disabled={busy} className="mt-1 w-full rounded-xl border border-bg-softer px-3 py-2 text-base font-normal" />
          </label>
          <p className="text-xs text-ink-light">模型 Key 留在家庭服务器。这里只填家庭登录密码，完全退出后需重新输入。</p>
          <div className="flex flex-wrap gap-3">
            <button disabled={busy} type="submit" className="rounded-xl bg-primary px-4 py-2 font-bold text-white disabled:opacity-50">{busy ? "连接中…" : "连接并测试"}</button>
            <button type="button" onClick={disconnect} className="rounded-xl border border-bg-softer px-4 py-2 font-bold text-ink">断开并清除设置</button>
          </div>
          </form>}
        </div>
        <p role="status" aria-live="polite" className="mt-3 text-sm text-ink-light">{status}</p>
      </details>
    </section>
  );
}
