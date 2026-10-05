# 📦 @goodandready/dsh-plugin-notify

<div align="center">

<h3>网页推送、IM Webhook、提示音、横幅与桌面通知：回合完成、出错、等待审批全场景覆盖</h3>

<p align="center">
  <a href="https://www.npmjs.com/package/@goodandready/dsh-plugin-notify"><img src="https://img.shields.io/npm/v/@goodandready/dsh-plugin-notify.svg?style=for-the-badge&color=6366f1&labelColor=1e1b4b" alt="npm version"></a>
  <a href="LICENSE"><img src="https://img.shields.io/badge/license-MIT-10b981.svg?style=for-the-badge&labelColor=064e3b" alt="license"></a>
  <a href="https://github.com/topics/dsh-plugin"><img src="https://img.shields.io/badge/DSH-Plugin-8b5cf6.svg?style=for-the-badge&labelColor=2e1065" alt="DSH Plugin"></a>
  <a href="https://nodejs.org"><img src="https://img.shields.io/badge/Node-20%2B-f59e0b.svg?style=for-the-badge&labelColor=451a03" alt="Node version"></a>
</p>

<p align="center">
  <a href="https://goodandready.app/"><img src="https://img.shields.io/badge/🌐_DSH_Hub-goodandready.app-ff4500.svg?style=for-the-badge&labelColor=1a1a2e" alt="GoodAndReady Showcase"></a>
</p>

<p align="center">
  <a href="README.md"><b>🇬🇧 English</b></a> •
  <a href="README.zh.md"><b>🇨🇳 中文说明</b></a> •
  <a href="README.ru.md"><b>🇷🇺 Русский</b></a>
</p>

<table align="center">
  <tr>
    <td align="center">
      ⭐ <strong>如果您喜欢这个插件，请在 GitHub 上为它点亮 Star</strong> — 这能让我知道插件对您有用，并鼓励我继续开发和维护它。
      <br><br>
      🐛 <strong>如果您发现 Bug 或希望增加功能</strong>，请使用任意语言在 GitHub 上提交 Issue — 我会评估您的建议，并在后续版本中实现有价值的改进。
    </td>
  </tr>
</table>

</div>

---

### 概述 / 问题

DeepSeek Harness 已经知道回合何时完成、失败或等待审批。没有本插件时，这些事件只留在会话里。如果你同时打开多个并行会话或切换到了其他应用，不得不频繁切回窗口手动查看状态。

本插件通过五个层级全面覆盖通知场景：
1. **音频提示音 (Web Audio)**：使用浏览器内置 Web Audio API 合成双音五声音阶提示音，在任务完成、出错或等待审批时轻柔提示，无需外部音频文件。
2. **跨会话屏幕横幅 (In-App Toasts)**：在界面上方显示浮动通知卡片，带有交互式**“跳转至会话”**按钮，可一键切换到触发事件的目标会话。
3. **桌面 / 系统级通知 (OS Push)**：通过 HTML5 `Notification API` 触发 Windows、macOS、Linux 及 DSH 桌面端系统原生通知，点击自动聚焦窗口并跳转会话。
4. **远程 IM Webhook**：向飞书、企业微信、钉钉、Slack、Discord 或自定义 HTTP 接口投递 JSON 负载。Webhook URL 作为机密安全保存在 DSH 凭据中。
5. **网页推送 (Web Push / PWA)**：基于 W3C Push API 与 Service Worker 的真后台推送——**即使所有 dsh 标签页都已关闭**，手机或桌面仍能收到通知（其余浏览器通道需要标签页保持打开）。点击通知直接跳转到触发事件的会话。需要 HTTPS（或 localhost）；iOS 需先添加到主屏幕（iOS 16.4+）。

## 架构

```mermaid
graph TD
  A[DSH session/event] --> B[plugin-notify host]
  B -->|credential name| C[Credentials service]
  C -->|webhook URL| B
  B -->|POST JSON| D[Feishu / WeCom / DingTalk / Slack / Discord / custom]
  B -.->|macOS only| E[osascript notification]
  B -->|SSE stream: /dsh-plugin-notify/events| F[Client Listener lib/client.js]
  F -->|Web Audio API| G[音频提示音]
  F -->|DOM overlay| H[跨会话屏幕横幅]
  F -->|Notification API| I[系统桌面通知]
  B -->|web-push + VAPID| K[推送服务]
  K -->|后台推送| L[Service Worker /dsh-plugin-notify/sw.js]
  L -->|点击跳转会话| F
  J[设置卡片] -->|参数配置| B
```

## 功能说明

### 宿主（`lib/index.js`）

