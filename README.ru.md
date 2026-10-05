# 📦 @goodandready/dsh-plugin-notify

<div align="center">

<h3>Web Push, IM-вебхуки, звуковые сигналы, тосты и системные уведомления о завершении хода, ошибке и ожидании approval</h3>

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
      ⭐ <strong>Если вам нравится этот плагин, поставьте ему Star на GitHub</strong> — это покажет мне, что плагин полезен, и добавит мотивации продолжать его развитие.
      <br><br>
      🐛 <strong>Если вы нашли баг или хотите предложить новую функцию</strong>, создайте Issue на GitHub на любом языке — я рассмотрю предложение и реализую полезные улучшения в одной из следующих версий плагина.
    </td>
  </tr>
</table>

</div>

---

## Обзор / Проблема

DeepSeek Harness уже знает, когда ход завершился, упал или ждёт approval. Без этого плагина события остаются внутри сессии. Если вы ведёте несколько параллельных сессий или переключились в другое приложение, приходится постоянно заглядывать и проверять статус вручную.

Плагин закрывает этот разрыв пятью уровнями уведомлений:
1. **Звуковые сигналы (Web Audio)**: Приятные пентатонические переливы колокольчиков прямо в браузере или приложении DSH без внешних аудиофайлов.
2. **Экранные тосты (In-App Toasts)**: Всплывающие карточки поверх сессий с интерактивной кнопкой **«Перейти в сессию»** для мгновенного перехода к нужной задаче.
3. **Системные уведомления (OS / Desktop Push)**: Нативные уведомления Windows, macOS, Linux и DSH Desktop через HTML5 `Notification API` с фокусировкой окна и переходом в сессию.
4. **Удалённые вебхуки (Remote IM)**: Отправка JSON-событий в Feishu, WeCom, DingTalk, Slack, Discord или custom HTTP-эндпоинт. Секретные URL вебхуков надёжно хранятся в DSH Credentials.
5. **Web Push (PWA)**: Настоящий фоновый push через W3C Push API и service worker — телефон или десктоп получает уведомление, **даже если все вкладки dsh закрыты** (остальные браузерные каналы требуют открытой вкладки). Тап по уведомлению открывает dsh прямо на нужной сессии. Требуется HTTPS (или localhost); на iOS сначала добавьте dsh на главный экран (iOS 16.4+).

Русский интерфейс карточки настроек даёт отдельный языковой пакет `dsh-russian-lang`. Этот плагин регистрирует словари `en` и `zh`.

## Архитектура

```mermaid
graph TD
  A[DSH session/event] --> B[plugin-notify host]
  B -->|credential name| C[Credentials service]
  C -->|webhook URL| B
  B -->|POST JSON| D[Feishu / WeCom / DingTalk / Slack / Discord / custom]
  B -.->|macOS only| E[osascript notification]
  B -->|SSE stream: /dsh-plugin-notify/events| F[Client Listener lib/client.js]
  F -->|Web Audio API| G[Звуковые сигналы]
  F -->|DOM overlay| H[Экранные тосты]
  F -->|Notification API| I[Десктопные уведомления OS]
  B -->|web-push + VAPID| K[Push-сервис]
  K -->|фоновый push| L[Service Worker /dsh-plugin-notify/sw.js]
  L -->|тап: переход в сессию| F
  J[Карточка настроек] -->|параметры| B
```

## Возможности

### Хост (`lib/index.js`)

- Подписка на `session/event`.
- `turn/end` с `reason.kind === 'completed'` → `task_done`.
- любой другой `turn/end` → `error`.
- `approval/asked` → `approval_requested`.
- Трансляция событий в реальном времени через SSE (`GET /dsh-plugin-notify/events`) через сервис Cordis `webServer`.
- Разрешение `webhooks.*`: устаревший сырой `http(s)://` (предупреждение) → Credentials `resolve` → `process.env[name]`.
- POST с `AbortSignal.timeout(timeoutMs)` (по умолчанию 5000 мс). Ошибка POST только логируется, без ретрая и без блокировки цикла агента.
- Опциональное окно DND (`HH:MM`, в том числе через полночь). События наблюдаются; вебхуки, звуки и локальные попапы пропускаются.
- `excludeSessionPrefixes` пропускает сессии, чей id начинается с заданного префикса.
- **Web Push на хосте**: `webPush.enabled` включает канал Push API. При включённом `webPush.onlyWhenAway` (по умолчанию) доставка пропускается, пока подключён браузерный клиент по SSE.
  - Маршруты: `GET /dsh-plugin-notify/push/key` (публичный VAPID-ключ), `POST /dsh-plugin-notify/push/subscribe`, `POST /dsh-plugin-notify/push/unsubscribe`, `POST /dsh-plugin-notify/push/test`, `GET /dsh-plugin-notify/sw.js` (service worker с заголовком `Service-Worker-Allowed: /`). Четыре push-маршрута используют тот же контур доверия, что и SSE-поток.
  - VAPID-ключи генерируются при первом включении и сохраняются в файл состояния; переменные `DSH_NOTIFY_VAPID_PUBLIC_KEY` + `DSH_NOTIFY_VAPID_PRIVATE_KEY` позволяют управлять ими вручную. Подписки хранятся в том же файле (по умолчанию `$DSH_HOME/plugin-notify-state.json`, переопределяется `webPush.stateFile`).
  - Мёртвые подписки (push-сервис отвечает 404/410) удаляются автоматически. Медленный или сломанный push-сервис никогда не блокирует цикл агента.

### Клиент (`lib/client.js`)

