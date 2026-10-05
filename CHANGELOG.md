# Changelog

All notable changes to this project will be documented in this file.
The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.4.0] - 2026-10-05

### Added
- **Web Push (PWA) notification channel (#52, GitHub PR #2)**: Background push notifications via W3C Push API and Service Worker (`/dsh-plugin-notify/sw.js`), delivering alerts even when all DSH tabs are closed.
  - VAPID key generation and persistent storage (`$DSH_HOME/plugin-notify-state.json`) with env overrides (`DSH_NOTIFY_VAPID_PUBLIC_KEY`, `DSH_NOTIFY_VAPID_PRIVATE_KEY`).
  - Secure push routes: `/dsh-plugin-notify/push/key`, `/subscribe`, `/unsubscribe`, `/test` protected by DSH connection auth.
  - Smart away filtering: `webPush.onlyWhenAway` skips push while an active browser SSE client is connected.
  - Service worker notification click deep linking: navigates to or opens triggering session (`?dshNotifySession=<id>`).
  - Interactive Web UI card controls: subscription status, "Enable push on this device", "Disable push on this device", and "Test push".
  - Comprehensive 27-test suite for web-push dispatch, routes, and state persistence (total 48 tests).

## [0.3.8] - 2026-09-29

### Fixed
- **Settings schema unwrapping**: safely unwrap volatile schema fields across DSH 0.1.7-rc.2 and 0.2.0.

## [0.3.7] - 2026-09-29

### Fixed
- **Peer gate on DSH 0.2.0-rc.1** (#58): DSH skips a profile bundle whose `peerDependencies` exclude the running version, so this plugin was absent from the profile with no error in the UI. Every `@deepseek-ai/dsh-*` peer now names both the 0.1.7-rc.2 and 0.2.0-rc.1 lines, because semver does not admit a prerelease of the next minor into a range that does not name it.

## [0.3.6] - 2026-09-25

### Fixed
- **SSE Authentication Security Boundary (#21)**: Replaced client-controlled header checks (`Authorization.length > 5`, `sec-fetch-site`) with authentic DSH session verification via `connection.requestRejection(req)` (`Host`/`Origin` fence and browser session validation), with loopback-only fallback when connection service is absent.
- **SSE Clients & Turn Starts Lifecycle Leak (#40)**: Bound SSE clients, route registration, heartbeat timer, and `turnStarts` map to unified effect-owned lifecycle. On plugin dispose, active SSE connections are cleanly terminated with closing comment and ended, route is unregistered, and `turnStarts` map is cleared to ensure complete isolation on reload.

## [0.3.5] - 2026-09-24

### Fixed
- **Memory Leak in Turn Tracking (#32)**: Added TTL-based cleanup (30m max age) for stale `turnStarts` entries with automatic pruning on turn events.
- **SSE Connection Drops on Reverse Proxies (#33)**: Added periodic 25s keepalive ping comments (`: ping\n\n`) on `/dsh-plugin-notify/events` with unreferenced timer and automatic dead socket removal.
- **Reverse Iteration in Session Summarization (#34)**: Optimized `summarizeTurn` from O(N) forward iteration to reverse iteration with early break once the turn assistant message is found.
- **String Content Handling in textOf (#35)**: Fixed `textOf(content)` to properly return string content when passed a primitive string or strings within content arrays.

### Documented
- **Architectural Exception for Client Bundle (#36)**: Formally documented the conscious >600-line monolithic bundle exception for `lib/client.js` in `docs/design/DESIGN.md` in accordance with DSH `ModuleLoader` architecture.

## [0.3.3] - 2026-09-24

### Fixed
- The settings card no longer waits for the removed `settingsScope` service. It uses `configForms` on current DeepSeek Harness (#37).

## [0.3.2] - 2026-09-19

### Fixed
- **Settings reachable again on the plugin's own page**: the current core
  (0.1.6-alpha.2) renders a plugin's configuration page only for entries registered
  in the plugin-list seat `plugins.item` — that is how `dsh-agentrouter` and
  `dsh-agent-orchestrator` show their settings, while the row seat and the legacy card
  alone leave the page without the form. The view-aware card is now registered there
  too (`id: 'plugin-notify'` — the row id from `cordis.patch.yml` — order 40, static
  label); both older seats stay as fallbacks.

## [0.3.1] - 2026-09-19

### Fixed
- **Settings reachable again**: the card registered into `settings.plugin.item`, a
  slot the current DSH core (0.1.6-alpha.2) no longer renders, so the plugin's
  settings were unreachable. The surface now registers into the Plugins page row
  seat `plugins.row.config`, keyed `@goodandready/dsh-plugin-notify#plugin-notify`
  — the row id `cordis.patch.yml` declares is `plugin-notify`, not the directory
  name. The plugin's row gains a configure control whose page is the settings form
  (`view: 'page'`, open and without our card chrome — the host page draws the title,
  icon, crumb and padding) plus a one-line state for `view: 'summary'`. The legacy
  seat stays registered as a fallback for older cores.

## [0.3.0] - 2026-09-18

### Added
- **Web Audio Chimes (`enableSound`)**:
  - Synthesized dual-tone pentatonic chimes using Web Audio API (`AudioContext`) without external audio files or network requests (`lib/client.js`).
  - Distinct pleasant sound signatures for `task_done`, `error`, and `approval_requested`.
  - Added "Test sound" action button in the plugin settings card.
- **Cross-Session In-App Screen Toasts (`enableToasts`)**:
  - Light-weight native toast banner overlay styled with DSH design variables (`--dsw-alias-*`, `data-dsh-plugin="dsh-plugin-notify"`).
  - Shows event title, session ID, and summary across active and background sessions.
  - Interactive "Go to session" navigation button to instantly switch to the target session.
  - Auto-dismisses after 7 seconds or manual close.
  - Added "Test toast" action button in settings.
- **Native OS / Desktop Notifications (`enableDesktopNotifications`)**:
  - Integrates with HTML5 `Notification API` for system tray / desktop push notifications (Windows, macOS, Linux, and DSH Desktop app).
  - Includes permission request button in the settings card with live state indicators (`granted`, `denied`, `default`).
  - Clicking on the native notification focuses the DSH window and switches to the affected session.
- **Server-Sent Events (SSE) Event Stream (`GET /dsh-plugin-notify/events`)**:
  - Live broadcast endpoint mounted on Cordis `webServer` service (`lib/index.js`).
  - Real-time client listener in `lib/client.js` with exponential backoff auto-reconnect.
  - Configurable `notifyBackgroundOnly` filter to suppress notifications if the event occurred in the currently active session.

### Fixed
- **Settings Card Duplication (#16)**:
  - Removed fallback registration to `settings.section` slot in `lib/client.js`, retaining only `settings.plugin.item`.
  - Prevents the notify settings card from rendering twice (in root Settings and inside Plugins).

### Changed
- **Public Package Migration**:
  - Migrated package scope from `@goodandready-private/dsh-plugin-notify` to public `@goodandready/dsh-plugin-notify` on npm and GitHub.
- **Repository Hygiene and Clean Tree (#10)**:
  - Untracked internal agent instructions (`AGENTS.md`, `index.md`, `deploy.sh`, `docs/testing/`, `docs/deployment/`) from public git tracking while preserving them on local disk.
  - Added sanitized GitHub publishing layer (`publish.sh`) and `.gitattributes` export-ignores.
- **CI Test Suite and Leak Verification (#13)**:
  - Added comprehensive GitHub Actions workflow (`.github/workflows/ci.yml`) and updated Gitea CI (`.gitea/workflows/ci.yml`).
  - Added unit test suite for delivery channels, error resilience, timeouts, sound/toast options, and locale deduplication (15/15 pass).
- **Opt-in Notification Channels (#20)**:
  - `enableSound`, `enableToasts`, and `enableDesktopNotifications` now default to `false` (opt-in) to prevent unexpected noise or unprompted browser permission popups.
  - Browser notification permission is requested exclusively via explicit user interaction ("Allow desktop notifications" button in the settings card).
  - Web Audio `AudioContext` is managed lazily with graceful failure handling if blocked by browser autoplay policies.
- **Fail-Closed SSE Origin Guard (#21)**:
  - Added strict request validation (`isTrustedRequest`) on `GET /dsh-plugin-notify/events` checking `sec-fetch-site` (`same-origin`/`same-site`), origin/host match, loopback remote address, or DSH authorization headers.
  - Returns `403 Forbidden` for untrusted cross-origin requests.
  - Removed wildcard `Access-Control-Allow-Origin: *` header.
- **Diagnostics via ctx.logger (#22)**:
  - Replaced all server-side `console.*` calls with `ctx.logger` (`debug` for delivery events, `warn` for resolve/post failures).
  - Diagnostic logs are now properly captured by DSH logging infrastructure instead of leaking to raw process stdout.
- **Schemastery Dependency Architecture (#23)**:
  - Moved `@deepseek-ai/schemastery` from `dependencies` to `peerDependencies` (with `devDependencies` for test runner), ensuring consistency with DSH ecosystem peer dependency contracts.
- **Documentation Hygiene (#17)**:
  - Removed `Changed in vX.Y.Z` sections from `README.md`, `README.ru.md`, and `README.zh.md`, centralizing all version release history into `CHANGELOG.md`.
  - Registered `CHANGELOG.md` in `package.json` distribution files list.

## [0.2.5] - 2026-09-16

### Changed
- Runtime sources live in `lib/` instead of a misleading `dist/` tree; removed unnecessary TypeScript build config.
- The settings card stylesheet is tagged `data-dsh-plugin="dsh-plugin-notify"` so HMR and neighbor-plugin cleanup preserve card styles.
- Product README provided in English, Chinese, and Russian; internal files (`AGENTS.md`, `index.md`) stay in Gitea and are excluded from npm packaging.

### Added
- Automated unit test suite (`test/notify.test.mjs`) covering IM channel payloads, missing credentials, recipient failures, AbortSignal timeout, and locale reload without `ru` dictionary.

## [0.2.4] - 2026-09-08

### Fixed
- Avoid duplicate Russian locale registration to cleanly coexist with the `dsh-russian-lang` language pack.

### Changed
- Pointed repository and issue tracker URLs to `goodandready-private` organization.

## [0.2.3] - 2026-09-06

### Added
- Native DSH settings card registered on `settings.plugin.item`.
- Credential references for webhook URLs: secrets stored in DSH Credentials service, settings card stores only credential names.

### Changed
- Standardized MIT license with GooDAnDReaDY copyright.
- Migrated to private package route `@goodandready-private/dsh-plugin-notify`.

## [0.2.2] - 2026-09-05

### Added
- Initial private package routing and credentials-based webhook dispatch for Feishu, WeCom, DingTalk, Slack, Discord, and generic custom webhooks.