- 订阅 `session/event`。
- `turn/end` 且 `reason.kind === 'completed'` → `task_done`。
- 其他 `turn/end` 原因 → `error`。
- `approval/asked` → `approval_requested`。
- 通过 Cordis `webServer` 服务向已连接的前端客户端提供实时 SSE 事件流（`GET /dsh-plugin-notify/events`）。
- 解析 `webhooks.*`：遗留 `http(s)://` URL（弃用警告）→ Credentials `resolve` → `process.env[name]`。
- 使用 `AbortSignal.timeout(timeoutMs)`（默认 5000 ms）。POST 失败只记录，不重试，不阻塞 agent 循环。
- 可选免打扰窗口（`HH:MM`，支持跨夜）。事件仍会观察；Webhook、提示音和本机弹窗会跳过。
- `excludeSessionPrefixes` 会跳过 id 匹配前缀的会话。
- **网页推送宿主**：`webPush.enabled` 开启 Push API 通道。默认 `webPush.onlyWhenAway`（仅在无浏览器连接时推送），正在观看时不会被打扰。
  - 路由：`GET /dsh-plugin-notify/push/key`（VAPID 公钥）、`POST /dsh-plugin-notify/push/subscribe`、`POST /dsh-plugin-notify/push/unsubscribe`、`POST /dsh-plugin-notify/push/test`、`GET /dsh-plugin-notify/sw.js`（Service Worker，响应头 `Service-Worker-Allowed: /`）。四个推送路由与 SSE 流使用同一信任围栏。
  - VAPID 密钥首次使用时自动生成并持久化；可通过 `DSH_NOTIFY_VAPID_PUBLIC_KEY` + `DSH_NOTIFY_VAPID_PRIVATE_KEY` 自行管理。订阅保存在同一状态文件（默认 `$DSH_HOME/plugin-notify-state.json`，可用 `webPush.stateFile` 覆盖）。
  - 失效订阅（推送服务返回 404/410）自动清理。推送服务缓慢或故障绝不阻塞 agent 循环。

### 客户端（`lib/client.js`）

- 原生设置卡片：`settings.plugin.item`。
- Web Audio API 双音提示音合成器，支持 `task_done`、`error` 与 `approval_requested`，附带“测试声音”按钮。
- 跨会话浮动 Toast 管理器，支持跳转会话及“测试通知”按钮。
- HTML5 原生桌面通知集成与权限申请。
- 实时 SSE 订阅器，支持指数退避自动重连及可选的 `notifyBackgroundOnly` 过滤。
- 快照状态 `loading` / `unavailable` / `ready`。
- 保存会写入全部字段并列出失败项。
- 语言包只有 `en` 和 `zh`。俄语界面由 `dsh-russian-lang` 在运行时提供。
- 样式标签带 `data-dsh-plugin="dsh-plugin-notify"`。

## 安装

本包为私有包（GitHub Packages）。在具备仓库访问权限后：

```sh
dsh plugin --profile web add @goodandready/dsh-plugin-notify
```

重启 web 配置以便加载客户端。然后打开 **设置 → 插件 → Notify**。

## 配置

把每个 Webhook URL 放到 **设置 → 凭据**。在插件卡片里只填写凭据名称。

```yaml
- id: plugin-notify
  name: '@goodandready/dsh-plugin-notify'
  config:
    enableSound: false
    enableToasts: false
    enableDesktopNotifications: false
    notifyBackgroundOnly: false
    webhooks:
      feishu: NOTIFY_FEISHU_WEBHOOK
      wecom: NOTIFY_WECOM_WEBHOOK
      dingtalk: NOTIFY_DINGTALK_WEBHOOK
      slack: NOTIFY_SLACK_WEBHOOK
      discord: NOTIFY_DISCORD_WEBHOOK
      custom: NOTIFY_CUSTOM_WEBHOOK
    events: [task_done, error, approval_requested]
    local: true
    timeoutMs: 5000
    dnd:
      start: ''
      end: ''
    includeSession: true
    includeDuration: true
    excludeSessionPrefixes: []
    webPush:
      enabled: false
      onlyWhenAway: true
      subject: 'mailto:notify@localhost'
      stateFile: ''
```

| 参数 | 类型 | 默认值 | 说明 |
|---|---|---|---|
| `enableSound` | boolean | `false` | 回合完成、出错或等待审批时播放 Web Audio 合成提示音（默认关闭，需显式开启）。 |
| `enableToasts` | boolean | `false` | 跨会话弹出屏幕横幅通知，附带一键跳转按钮（默认关闭，需显式开启）。 |
| `enableDesktopNotifications` | boolean | `false` | 系统原生桌面推送（Windows、macOS、Linux、DSH 桌面版，需显式开启并授权）。 |
| `notifyBackgroundOnly` | boolean | `false` | 仅当事件发生在非活跃/后台会话时才触发通知。 |
| `webhooks.*` | string | 空 | 值为 Webhook URL 的凭据**名称**。空则关闭该通道。 |
| `events` | string[] | `task_done`, `error`, `approval_requested` | 事件白名单。空则恢复默认三项。 |
| `local` | boolean | `true` | macOS `osascript` 弹窗；其他平台忽略。 |
| `timeoutMs` | number | `5000` | 单次请求中止超时。 |
| `dnd.start` / `dnd.end` | string | 空 | `HH:MM` 窗口。相等或非法则关闭免打扰。 |
| `includeSession` | boolean | `true` | 在正文追加 `Session: …`。 |
| `includeDuration` | boolean | `true` | 在已知回合开始时间时追加 `Duration: …`。 |
| `excludeSessionPrefixes` | string[] | `[]` | 当 `session.id` 以任一前缀开头时跳过通知。 |
| `webPush.enabled` | boolean | `false` | 网页推送 (PWA) 通道：所有 dsh 标签页关闭时也能送达的后台推送（需手动开启）。 |
| `webPush.onlyWhenAway` | boolean | `true` | 有浏览器客户端连接时跳过网页推送。 |
| `webPush.subject` | string | `mailto:notify@localhost` | 向推送服务公示的 VAPID 联系方式（mailto:/https:）。 |
| `webPush.stateFile` | string | 空 | VAPID 密钥与订阅的状态文件（默认 `$DSH_HOME/plugin-notify-state.json`）。 |