- Нативная карточка настроек на `settings.plugin.item`.
- Синтезатор звуковых сигналов Web Audio API для `task_done`, `error` и `approval_requested` с кнопкой «Проверить звук».
- Ненавязчивый менеджер тостов с кнопкой перехода в сессию и кнопкой «Проверить тост».
- Поддержка нативных десктопных пушей HTML5 с запросом разрешений.
- Подписчик SSE с авто-реконнектом и опциональным фильтром `notifyBackgroundOnly`.
- Статусы снимка `loading` / `unavailable` / `ready`.
- Save записывает все поля и перечисляет ошибки по имени.
- Стили помечаются `data-dsh-plugin="dsh-plugin-notify"`.

## Установка

Пакет приватный (GitHub Packages). После доступа к registry:

```sh
dsh plugin --profile web add @goodandready/dsh-plugin-notify
```

Перезапустите web-профиль, чтобы загрузилась клиентская половина. Затем **Настройки → Плагины → Notify**.

## Конфигурация

Положите каждый webhook URL в **Настройки → Credentials**. В карточке плагина указывайте только имя учётной записи.

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

| Параметр | Тип | По умолчанию | Описание |
|---|---|---|---|
| `enableSound` | boolean | `false` | Звуковые сигналы Web Audio при завершении задачи, ошибке или запросе approval (выключено по умолчанию, opt-in). |
| `enableToasts` | boolean | `false` | Экранные всплывающие тосты поверх всех сессий с кнопкой перехода (opt-in). |
| `enableDesktopNotifications` | boolean | `false` | Системные десктопные уведомления ОС через Notification API (opt-in). |
| `notifyBackgroundOnly` | boolean | `false` | Уведомлять только если событие произошло в неактивной фоновой сессии. |
| `webhooks.*` | string | пусто | **Имя** credential, значение которого — URL вебхука. Пусто отключает канал. |
| `events` | string[] | `task_done`, `error`, `approval_requested` | Белый список событий. Пусто возвращает три значения по умолчанию. |
| `local` | boolean | `true` | macOS `osascript`; на других ОС игнорируется. |
| `timeoutMs` | number | `5000` | Таймаут одного запроса. |
| `dnd.start` / `dnd.end` | string | пусто | Окно `HH:MM`. Равные или невалидные значения отключают DND. |
| `includeSession` | boolean | `true` | Добавить строку `Session: …`. |
| `includeDuration` | boolean | `true` | Добавить `Duration: …`, если известно время старта хода. |
| `excludeSessionPrefixes` | string[] | `[]` | Не слать уведомления, если `session.id` начинается с префикса. |
| `webPush.enabled` | boolean | `false` | Канал Web Push (PWA): фоновая доставка при закрытых вкладках dsh (opt-in). |
| `webPush.onlyWhenAway` | boolean | `true` | Пропускать web push, пока подключён браузерный клиент. |
| `webPush.subject` | string | `mailto:notify@localhost` | VAPID-контакт (mailto:/https:), передаваемый push-сервисам. |
| `webPush.stateFile` | string | пусто | Файл состояния для VAPID-ключей и подписок (по умолчанию `$DSH_HOME/plugin-notify-state.json`). |

Сырой `http(s)://` в `webhooks.*` всё ещё отправляется с предупреждением. Перенесите URL в Credentials.

## Формат сообщения

| Канал | JSON |
|---|---|
| Feishu | `{ msg_type: 'text', content: { text } }` |
| WeCom | `{ msgtype: 'text', text: { content: text } }` |
| DingTalk | `{ msgtype: 'text', text: { content: text } }` |
| Slack | `{ text }` |
| Discord | `{ content: text }` |
| custom | `{ text, kind, title, sessionId, durationMs, time }` |

## Тесты

```sh
npm install --no-audit --no-fund --no-package-lock
npm test
```

`pretest` делает `node --check` для `lib/index.js` и `lib/client.js`. Затем `node --test test/*.test.mjs`.

Набор подменяет `fetch` или поднимает локальный HTTP-приёмник и не ходит в реальный IM. Живая доставка требует вашего вебхука.

Ожидаемый вывод:

```text
✔ generateVapidKeys returns base64url P-256 keys
✔ resolveStatePath: explicit stateFile wins, then DSH_HOME, then ~/.dsh
✔ loadState tolerates missing and corrupted files
✔ saveState round-trips and leaves no temp files behind
✔ getVapidKeys generates once, persists, then reuses
✔ getVapidKeys env override wins over the state file
✔ addSubscription validates and dedupes by endpoint
✔ removeSubscription removes and reports
✔ concurrent saveState calls serialize into a valid file
✔ sw.js is served unauthenticated with scope and cache headers
✔ sw.js rejects non-GET with 405
✔ push routes refuse non-loopback peers when no connection service exists
✔ push routes honor connection.requestRejection like the SSE stream
✔ push/key: 404 while disabled, key material while enabled
✔ push/subscribe: persists valid subscriptions, rejects invalid bodies
✔ push/unsubscribe: removes by endpoint
✔ push/test: sends to stored subscriptions via the injected library
✔ push routes answer 405 on wrong methods
✔ web push delivers approval requests to stored subscriptions
✔ turn completion produces a task_done push honoring text options
✔ onlyWhenAway skips push while a browser client is connected
✔ onlyWhenAway=false pushes even with clients connected
✔ disabled web push never sends
✔ DND window suppresses push like every other channel
✔ event filter and session-prefix exclusions apply to push
✔ dead subscriptions (404/410) are pruned, live failures are not
✔ no subscriptions means no sends and no errors
ℹ tests 27
ℹ pass 27
ℹ fail 0
```

## Лицензия

MIT © [GooDAnDReaDY](https://github.com/GooDAnDReaDY)

## История изменений

Подробный список изменений доступен в [CHANGELOG.md](CHANGELOG.md).

