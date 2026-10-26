import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createFamilyConnection } from '../apps/web/src/lib/familyConnection.ts';

function setup(fetcher: typeof fetch = async () => Response.json({ ok: true })) {
  const values = new Map<string, string>();
  const storage = { getItem: (key: string) => values.get(key) ?? null, setItem: (key: string, value: string) => { values.set(key, value); }, removeItem: (key: string) => { values.delete(key); } };
  return { values, storage, client: createFamilyConnection({ storage, fetcher, timeoutMs: 20 }) };
}

test('rejects insecure, credential-bearing and ambiguous origins', () => {
  const { client } = setup();
  for (const origin of ['http://study.example.com', 'https://u:p@study.example.com', 'https://study.example.com/api', 'https://study.example.com?key=secret', 'https://study.example.com#secret', 'https://study.example.com?', 'https://study.example.com#', 'https://study.example.com\\@evil.example']) {
    assert.throws(() => client.configure(origin, 'family', 'test-password'));
  }
  assert.equal(client.getOrigin(), '');
});

test('persists only origin, never credentials; restarting requires login', async () => {
  const { client, storage, values } = setup();
  client.configure('https://study.example.com/', 'family', 'test-password');
  assert.deepEqual([...values.values()], ['https://study.example.com']);
  assert.equal(client.isConnected(), true);
  const restarted = createFamilyConnection({ storage });
  assert.equal(restarted.getOrigin(), 'https://study.example.com');
  assert.equal(restarted.isConnected(), false);
  await assert.rejects(restarted.request('/api/ai/quiz'), /请先连接/);
});

test('credentials go only to selected origin; redirects and cookies are disabled', async () => {
  const calls: Array<{ url: string; init?: RequestInit }> = [];
  const { client } = setup(async (url, init) => { calls.push({ url: String(url), init }); return Response.json({ ok: true }); });
  client.configure('https://study.example.com', 'family', 'test-password');
  await client.request('/api/health');
  assert.equal(calls[0].url, 'https://study.example.com/api/health');
  assert.equal(new Headers(calls[0].init?.headers).get('Authorization'), `Basic ${btoa('family:test-password')}`);
  assert.equal(calls[0].init?.redirect, 'error');
  assert.equal(calls[0].init?.credentials, 'omit');
  for (const path of ['https://evil.example', '//evil.example', '/api/health?x=1', '/api/../private']) {
    await assert.rejects(client.request(path));
  }
  assert.equal(calls.length, 1);
});

test('disconnect clears session and switching uses the new origin', async () => {
  const { client } = setup();
  client.configure('https://study.example.com', 'family', 'test-password');
  await client.request('/api/health');
  const revision = client.revision();
  client.clear();
  assert.ok(client.revision() > revision);
  assert.equal(client.isConnected(), false);
  await assert.rejects(client.request('/api/health'));
  client.configure('https://other.example.com', 'other', 'other-password');
  assert.equal(client.getOrigin(), 'https://other.example.com');
});

test('AI unavailable and no connection never contact any service', async () => {
  let calls = 0;
  const { client } = setup(async () => { calls++; throw Error('not called'); });
  await assert.rejects(client.request('/api/health'), /请先连接/);
  assert.equal(calls, 0);
});

test('401 clears session and never exposes response secrets', async () => {
  const { client } = setup(async () => new Response('secret-server-details', { status: 401 }));
  client.configure('https://study.example.com', 'family', 'test-password');
  await assert.rejects(client.request('/api/health'), { message: '家庭账号验证失败，请重新连接' });
  assert.equal(client.isConnected(), false);
});

test('network errors are sanitized and timed out requests abort', async () => {
  const { client } = setup(async () => { throw Error('secret-server-details'); });
  client.configure('https://study.example.com', 'family', 'test-password');
  await assert.rejects(client.request('/api/health'), { message: '暂时无法连接 AI 服务，本地课程仍可使用' });
  const stalled = setup((_url, init) => new Promise((_resolve, reject) => {
    init?.signal?.addEventListener('abort', () => reject(new DOMException('aborted', 'AbortError')));
  }));
  stalled.client.configure('https://study.example.com', 'family', 'test-password');
  await assert.rejects(stalled.client.request('/api/health'), /连接超时/);
});

test('bad saved config is ignored and malformed credentials rejected', () => {
  const { client, storage } = setup();
  assert.throws(() => client.configure('https://study.example.com', 'a:b', 'test-password'));
  assert.throws(() => client.configure('https://study.example.com', 'family', ''));
  storage.setItem('csf-family-ai-origin', 'http://unsafe.example.com');
  assert.equal(createFamilyConnection({ storage }).getOrigin(), '');
});

test('clearing a connection cancels an in-flight call before it can be used', async () => {
  let signal: AbortSignal | null | undefined;
  const { client } = setup((_url, init) => new Promise((_resolve, reject) => {
    signal = init?.signal;
    signal?.addEventListener('abort', () => reject(new Error('private abort details')));
  }));
  client.configure('https://study.example.com', 'family', 'test-password');
  const pending = client.request('/api/health');
  client.clear();
  assert.equal(signal?.aborted, true);
  await assert.rejects(pending, /暂时无法连接/);
});

test('redirects are rejected even if a non-browser fetcher returns one', async () => {
  const { client } = setup(async () => Response.redirect('https://evil.example'));
  client.configure('https://study.example.com', 'family', 'test-password');
  await assert.rejects(client.request('/api/health'), /暂时无法连接/);
});

test('timeout also covers a stalled response body', async () => {
  const { client } = setup(async (_url, init) => new Response(new ReadableStream({
    start(controller) { init?.signal?.addEventListener('abort', () => controller.error(new Error('aborted'))); },
  })));
  client.configure('https://study.example.com', 'family', 'test-password');
  await assert.rejects(client.request('/api/health'), /连接超时/);
});

test('malformed AI replies fail safely before reaching the quiz UI', async () => {
  for (const questions of [{}, null, [null], [{ question: 'test', options: ['one'], answer: 9 }], [{ question: 42, options: ['one'], answer: 0 }]]) {
    const { client } = setup(async () => Response.json({ ok: true, questions }));
    client.configure('https://study.example.com', 'family', 'test-password');
    await assert.rejects(client.request('/api/ai/quiz'), /本地课程仍可使用/);
  }
  const { client } = setup(async () => Response.json({ ok: true, questions: [{ question: '1+1?', options: ['2', '3'], answer: 0 }] }));
  client.configure('https://study.example.com', 'family', 'test-password');
  assert.equal((await (await client.request('/api/ai/quiz')).json()).questions.length, 1);
});

test('malformed health and unsuccessful replies never expose their contents', async () => {
  for (const data of [{ ok: 'yes' }, { ok: true, llm: {} }, { ok: false, error: 'secret-server-details' }]) {
    const { client } = setup(async () => Response.json(data));
    client.configure('https://study.example.com', 'family', 'test-password');
    await assert.rejects(client.request('/api/health'), { message: '暂时无法连接 AI 服务，本地课程仍可使用' });
  }
});
