/** Optional AI connection. A direct provider key stays on this device; family mode keeps only its address. */
interface OriginStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}
const ORIGIN_KEY = 'csf-family-ai-origin';
const DIRECT_KEY = 'csf-direct-ai';
const PATHS = new Set(['/api/health', '/api/ai/quiz', '/api/ai/tts']);
export const AI_PROVIDERS = {
  deepseek: { name: 'DeepSeek', base: 'https://api.deepseek.com/v1', model: 'deepseek-chat' },
  qwen: { name: '阿里云百炼 / 通义千问', base: 'https://dashscope.aliyuncs.com/compatible-mode/v1', model: 'qwen-plus' },
  openai: { name: 'OpenAI 官方', base: 'https://api.openai.com/v1', model: 'gpt-4o-mini' },
} as const;
export type AIProvider = keyof typeof AI_PROVIDERS | 'custom';
export interface DirectAIConfig { provider: AIProvider; base: string; model: string; apiKey: string; }

export function normalizeDirectAI(value: { provider?: string; base?: string; model?: string }): Omit<DirectAIConfig, 'apiKey'> {
  const provider = value.provider === 'deepseek' || value.provider === 'qwen' || value.provider === 'openai' || value.provider === 'custom'
    ? value.provider : 'deepseek';
  const preset = provider === 'custom' ? undefined : AI_PROVIDERS[provider];
  const baseInput = (value.base || preset?.base || '').trim();
  if (!/^https:\/\/[^\s/?#\\]+(?:\/[^\s?#\\]+)?$/u.test(baseInput)) throw new Error('请输入完整的 HTTPS 模型接口地址');
  const base = new URL(baseInput);
  if (base.protocol !== 'https:' || base.username || base.password || base.search || base.hash) throw new Error('请输入完整的 HTTPS 模型接口地址');
  const model = (value.model || preset?.model || '').trim();
  if (!/^[A-Za-z0-9._:-]{1,80}$/u.test(model)) throw new Error('请输入有效的模型名');
  return { provider, base: base.href.replace(/\/$/, ''), model };
}

function validReply(path: string, value: unknown): boolean {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const data = value as Record<string, unknown>;
  if (data.ok !== true) return false;
  if (path === '/api/health') {
    return ['llm', 'tts'].every(key => data[key] === undefined || typeof data[key] === 'boolean');
  }
  const text = (value: unknown, limit: number) => typeof value === 'string' && value.length > 0 && value.length <= limit;
  return Array.isArray(data.questions) && data.questions.length > 0 && data.questions.length <= 15 && data.questions.every(value => {
    if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
    const question = value as Record<string, unknown>;
    return text(question.question, 2000) && Array.isArray(question.options) &&
      question.options.length >= 2 && question.options.length <= 8 && question.options.every(option => text(option, 500)) &&
      Number.isInteger(question.answer) && (question.answer as number) >= 0 && (question.answer as number) < question.options.length &&
      ['explanation', 'knowledge_point'].every(key => question[key] === undefined || typeof question[key] === 'string');
  });
}

export function validateFamilyOrigin(value: string): string {
  try {
    // URL normalizes backslashes and dot paths: reject them before parsing.
    if (/[\\\s?#]/u.test(value.trim())) throw new Error();
    const url = new URL(value.trim());
    if (url.protocol !== 'https:' || url.username || url.password || url.search || url.hash || url.pathname !== '/') throw new Error();
    return url.origin;
  } catch {
    throw new Error('请输入完整的 HTTPS 服务地址，不要包含账号、路径或参数');
  }
}

export function createFamilyConnection(options: {
  storage?: OriginStorage;
  fetcher?: typeof fetch;
  timeoutMs?: number;
} = {}) {
  let origin = '';
  let authorization = '';
  let direct: DirectAIConfig | null = null;
  let version = 0;
  const pending = new Set<AbortController>();
  try {
    const saved = options.storage?.getItem(ORIGIN_KEY);
    if (saved) origin = validateFamilyOrigin(saved);
  } catch { /* Invalid or unavailable storage must not block local learning. */ }
  try {
    const saved = options.storage?.getItem(DIRECT_KEY);
    if (saved) {
      const parsed = JSON.parse(saved) as { provider?: string; base?: string; model?: string; apiKey?: string };
      if (typeof parsed.apiKey === 'string' && parsed.apiKey.length <= 500) {
        direct = { ...normalizeDirectAI(parsed), apiKey: parsed.apiKey };
      }
    }
  } catch { /* A damaged saved provider must not block local learning. */ }

  function resetSession() {
    authorization = '';
    version++;
    for (const controller of pending) controller.abort();
    pending.clear();
  }

  return {
    getOrigin: () => origin,
    isConnected: () => !!authorization || !!direct,
    getDirectAI: () => direct ? { provider: direct.provider, base: direct.base, model: direct.model, hasKey: true } : null,
    revision: () => version,
    configureDirect(value: { provider?: string; base?: string; model?: string; apiKey: string }) {
      const apiKey = value.apiKey.trim();
      if (!apiKey || apiKey.length > 500 || /[\r\n\x00]/u.test(apiKey)) throw new Error('请输入有效的 API Key');
      const next = { ...normalizeDirectAI(value), apiKey };
      resetSession();
      origin = '';
      direct = next;
      try {
        options.storage?.removeItem(ORIGIN_KEY);
        options.storage?.setItem(DIRECT_KEY, JSON.stringify(next));
      } catch { /* This session can still use the key. */ }
    },
    configure(value: string, username: string, password: string) {
      const nextOrigin = validateFamilyOrigin(value);
      if (!username.trim() || username.includes(':') || /[\r\n\x00]/u.test(username + password) || !password || username.length > 200 || password.length > 500) {
        throw new Error('请输入有效的家庭账号和密码');
      }
      const encoded = btoa(Array.from(new TextEncoder().encode(`${username.trim()}:${password}`), byte => String.fromCharCode(byte)).join(''));
      resetSession();
      origin = nextOrigin;
      authorization = `Basic ${encoded}`;
      direct = null;
      try {
        options.storage?.removeItem(DIRECT_KEY);
        options.storage?.setItem(ORIGIN_KEY, origin);
      } catch { /* Session remains usable. */ }
    },
    clear() {
      resetSession();
      origin = '';
      direct = null;
      try { options.storage?.removeItem(ORIGIN_KEY); options.storage?.removeItem(DIRECT_KEY); } catch { /* No credentials were persisted. */ }
    },
    async directRequest(path: string, init: RequestInit, requestVersion: number, signal: AbortSignal): Promise<Response> {
      if (!direct || path === '/api/ai/tts') throw new Error('unavailable');
      if (path === '/api/health') return Response.json({ ok: true, llm: true, tts: false, mode: 'direct' });
      const request = JSON.parse(String(init.body ?? '{}')) as Record<string, unknown>;
      const text = (value: unknown, fallback: string, limit: number) => {
        const result = typeof value === 'string' && value.trim() ? value.trim() : fallback;
        if (result.length > limit) throw new Error('unavailable');
        return result;
      };
      const count = Math.min(Math.max(Number.isInteger(request.count) ? Number(request.count) : 5, 1), 15);
      const difficulty = text(request.difficulty, 'medium', 10);
      if (!['easy', 'medium', 'hard'].includes(difficulty)) throw new Error('unavailable');
      const response = await (options.fetcher ?? fetch)(`${direct.base}/chat/completions`, {
        method: 'POST', signal, credentials: 'omit', redirect: 'error', cache: 'no-store', referrerPolicy: 'no-referrer', mode: 'cors',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${direct.apiKey}` },
        body: JSON.stringify({
          model: direct.model, temperature: 0.9, response_format: { type: 'json_object' },
          messages: [
            { role: 'system', content: '你是小学老师，只输出 JSON。字段 questions 数组，每项含 question、options（4项）、answer（0-3）、explanation、knowledge_point。' },
            { role: 'user', content: `为小学${text(request.grade, '三年级', 20)}${text(request.subject, '数学', 40)}生成${count}道关于「${text(request.topic, '本单元知识点', 200)}」的单选题，难度${difficulty}。` },
          ],
        }),
      });
      if (requestVersion !== version) throw new Error('changed');
      if (response.status === 401 || response.status === 403) { direct = null; try { options.storage?.removeItem(DIRECT_KEY); } catch { /* Memory copy is already cleared. */ } throw new Error('API Key 验证失败，请重新配置'); }
      if (!response.ok || response.redirected || response.type === 'opaqueredirect') throw new Error('unavailable');
      const raw = await response.arrayBuffer();
      if (requestVersion !== version || raw.byteLength > 1024 * 1024) throw new Error('unavailable');
      const payload = JSON.parse(new TextDecoder().decode(raw)) as { choices?: Array<{ message?: { content?: string } }> };
      const content = payload.choices?.[0]?.message?.content?.replace(/^```(?:json)?/i, '').replace(/```$/, '').trim();
      const parsed = JSON.parse(content || '') as { questions?: unknown };
      if (!validReply('/api/ai/quiz', { ok: true, questions: parsed.questions })) throw new Error('invalid AI response');
      return Response.json({ ok: true, questions: parsed.questions });
    },
    async request(path: string, init: RequestInit = {}): Promise<Response> {
      if (!PATHS.has(path)) throw new Error('不支持的 AI 请求');
      if (!direct && (!origin || !authorization)) throw new Error('请先配置 AI，本地课程仍可使用');
      const controller = new AbortController();
      const requestVersion = version;
      const timeoutMs = options.timeoutMs ?? 20_000;
      let timedOut = false;
      const timer = setTimeout(() => { timedOut = true; controller.abort(); }, timeoutMs);
      const onAbort = () => controller.abort();
      init.signal?.addEventListener('abort', onAbort, { once: true });
      if (init.signal?.aborted) controller.abort();
      pending.add(controller);
      try {
        if (direct) return await this.directRequest(path, init, requestVersion, controller.signal);
        const headers = new Headers(init.headers);
        headers.set('Authorization', authorization);
        const response = await (options.fetcher ?? fetch)(`${origin}${path}`, {
          ...init, headers, signal: controller.signal,
          credentials: 'omit', redirect: 'error', cache: 'no-store',
          referrerPolicy: 'no-referrer', mode: 'cors',
        });
        if (requestVersion !== version) throw new Error('changed');
        if (response.status === 401 || response.status === 403) {
          resetSession();
          throw new Error('家庭账号验证失败，请重新连接');
        }
        if (!response.ok || response.redirected || response.type === 'opaqueredirect') {
          throw new Error('unavailable');
        }
        // Keep the deadline active until the body is received, not just the headers.
        const body = await response.arrayBuffer();
        if (requestVersion !== version) throw new Error('changed');
        if (body.byteLength > 20 * 1024 * 1024) throw new Error('oversized');
        const contentType = response.headers.get('Content-Type') ?? '';
        if (path === '/api/ai/tts') {
          if (!contentType.startsWith('audio/')) throw new Error('invalid audio');
        } else {
          const data: unknown = JSON.parse(new TextDecoder().decode(body));
          if (!validReply(path, data)) throw new Error('invalid AI response');
        }
        return new Response(body, { status: response.status, headers: { 'Content-Type': contentType } });
      } catch (error) {
        if (error instanceof Error && (error.message === '家庭账号验证失败，请重新连接' || error.message === 'API Key 验证失败，请重新配置')) throw error;
        throw new Error(timedOut ? 'AI 服务连接超时，本地课程仍可使用' : '暂时无法连接 AI 服务，本地课程仍可使用');
      } finally {
        clearTimeout(timer);
        pending.delete(controller);
        init.signal?.removeEventListener('abort', onAbort);
      }
    },
  };
}

// Lazy browser singleton: SSR and unavailable localStorage do not gate startup.
let singleton: ReturnType<typeof createFamilyConnection> | undefined;
export function getFamilyConnection() {
  if (!singleton) {
    let storage: OriginStorage | undefined;
    try { if (typeof window !== 'undefined') storage = window.localStorage; } catch { /* optional */ }
    singleton = createFamilyConnection({ storage });
  }
  return singleton;
}
export const IS_FAMILY_APP = process.env.NEXT_PUBLIC_FAMILY_APP === '1';