`webhooks.*` 中残留的原始 `http(s)://` 仍会发送，但会给出弃用警告。请迁移到凭据。

## 消息格式

| 通道 | JSON 正文 |
|---|---|
| 飞书 | `{ msg_type: 'text', content: { text } }` |
| 企业微信 | `{ msgtype: 'text', text: { content: text } }` |
| 钉钉 | `{ msgtype: 'text', text: { content: text } }` |
| Slack | `{ text }` |
| Discord | `{ content: text }` |
| custom | `{ text, kind, title, sessionId, durationMs, time }` |

## 测试

```sh
npm install --no-audit --no-fund --no-package-lock
npm test
```

`pretest` 会对 `lib/index.js` 和 `lib/client.js` 执行 `node --check`。随后 `node --test test/*.test.mjs`。

套件使用 stub `fetch` 或本地 HTTP 监听器，不会调用真实 IM 服务。真实投递需要你自己的 Webhook。

预期输出：

```text
✔ public package identity matches host, client and patch sites
✔ client locale registration coexists with Russian language pack
✔ client apply does not register ru and can reload after effect dispose
✔ legacy raw webhook URL still posts (compat)
✔ credential ref resolves webhook URL via credentials service
✔ resolveWebhookValue prefers credentials then env
✔ missing credential name does not post
✔ each IM channel posts the expected body shape
✔ recipient HTTP failure does not throw out of the session loop
✔ AbortSignal.timeout is attached to webhook POST
✔ excluded session prefixes suppress notifications
✔ Config schema validates sound, toast, and desktop notification fields with opt-in defaults
✔ SSE route delegates authentication to DSH connection service with loopback fallback (issue #21 fix)
✔ SSE route falls back to loopback-only check when connection service is absent (issue #21 fix)
✔ client does not register settings.section slot (issue #16 fix)
✔ deliveries and warnings are routed through ctx.logger without console calls (issue #22 fix)
✔ cleanupTurnStarts purges stale turnStarts entries older than TTL (issue #32 fix)
✔ sendSseHeartbeat writes ping comment to active clients and purges failed clients (issue #33 fix)
✔ summarizeTurn safely reverse iterates events and handles missing session.events (issue #34 fix)
✔ textOf handles plain strings, arrays of blocks, and strings in arrays (issue #35 fix)
✔ lifecycle: apply -> dispose closes SSE clients, resets turnStarts, and isolates re-apply (issue #40 fix)
✔ web push delivers approval requests to stored subscriptions
✔ turn completion produces a task_done push honoring text options
✔ onlyWhenAway skips push while a browser client is connected
✔ onlyWhenAway=false pushes even with clients connected
✔ disabled web push never sends
✔ DND window suppresses push like every other channel
✔ event filter and session-prefix exclusions apply to push
✔ dead subscriptions (404/410) are pruned, live failures are not
✔ no subscriptions means no sends and no errors
✔ sw.js is served unauthenticated with scope and cache headers
✔ sw.js rejects non-GET with 405
✔ push routes refuse non-loopback peers when no connection service exists
✔ push routes honor connection.requestRejection like the SSE stream
✔ push/key: 404 while disabled, key material while enabled
✔ push/subscribe: persists valid subscriptions, rejects invalid bodies
✔ push/unsubscribe: removes by endpoint
✔ push/test: sends to stored subscriptions via the injected library
✔ push routes answer 405 on wrong methods
✔ generateVapidKeys returns base64url P-256 keys
✔ resolveStatePath: explicit stateFile wins, then DSH_HOME, then ~/.dsh
✔ loadState tolerates missing and corrupted files
✔ saveState round-trips and leaves no temp files behind
✔ getVapidKeys generates once, persists, then reuses
✔ getVapidKeys env override wins over the state file
✔ addSubscription validates and dedupes by endpoint
✔ removeSubscription removes and reports
✔ concurrent saveState calls serialize into a valid file
ℹ tests 48
ℹ pass 48
ℹ fail 0
```

## 许可证

MIT © [GooDAnDReaDY](https://github.com/GooDAnDReaDY)

## 变更历史

完整更新日志详见 [CHANGELOG.md](CHANGELOG.md)。

