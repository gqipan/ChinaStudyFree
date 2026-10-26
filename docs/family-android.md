# 家庭安卓包

此构建把课程和练习打入 APK；家庭 AI 地址由家长安装后在设置输入。安装、选年级、本地练习与进度保存不依赖 AI。教材 PDF 外链及未打包媒体需要网络。仓库和通用安装包不得包含真实地址、账号、密码、模型密钥、签名密钥或学习备份。

## 从干净检出构建

需要 Node.js 20+、JDK 21、Android SDK 平台 34 和 Build Tools 34.0.0。首次构建需要网络下载依赖、Gradle 与 Maven 工件；准备工具和缓存后可本地构建。SDK 放在仓库忽略的 `tools/android-sdk`，或用 `ANDROID_HOME` 指向现有 SDK。

```sh
npm ci --ignore-scripts
export JAVA_HOME=/path/to/jdk-21
export ANDROID_HOME=/path/to/android-sdk
# 先安装 Android Command-line Tools，并阅读/接受 Android SDK 许可：
sdkmanager --licenses
sdkmanager 'platforms;android-34' 'build-tools;34.0.0' 'platform-tools'
node scripts/build-family-android.mjs --test
npm run build:family:android --workspace=china-study-free-mobile -- debug
```

构建脚本强制 `NEXT_PUBLIC_FAMILY_APP=1` 和空 `NEXT_PUBLIC_AI_BASE`，拒绝根目录及 Web 目录的本地生产 `.env` 文件；先把这些私人文件移出仓库。脚本完成课程数据生成与静态构建，每次重新创建忽略的 `apps/mobile/android/`，然后同步并应用家庭原生设置。不要手工维护生成目录；需要的原生改动应写进构建脚本。`tools/`、`release/` 及原生生成目录已在 `.gitignore`。

调试 ID 为 `com.chinastudyfree.family.debug`；家庭发布 ID 为 `com.chinastudyfree.family`，桌面名称分别为“聪聪学堂（调试）”和“聪聪学堂”。两者可共存，学习记录互不共享。调试包使用本机 Android 调试签名，仅供验收。脚本检查签名、包名、versionCode 及禁止明文 HTTP，并把 APK 与 `.sha256` 写入 `release/`。

## 私人签名发布

家庭发布必须使用自己保管的固定密钥。脚本不会下载或使用上游演示密钥；缺少私人签名输入时立即失败。首次创建密钥请使用 JDK 的 `keytool -genkeypair` 交互输入密码，密钥和备份均放在仓库外。不要通过命令行参数提供密码，不要把签名或家庭配置上传公共 CI。

在仓库外创建权限为 `600` 的 JSON 文件，格式如下；下列值只是占位符，不能直接用于发布：

```json
{
  "storeFile": "/absolute/private/location/family.jks",
  "storePassword": "replace-locally",
  "keyAlias": "family",
  "keyPassword": "replace-locally"
}
```

```sh
FAMILY_ANDROID_SIGNING_FILE=/absolute/private/location/signing.json \
FAMILY_VERSION_CODE=1 \
npm run build:family:android --workspace=china-study-free-mobile -- release
```

签名 JSON 与密钥都必须是仓库外的绝对路径；Gradle 直接从外部文件读取，脚本不把密码写入生成工程，也不展示原生构建/签名输出。静态构建不会接收签名配置路径。分享 APK 和校验文件即可，签名材料永远留在本机私人位置。

`FAMILY_VERSION_CODE` 接受 1 到 2100000000 的整数。省略时使用构建时 UTC 分钟数；后续发布必须递增，建议始终明确指定。更新必须使用相同发布应用 ID、同一密钥和更大 versionCode；安装新版可以保留本地进度。先通过应用备份功能导出记录。调试包和发布包之间不能直接覆盖更新，卸载会丢失对应本地记录。

## 安装与验收

将 APK 传到安卓设备，用文件管理器打开并按系统提示允许该来源安装。安装前使用系统 SHA-256 工具对照旁边的校验文件；校验只说明文件一致，分发时还应确认来源可信。

首轮设备验收：首次启动、选择年级、完成本地练习、开启飞行模式后继续练习、返回键、完全重启后的进度、同签名新版覆盖更新。家庭 AI 单独验证未配置、错误密码、断网、超时及真实连接成功；AI 失败时本地练习必须可用。账号密码仅保留在当前运行会话，完全重启后要重新输入；服务地址保存在设备。浏览器测试或编译成功不能代替这些真实设备与真实服务验收。

家庭构建同时关闭 Android 自动云备份，并通过数据提取规则排除系统备份与设备迁移中的应用数据。学习记录需要迁移时，使用应用内的手动备份，并自行保管导出文件。此设置依据 [Android 官方备份规则](https://developer.android.com/identity/data/autobackup)；设备实际行为仍需真机验收。

## 家庭 AI 的服务端接入

登录必须由服务端或反向代理验证；APK 设置页本身不构成安全边界。当前客户端使用 HTTPS Basic 认证，服务地址安装后输入，不打入安装包。客户端只对指定的 health/quiz/tts 路径发送认证，并拒绝重定向。

安卓包内页面来源为 `https://localhost`。网关需要允许这个来源及 `Authorization,Content-Type` 请求头；只放行 OPTIONS 预检，实际 API 请求仍须认证。服务端接口继续限制请求大小、参数与调用频率。不要通过关闭认证、放宽证书验证或允许明文 HTTP 来修复跨域问题。

真实网关尚未在本轮部署或验收。接入后分别验证：无凭据实际 API 返回 401；错误密码拒绝；正确密码成功；OPTIONS 可用；被重定向或服务不可用时应用提示失败，本地课程仍可进入。公开模板及记录只使用示例域名，不记录真实地址、凭据或请求内容。

应用内已有存档导入/导出界面；安卓 WebView 的文件交互和同签名覆盖升级仍需真机验收后才能作为可靠迁移流程使用。

## 安卓目录路由

Next 静态导出每页都有自己的目录 index.html，不能使用单页应用的根首页回退。家庭构建复制 apps/mobile/native/ 的路由适配类，只对同源主文档 GET 请求映射目录索引，并保留 Capacitor 的资源加载与桥接。构建时执行 test:family:native，检查完整导出页面与请求隔离。独立运行此测试前需要先生成 apps/web/out。

若升级修复包，请直接覆盖安装同签名家庭版，保留已有学习进度；不要为了路由问题先卸载或清除应用数据。
