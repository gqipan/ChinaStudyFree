/** Optional family AI connection. Only the origin is persisted; credentials live in memory. */
interface OriginStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}
const ORIGIN_KEY = 'csf-family-ai-origin';
const PATHS = new Set(['/api/health', '/api/ai/quiz', '/api/ai/tts']);

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
  let version = 0;
  const pending = new Set<AbortController>();
  try {
    const saved = options.storage?.getItem(ORIGIN_KEY);
    if (saved) origin = validateFamilyOrigin(saved);
  } catch { /* Invalid or unavailable storage must not block local learning. */ }

  function resetSession() {
    authorization = '';
    version++;
    for (const controller of pending) controller.abort();
    pending.clear();
  }

  return {
    getOrigin: () => origin,
    isConnected: () => !!authorization,
    revision: () => version,
    configure(value: string, username: string, password: string) {
      const nextOrigin = validateFamilyOrigin(value);
      if (!username.trim() || username.includes(':') || /[\r\n\x00]/u.test(username + password) || !password || username.length > 200 || password.length > 500) {
        throw new Error('请输入有效的家庭账号和密码');
      }
      const encoded = btoa(Array.from(new TextEncoder().encode(`${username.trim()}:${password}`), byte => String.fromCharCode(byte)).join(''));
      resetSession();
      origin = nextOrigin;
      authorization = `Basic ${encoded}`;
      try { options.storage?.setItem(ORIGIN_KEY, origin); } catch { /* Session remains usable. */ }
    },
    clear() {
      resetSession();
      origin = '';
      try { options.storage?.removeItem(ORIGIN_KEY); } catch { /* No credentials were persisted. */ }
    },
    async request(path: string, init: RequestInit = {}): Promise<Response> {
      if (!PATHS.has(path)) throw new Error('不支持的 AI 请求');
      if (!origin || !authorization) throw new Error('请先连接家庭 AI 服务，本地课程仍可使用');
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
        if (error instanceof Error && error.message === '家庭账号验证失败，请重新连接') throw error;
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
