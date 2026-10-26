# Family Android Implementation Plan

> **For agentic workers:** Use subagent-driven-development for the independent Android packaging task; implement the coupled client integration in this session. Review task results and the entire change before delivery.

**Goal:** A reproducible family APK with optional authenticated AI and usable offline lessons.

**Architecture:** Package Next static output in Capacitor. A runtime connection client stores only the HTTPS origin, keeps credentials in memory, rejects redirects and applies timeouts. AI failures never gate offline learning.

**Tech Stack:** TypeScript, Next.js, React, Capacitor 6, Node test runner, Android Gradle.

## Global Constraints

No private configuration, passwords, keys, learning records or signing material in source or public artifacts. Independent family application ID; different debug ID; fixed release signing identity and increasing versionCode. Existing local progress and backup remain available. AI is optional at startup and throughout lessons.

### Task 1: Preserve security baseline

- [ ] Review `origin/codex/security-harden-ai-api`; merge its reviewed security commit without publishing anything.
- [ ] Install pinned dependencies with `npm ci --ignore-scripts` and run existing core tests.

### Task 2: Runtime AI connection

Files: `apps/web/src/lib/familyConnection.ts`, `apps/web/src/lib/ai.ts`, `apps/web/src/lib/tts.ts`, `apps/web/src/components/FamilyAISettings.tsx`, `apps/web/src/app/profile/ProfileClient.tsx`, `tests/family-connection.test.ts`.

Interfaces: `createFamilyConnection({storage, fetcher, timeoutMs})` exposes `getOrigin`, `configure`, `clear`, `request`, `revision`. `request(path, init)` supports only known AI/health paths and never follows redirects. `familyConnection` is the browser singleton.

- [ ] Write Node tests for rejected insecure/credential-bearing URLs, session-only credentials, address changes, redirect rejection, 401, timeout, unconfigured offline behavior and secret-free error messages; run `node --import tsx --test tests/family-connection.test.ts` to observe failure.
- [ ] Implement the connection and route quiz, TTS and health through it, preserving existing Web/Tauri behavior outside the family build.
- [ ] Add an optional settings form with explicit save/test/disconnect actions and no password persistence. Clear form secrets after connecting.
- [ ] Check tests, types, core tests and full static export; verify offline pages have no connection gate.

### Task 3: Reproducible Android build

Files: `scripts/build-family-android.mjs`, mobile config, package scripts, `docs/family-android.md`, `.gitignore`.

- [ ] Inspect existing tooling, add deterministic project generation, family ID and separate debug ID, version settings, signing inputs from external files and fail-closed release signing.
- [ ] Ensure family build removes inherited public AI base. Avoid public CI for private artifacts. Generate a local debug APK using available tooling; download missing SDK into ignored local storage if needed.
- [ ] Verify APK package identity, debug signing, cleartext policy and absence of private configuration. Document release signing outside Git, update behavior and side loading.

### Task 4: Review and delivery

- [ ] Review the whole diff for credential forwarding, private data, AI failure isolation and build reproducibility.
- [ ] Run meaningful automated checks once after final changes. Inspect rendered settings if a browser is available.
- [ ] Deliver APK and SHA-256 if compilation succeeds; state separately any unverified real-device and live-server checks. Never claim a debug package is a release package.

## 执行结果（2026-10-26）

安全基线、连接层、家长设置、构建脚本和最终发布 APK 已完成；13 项连接测试、192 项核心测试、15,711 道题结构校验、类型检查及最终发布编译通过。两项独立复核发现已修复。无 AI 后端的浏览器完整课程与刷新后进度保留已验证。实际结果和待验收项见 `docs/family-android-verification.md`。

没有可连接安卓设备；真机及真实在线服务验收尚未完成，未标记通过。没有部署或上传私人配置。最终发布 versionCode 2026102603；发布 APK 与校验文件位于忽略的 release/。私人签名由仓库外本机文件提供，文档不记录其实际位置或内容。
