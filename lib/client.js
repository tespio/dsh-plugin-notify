window.__ModuleLoader__.load({
  id: '@goodandready/dsh-plugin-notify',
  factory: (require) => {
    var module = { exports: {} }
    const React = require('react')
    const NS = '@goodandready/dsh-plugin-notify'
    // Plugins page row seat (DSH 0.1.6-alpha.2): key = '<package name>#<row id>'.
    // The row id declared by cordis.patch.yml is 'plugin-notify' (not the folder name).
    const PKG = '@goodandready/dsh-plugin-notify'
    const ROW_ID = 'plugin-notify'
    const ROW_CONFIG_KEY = PKG + '#' + ROW_ID
    const CHANNELS = ['feishu', 'wecom', 'dingtalk', 'slack', 'discord', 'custom']

    const en = {
      title: 'Notify',
      subtitle: 'IM webhook, sound, toast, desktop, and web push notifications',
      intro: 'Store each webhook URL under Settings → Credentials, then type only the credential name below. Do not paste URLs into this form.',
      'field.feishu': 'Feishu credential',
      'field.wecom': 'WeCom credential',
      'field.dingtalk': 'DingTalk credential',
      'field.slack': 'Slack credential',
      'field.discord': 'Discord credential',
      'field.custom': 'Custom webhook credential',
      'field.events': 'Events (comma-separated)',
      'field.local': 'Local macOS notification (host)',
      'field.enableSound': 'Audio chimes (Web Audio)',
      'field.enableToasts': 'In-app on-screen toasts',
      'field.enableDesktop': 'Desktop OS notifications (Win/Mac/Linux)',
      'field.notifyBackgroundOnly': 'Notify only for background/other sessions',
      'field.timeoutMs': 'Webhook timeout (ms)',
      'field.dndStart': 'DND start (HH:MM)',
      'field.dndEnd': 'DND end (HH:MM)',
      'field.includeSession': 'Include session id',
      'field.includeDuration': 'Include duration',
      'field.excludePrefixes': 'Exclude session prefixes (comma-separated)',
      'hint.cred': 'Credential name only — value must be the full webhook URL.',
      'hint.events': 'task_done, error, approval_requested',
      'btn.testSound': 'Test sound',
      'btn.testToast': 'Test toast',
      'btn.reqPermission': 'Allow desktop notifications',
      'perm.granted': 'Desktop notifications enabled',
      'perm.denied': 'Notifications denied by browser settings',
      'perm.default': 'Permission not granted yet',
      'toast.taskDone': 'Task completed',
      'toast.error': 'Task failed',
      'toast.approval': 'Approval required',
      'toast.switchToSession': 'Switch to session',
      'settings.loading': 'Loading settings…',
      'settings.unavailable': 'Settings scope unavailable for this plugin.',
      'settings.save': 'Save',
      'settings.saving': 'Saving…',
      'settings.saved': 'Saved',
      'settings.saveFailed': 'Save failed: ',
      'webpush.section': 'Web push (reaches devices with every dsh tab closed)',
      'field.enableWebPush': 'Enable web push channel',
      'field.webPushOnlyWhenAway': 'Only push when no browser is connected',
      'btn.webpushEnable': 'Enable push on this device',
      'btn.testPush': 'Test push',
      'webpush.state.unsupported': 'Web push is not available in this context — open dsh in a browser (HTTPS or localhost) to use it',
      'webpush.state.denied': 'Notification permission denied by browser settings',
      'webpush.state.disabled': 'Web push channel is disabled — enable it above and save first',
      'webpush.state.notSubscribed': 'This device is not subscribed yet',
      'webpush.state.subscribed': 'This device is subscribed — push will reach it',
      'webpush.state.error': 'Push setup failed: ',
    }
    const zh = {
      title: '通知',
      subtitle: 'IM Webhook、音频、浮动弹窗、桌面系统通知与网页推送',
      intro: '请先在设置 → 凭据中保存 Webhook URL，然后只在下方填写凭据名称。不要直接粘贴 URL。',
      'field.feishu': '飞书凭据',
      'field.wecom': '企业微信凭据',
      'field.dingtalk': '钉钉凭据',
      'field.slack': 'Slack 凭据',
      'field.discord': 'Discord 凭据',
      'field.custom': '自定义 Webhook 凭据',
      'field.events': '事件（逗号分隔）',
      'field.local': '本地 macOS 通知（主机）',
      'field.enableSound': '音频提示音（Web Audio）',
      'field.enableToasts': '界面内浮动弹窗（Toasts）',
      'field.enableDesktop': '桌面系统通知（Win/Mac/Linux）',
      'field.notifyBackgroundOnly': '仅在后台或其他会话时通知',
      'field.timeoutMs': 'Webhook 超时（毫秒）',
      'field.dndStart': '免打扰开始时间（HH:MM）',
      'field.dndEnd': '免打扰结束时间（HH:MM）',
      'field.includeSession': '包含会话 ID',
      'field.includeDuration': '包含持续时间',
      'field.excludePrefixes': '排除会话前缀（逗号分隔）',
      'hint.cred': '仅填写凭据名称；其值必须是完整的 Webhook URL。',
      'hint.events': 'task_done, error, approval_requested',
      'btn.testSound': '测试声音',
      'btn.testToast': '测试弹窗',
      'btn.reqPermission': '允许桌面通知',
      'perm.granted': '桌面通知已启用',
      'perm.denied': '已被浏览器设置禁止通知',
      'perm.default': '尚未授权通知权限',
      'toast.taskDone': '任务已完成',
      'toast.error': '任务失败',
      'toast.approval': '需要用户审批',
      'toast.switchToSession': '切换至该会话',
      'settings.loading': '正在加载设置…',
      'settings.unavailable': '此插件的设置范围不可用。',
      'settings.save': '保存',
      'settings.saving': '正在保存…',
      'settings.saved': '已保存',
      'settings.saveFailed': '保存失败：',
      'webpush.section': '网页推送（所有 dsh 标签页关闭时也能收到）',
      'field.enableWebPush': '启用网页推送通道',
      'field.webPushOnlyWhenAway': '仅在无浏览器连接时推送',
      'btn.webpushEnable': '在本设备上启用推送',
      'btn.testPush': '测试推送',
      'webpush.state.unsupported': '当前上下文不支持网页推送——请在浏览器中打开 dsh（HTTPS 或 localhost）使用该通道',
      'webpush.state.denied': '通知权限已被浏览器设置拒绝',
      'webpush.state.disabled': '网页推送通道未启用——请先在上方启用并保存',
      'webpush.state.notSubscribed': '此设备尚未订阅推送',
      'webpush.state.subscribed': '此设备已订阅——可以接收推送',
      'webpush.state.error': '推送设置失败：',
    }

    let ChevronIcon = null
    try {
      const primitives = require('@deepseek-ai/dsh-client-ui-primitives')
      ChevronIcon = primitives && primitives.IconChevronDownOutline14
    } catch (_) {
      ChevronIcon = null
    }

    function FallbackChevron(props) {
      return React.createElement('svg', {
        className: 'pn-chev' + (props.open ? ' pn-chev-open' : ''),
        style: { marginLeft: 'auto', flex: 'none', color: 'var(--dsw-alias-label-tertiary)', transition: 'transform .16s', transform: props.open ? 'rotate(180deg)' : 'none' },
        width: 14, height: 14, viewBox: '0 0 14 14', fill: 'none', 'aria-hidden': 'true',
      }, React.createElement('path', {
        d: 'M3.5 5.25L7 8.75L10.5 5.25', stroke: 'currentColor', strokeWidth: 1.5,
        strokeLinecap: 'round', strokeLinejoin: 'round',
      }))
    }
    const Chevron = ChevronIcon || FallbackChevron

    const cardCss = [
      '.pn-card{border:1px solid var(--dsw-alias-border-l2);background:var(--dsw-alias-bg-layer-3);border-radius:12px;list-style:none}',
      '.pn-head{appearance:none;width:100%;font:inherit;color:inherit;text-align:left;cursor:pointer;background:0 0;border:0;border-radius:12px;display:flex;align-items:center;gap:12px;padding:14px 16px}',
      '.pn-title{color:var(--dsw-alias-label-primary);font-size:15px;font-weight:600;line-height:1.4}',
      '.pn-sub{color:var(--dsw-alias-label-secondary);font-size:13px}',
      '.pn-body{border-top:1px solid var(--dsw-alias-border-l2);margin:0 16px;padding-bottom:8px}',
      '.pn-field{display:flex;flex-direction:column;gap:6px;padding:12px 0}',
      '.pn-label{color:var(--dsw-alias-label-primary);font-size:13px;font-weight:500}',
      '.pn-hint{color:var(--dsw-alias-label-secondary);font-size:12px}',
      '.pn-input{height:34px;border:1px solid var(--dsw-alias-border-l2);background:var(--dsw-alias-bg-layer-3);color:var(--dsw-alias-label-primary);border-radius:8px;padding:0 12px;font-size:13px}',
      '.pn-btn-action{appearance:none;font:inherit;cursor:pointer;border:1px solid var(--dsw-alias-border-l2);border-radius:6px;padding:4px 10px;font-size:12px;background:var(--dsw-alias-bg-layer-4);color:var(--dsw-alias-label-primary)}',
      '.pn-btn-action:hover{background:var(--dsw-alias-bg-layer-2)}',
      '.pn-foot{border-top:1px solid var(--dsw-alias-border-l2);display:flex;justify-content:flex-end;align-items:center;gap:8px;padding:12px 0 4px}',
      '.pn-save{appearance:none;font:inherit;cursor:pointer;border:1px solid transparent;border-radius:8px;padding:5px 14px;font-size:13px;background:var(--dsw-alias-label-primary);color:var(--dsw-alias-bg-layer-3)}',
      '.pn-msg-ok{color:var(--dsw-alias-state-success-primary);font-size:12px}',
      '.pn-msg-err{color:var(--dsw-alias-state-danger-primary);font-size:12px}',
      '.pn-chev{margin-left:auto;flex:none;color:var(--dsw-alias-label-tertiary);transition:transform .16s}',
      '.pn-chev-open{transform:rotate(180deg)}',
      '.pn-toast-container{position:fixed;bottom:24px;right:24px;z-index:99999;display:flex;flex-direction:column-reverse;gap:10px;pointer-events:none;max-width:380px;width:calc(100vw - 48px)}',
      '.pn-toast{pointer-events:auto;background:var(--dsw-alias-bg-layer-3);border:1px solid var(--dsw-alias-border-l2);border-radius:12px;box-shadow:0 8px 24px rgba(0,0,0,0.32);padding:12px 14px;display:flex;flex-direction:column;gap:6px;animation:pnToastIn .24s cubic-bezier(0.16,1,0.3,1);transition:opacity .2s,transform .2s}',
      '.pn-toast.pn-toast-out{opacity:0;transform:translateY(8px)}',
      '.pn-toast-head{display:flex;align-items:center;gap:8px}',
      '.pn-toast-badge{font-size:14px;line-height:1;flex:none}',
      '.pn-toast-title{font-size:13px;font-weight:600;color:var(--dsw-alias-label-primary);flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}',
      '.pn-toast-close{background:0 0;border:0;color:var(--dsw-alias-label-tertiary);cursor:pointer;padding:2px 6px;font-size:14px;border-radius:4px;line-height:1}',
      '.pn-toast-close:hover{color:var(--dsw-alias-label-primary);background:var(--dsw-alias-bg-layer-4)}',
      '.pn-toast-body{font-size:12px;color:var(--dsw-alias-label-secondary);line-height:1.4;overflow:hidden;text-overflow:ellipsis;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical}',
      '.pn-toast-foot{display:flex;align-items:center;justify-content:space-between;margin-top:2px;padding-top:6px;border-top:1px solid var(--dsw-alias-border-l2)}',
      '.pn-toast-sess{font-size:11px;color:var(--dsw-alias-label-tertiary);font-family:monospace;overflow:hidden;text-overflow:ellipsis;max-width:180px;white-space:nowrap}',
      '.pn-toast-btn{background:var(--dsw-alias-bg-layer-4);border:1px solid var(--dsw-alias-border-l2);color:var(--dsw-alias-label-primary);border-radius:6px;padding:3px 8px;font-size:12px;cursor:pointer;font-weight:500}',
      '.pn-toast-btn:hover{background:var(--dsw-alias-label-primary);color:var(--dsw-alias-bg-layer-3)}',
      '@keyframes pnToastIn{from{opacity:0;transform:translateY(12px) scale(0.96)}to{opacity:1;transform:translateY(0) scale(1)}}',
    ].join('')

    function ensureStyles() {
      if (typeof document === 'undefined') return
      if (document.getElementById('dsh-plugin-notify-card-styles')) return
      const el = document.createElement('style')
      el.id = 'dsh-plugin-notify-card-styles'
      el.dataset.dshPlugin = 'dsh-plugin-notify'
      el.textContent = cardCss
      document.head.appendChild(el)
    }

    function makeT(dict, fallback) {
      return function t(key) {
        return (dict && dict[key]) || (fallback && fallback[key]) || key
      }
    }

    function useActiveLocale(ctx) {
      return React.useSyncExternalStore(
        React.useMemo(() => (cb) => (ctx && ctx.locale ? ctx.locale.subscribe(cb) : () => {}), [ctx]),
        React.useCallback(() => (ctx && ctx.locale && ctx.locale.getSnapshot ? ctx.locale.getSnapshot().active : 'en'), [ctx]),
        React.useCallback(() => 'en', []),
      )
    }

    function splitList(s) {
      return String(s || '').split(',').map((x) => x.trim()).filter(Boolean)
    }

    let sharedAudioCtx = null
    function playChime(kind) {
      if (typeof window === 'undefined') return
      try {
        const AudioCtx = window.AudioContext || window.webkitAudioContext
        if (!AudioCtx) return
        if (!sharedAudioCtx || sharedAudioCtx.state === 'closed') {
          sharedAudioCtx = new AudioCtx()
        }
        if (sharedAudioCtx.state === 'suspended') {
          sharedAudioCtx.resume().catch(() => {})
        }
        const actx = sharedAudioCtx
        const now = actx.currentTime
        let notes = [523.25, 659.25, 783.99, 1046.50]
        let step = 0.10
        let duration = 0.35

        if (kind === 'error') {
          notes = [392.00, 311.13, 261.63]
          step = 0.12
          duration = 0.40
        } else if (kind === 'approval_requested') {
          notes = [880.00, 1318.51]
          step = 0.15
          duration = 0.45
        }

        notes.forEach((freq, idx) => {
          const osc = actx.createOscillator()
          const gain = actx.createGain()
          osc.type = 'sine'
          osc.frequency.setValueAtTime(freq, now + idx * step)
          gain.gain.setValueAtTime(0.001, now + idx * step)
          gain.gain.exponentialRampToValueAtTime(0.12, now + idx * step + 0.02)
          gain.gain.exponentialRampToValueAtTime(0.0001, now + idx * step + duration)
          osc.connect(gain)
          gain.connect(actx.destination)
          osc.start(now + idx * step)
          osc.stop(now + idx * step + duration + 0.05)
        })
      } catch (_err) {
        // best effort: audio playback may be blocked by browser policy
      }
    }

    function getActiveSessionId() {
      if (typeof window === 'undefined') return ''
      try {
        const hash = window.location.hash || ''
        const m = hash.match(/session[/-]([a-zA-Z0-9_-]+)/)
        if (m) return m[1]
        const params = new URLSearchParams(window.location.search)
        return params.get('session') || params.get('sessionId') || ''
      } catch (_) {
        return ''
      }
    }

    function navigateToSession(ctx, sessionId) {
      if (!sessionId) return
      try {
        if (ctx && ctx.sessions && typeof ctx.sessions.activate === 'function') {
          ctx.sessions.activate(sessionId)
          return
        }
      } catch (_err) {
        // best effort: session navigation fallback
      }
      if (typeof window !== 'undefined' && window.location) {
        window.location.hash = `session-${sessionId}`
      }
    }

    function urlBase64ToUint8Array(base64String) {
      try {
        const padding = '='.repeat((4 - (base64String.length % 4)) % 4)
        const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/')
        const raw = window.atob(base64)
        const output = new Uint8Array(raw.length)
        for (let i = 0; i < raw.length; i++) output[i] = raw.charCodeAt(i)
        return output
      } catch (_err) {
        return new Uint8Array(0)
      }
    }

    // Document-relative on purpose: the web document declares <base href="./">,
    // so plugin routes resolve correctly behind a --public-url mount prefix.
    function pluginUrl(relPath) {
      try {
        return new URL(relPath, document.baseURI).href
      } catch (_err) {
        return relPath
      }
    }

    function webPushSupported() {
      if (typeof window === 'undefined' || typeof navigator === 'undefined') return false
      if (!('serviceWorker' in navigator) || !('PushManager' in window) || !('Notification' in window)) return false
      if (window.isSecureContext === false) return false
      // Service workers only register on http(s) origins; desktop shells load
      // the UI from custom schemes (e.g. dsh-app://) where they are unavailable.
      const proto = window.location ? window.location.protocol : ''
      if (proto !== 'https:' && proto !== 'http:') return false
      return true
    }

    function registerNotifyServiceWorker() {
      if (!webPushSupported()) return Promise.reject(new Error('unsupported'))
      return navigator.serviceWorker.register(pluginUrl('dsh-plugin-notify/sw.js'), { scope: './' })
    }

    // Permission → service worker → applicationServerKey → subscribe → upload.
    async function enableWebPushOnDevice() {
      if (!webPushSupported()) throw new Error('unsupported')
      const perm = await Notification.requestPermission()
      if (perm !== 'granted') throw new Error('denied')
      const reg = await registerNotifyServiceWorker()
      const keyRes = await fetch(pluginUrl('dsh-plugin-notify/push/key'))
      if (!keyRes.ok) throw new Error('disabled')
      const keyInfo = await keyRes.json().catch(() => null)
      if (!keyInfo || !keyInfo.publicKey) throw new Error('disabled')
      // A stale subscription bound to a previous key blocks re-subscription.
      const existing = await reg.pushManager.getSubscription()
      if (existing) await existing.unsubscribe()
      const sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(keyInfo.publicKey),
      })
      const saveRes = await fetch(pluginUrl('dsh-plugin-notify/push/subscribe'), {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(sub.toJSON ? sub.toJSON() : sub),
      })
      if (!saveRes.ok) throw new Error('subscribe failed (' + saveRes.status + ')')
      return sub
    }

    async function refreshWebPushStatus() {
      if (!webPushSupported()) return 'unsupported'
      if (Notification.permission === 'denied') return 'denied'
      try {
        const keyRes = await fetch(pluginUrl('dsh-plugin-notify/push/key'))
        if (!keyRes.ok) return 'disabled'
        const reg = await navigator.serviceWorker.getRegistration()
        if (!reg) return 'notSubscribed'
        const sub = await reg.pushManager.getSubscription()
        return sub ? 'subscribed' : 'notSubscribed'
      } catch (_err) {
        return 'notSubscribed'
      }
    }

    // A notification click that found no live window opened a fresh one with
    // ?dshNotifySession=<id>: navigate once the sessions service shows up.
    function consumeDeepLink(ctx) {
      if (typeof window === 'undefined') return
      let sessionId = ''
      try {
        const params = new URLSearchParams(window.location.search)
        sessionId = params.get('dshNotifySession') || ''
        if (!sessionId) return
        params.delete('dshNotifySession')
        const qs = params.toString()
        window.history.replaceState({}, '', window.location.pathname + (qs ? '?' + qs : '') + window.location.hash)
      } catch (_err) {
        return
      }
      let tries = 0
      const timer = setInterval(() => {
        tries++
        try {
          if (ctx && ctx.sessions && typeof ctx.sessions.activate === 'function') {
            ctx.sessions.activate(sessionId)
            clearInterval(timer)
            return
          }
        } catch (_err) {
          // retry until the budget is exhausted
        }
        if (tries > 40) clearInterval(timer)
      }, 250)
    }

    function getToastContainer() {
      if (typeof document === 'undefined') return null
      let container = document.getElementById('dsh-notify-toast-container')
      if (!container) {
        container = document.createElement('div')
        container.id = 'dsh-notify-toast-container'
        container.className = 'pn-toast-container'
        container.dataset.dshPlugin = 'dsh-plugin-notify'
        document.body.appendChild(container)
      }
      return container
    }

    function showInAppToast(event, t, ctx) {
      if (typeof document === 'undefined') return
      ensureStyles()
      const container = getToastContainer()
      if (!container) return

      const toast = document.createElement('div')
      toast.className = 'pn-toast'
      toast.dataset.dshPlugin = 'dsh-plugin-notify'
      toast.setAttribute('role', 'alert')

      const badge = event.kind === 'task_done' ? '✅' : event.kind === 'error' ? '⚠️' : '⏸️'
      const kindLabel = event.kind === 'task_done'
        ? (t('toast.taskDone') || 'Task completed')
        : event.kind === 'error'
        ? (t('toast.error') || 'Task failed')
        : (t('toast.approval') || 'Approval required')

      const titleText = `${badge} ${kindLabel}: ${event.title || event.sessionId}`

      const head = document.createElement('div')
      head.className = 'pn-toast-head'

      const titleSpan = document.createElement('span')
      titleSpan.className = 'pn-toast-title'
      titleSpan.textContent = titleText

      const closeBtn = document.createElement('button')
      closeBtn.className = 'pn-toast-close'
      closeBtn.setAttribute('type', 'button')
      closeBtn.setAttribute('aria-label', 'Close')
      closeBtn.textContent = '✕'

      head.appendChild(titleSpan)
      head.appendChild(closeBtn)
      toast.appendChild(head)

      if (event.summary) {
        const body = document.createElement('div')
        body.className = 'pn-toast-body'
        body.textContent = event.summary
        toast.appendChild(body)
      }

      const foot = document.createElement('div')
      foot.className = 'pn-toast-foot'

      const sessSpan = document.createElement('span')
      sessSpan.className = 'pn-toast-sess'
      sessSpan.textContent = `ID: ${String(event.sessionId || '').slice(0, 16)}`
      foot.appendChild(sessSpan)

      if (event.sessionId) {
        const switchBtn = document.createElement('button')
        switchBtn.className = 'pn-toast-btn'
        switchBtn.setAttribute('type', 'button')
        switchBtn.textContent = t('toast.switchToSession') || 'Switch to session'
        switchBtn.onclick = (e) => {
          e.stopPropagation()
          dismiss()
          navigateToSession(ctx, event.sessionId)
        }
        foot.appendChild(switchBtn)
      }
      toast.appendChild(foot)

      let dismissed = false
      const dismiss = () => {
        if (dismissed) return
        dismissed = true
        toast.classList.add('pn-toast-out')
        setTimeout(() => {
          if (toast.parentNode) toast.parentNode.removeChild(toast)
        }, 220)
      }

      closeBtn.onclick = (e) => {
        e.stopPropagation()
        dismiss()
      }

      toast.onclick = () => {
        if (event.sessionId) {
          dismiss()
          navigateToSession(ctx, event.sessionId)
        }
      }

      container.appendChild(toast)
      setTimeout(dismiss, 7000)
    }

    function showDesktopNotification(event, t, ctx) {
      if (typeof window === 'undefined' || !('Notification' in window)) return
      if (Notification.permission !== 'granted') return

      try {
        const kindLabel = event.kind === 'task_done'
          ? (t('toast.taskDone') || 'Task completed')
          : event.kind === 'error'
          ? (t('toast.error') || 'Task failed')
          : (t('toast.approval') || 'Approval required')

        const badge = event.kind === 'task_done' ? '✅' : event.kind === 'error' ? '⚠️' : '⏸️'
        const notifTitle = `${badge} ${kindLabel}: ${event.title || event.sessionId}`

        const bodyParts = []
        if (event.summary) bodyParts.push(event.summary)
        if (event.durationMs) bodyParts.push(`Duration: ${Math.round(event.durationMs / 1000)}s`)
        if (event.sessionId) bodyParts.push(`Session: ${event.sessionId}`)

        const notif = new Notification(notifTitle, {
          body: bodyParts.join('\n'),
          tag: `dsh-notify-${event.sessionId || 'any'}`,
        })

        notif.onclick = () => {
          try {
            if (window.focus) window.focus()
          } catch (_err) {
            // best effort: window focus may be denied
          }
          if (event.sessionId) navigateToSession(ctx, event.sessionId)
          notif.close()
        }
      } catch (_err) {
        // best effort: notification display error
      }
    }

    let activeEventSource = null

    function startSseListener(ctx, t, getSettings) {
      if (typeof window === 'undefined' || typeof window.EventSource === 'undefined') return () => {}
      if (activeEventSource) return () => {}

      let stopped = false
      let es = null

      function connect() {
        if (stopped) return
        try {
          es = new EventSource('/dsh-plugin-notify/events')
          activeEventSource = es

          es.onmessage = (e) => {
            try {
              if (!e.data || e.data.startsWith(':')) return
              const payload = JSON.parse(e.data)
              handleIncomingEvent(payload, ctx, t, getSettings)
            } catch (_err) {
              // ignore malformed SSE payload
            }
          }

          es.onerror = () => {
            if (es) {
              es.close()
              es = null
              activeEventSource = null
            }
            if (!stopped) {
              setTimeout(connect, 5000)
            }
          }
        } catch (_err) {
          // best effort: reconnect if EventSource constructor fails
        }
      }

      connect()

      return () => {
        stopped = true
        if (es) {
          es.close()
          es = null
          activeEventSource = null
        }
      }
    }

    function handleIncomingEvent(event, ctx, t, getSettings) {
      const cfg = (getSettings && getSettings()) || {}
      const activeSid = getActiveSessionId()

      const isBackground = !activeSid || String(event.sessionId) !== String(activeSid)
      const notifyBgOnly = !!cfg.notifyBackgroundOnly

      if (notifyBgOnly && !isBackground) {
        return
      }

      // 1. Audio chime
      if (Boolean(cfg.enableSound)) {
        playChime(event.kind)
      }

      // 2. In-app toast
      if (Boolean(cfg.enableToasts)) {
        showInAppToast(event, t, ctx)
      }

      // 3. Desktop OS notification
      if (Boolean(cfg.enableDesktopNotifications)) {
        showDesktopNotification(event, t, ctx)
      }
    }

    function NotifyCard(props) {
      const ctx = props.ctx
      const locale = useActiveLocale(ctx)
      const t = props.t || makeT(locale === 'zh' ? zh : en, en)
      const [open, setOpen] = React.useState(false)
      const [draft, setDraft] = React.useState(null)
      const [saving, setSaving] = React.useState(false)
      const [err, setErr] = React.useState('')
      const [saved, setSaved] = React.useState(false)
      const [permState, setPermState] = React.useState(() => {
        if (typeof window !== 'undefined' && 'Notification' in window) {
          return Notification.permission
        }
        return 'unsupported'
      })
      const [webPushState, setWebPushState] = React.useState('')
      const [webPushErr, setWebPushErr] = React.useState('')

      React.useEffect(() => {
        refreshWebPushStatus().then(setWebPushState).catch(() => {})
      }, [])

      const onEnableWebPush = async () => {
        setWebPushErr('')
        try {
          await enableWebPushOnDevice()
          setWebPushState('subscribed')
          if (draft) setDraft({ ...draft, enableWebPush: true })
        } catch (e) {
          const msg = String((e && e.message) || e)
          if (msg === 'denied' || msg === 'unsupported' || /not supported/i.test(msg)) {
            setWebPushState('unsupported')
          } else {
            setWebPushState('error')
            setWebPushErr(msg)
          }
        }
      }

      const onTestPush = async () => {
        setWebPushErr('')
        try {
          const res = await fetch(pluginUrl('dsh-plugin-notify/push/test'), { method: 'POST' })
          if (!res.ok) {
            setWebPushState(res.status === 404 ? 'disabled' : 'error')
            if (res.status !== 404) setWebPushErr('HTTP ' + res.status)
            return
          }
          setWebPushState('subscribed')
        } catch (e) {
          setWebPushState('error')
          setWebPushErr(String((e && e.message) || e))
        }
      }

      const webPushStatusText = webPushState === 'error'
        ? t('webpush.state.error') + webPushErr
        : (webPushState ? t('webpush.state.' + webPushState) : '')

      const requestPermission = async () => {
        if (typeof window !== 'undefined' && 'Notification' in window) {
          try {
            const res = await Notification.requestPermission()
            setPermState(res)
          } catch (_err) {
            // best effort: permission request failed
          }
        }
      }

      // dsh 0.1 keys the settings scope by package name; 0.2 keys it by the
      // composition row id. get() always returns a controller, so hold BOTH and
      // use whichever reports ready (the other stays permanently unavailable).
      const [scopeNS, scopeRow] = React.useMemo(
        () => (ctx && ctx.configForms ? [ctx.configForms.get(NS), ctx.configForms.get(ROW_ID)] : [undefined, undefined]),
        [ctx],
      )
      const useSnap = (scope) => React.useSyncExternalStore(
        React.useMemo(() => (cb) => (scope ? scope.subscribe(cb) : () => {}), [scope]),
        React.useCallback(() => (scope ? scope.getSnapshot() : { status: 'loading' }), [scope]),
        React.useCallback(() => ({ status: 'loading' }), []),
      )
      const snapNS = useSnap(scopeNS)
      const snapRow = useSnap(scopeRow)
      const rowWins = scopeRow && snapNS.status !== 'ready' && snapRow.status === 'ready'
      const scope = rowWins ? scopeRow : scopeNS
      const snapshot = rowWins ? snapRow : snapNS

      React.useEffect(() => { ensureStyles() }, [])

      const status = (snapshot && snapshot.status) || 'loading'
      const stored = (snapshot && snapshot.value) || {}

      React.useEffect(() => {
        if (status === 'ready' && draft === null) {
          const wh = stored.webhooks || {}
          setDraft({
            feishu: wh.feishu || '',
            wecom: wh.wecom || '',
            dingtalk: wh.dingtalk || '',
            slack: wh.slack || '',
            discord: wh.discord || '',
            custom: wh.custom || '',
            events: Array.isArray(stored.events) ? stored.events.join(', ') : 'task_done, error, approval_requested',
            local: stored.local !== false,
            enableSound: Boolean(stored.enableSound),
            enableToasts: Boolean(stored.enableToasts),
            enableDesktopNotifications: Boolean(stored.enableDesktopNotifications),
            enableWebPush: Boolean(stored.webPush && stored.webPush.enabled),
            webPushOnlyWhenAway: !(stored.webPush && stored.webPush.onlyWhenAway === false),
            notifyBackgroundOnly: !!stored.notifyBackgroundOnly,
            timeoutMs: String(stored.timeoutMs != null ? stored.timeoutMs : 5000),
            dndStart: (stored.dnd && stored.dnd.start) || '',
            dndEnd: (stored.dnd && stored.dnd.end) || '',
            includeSession: stored.includeSession !== false,
            includeDuration: stored.includeDuration !== false,
            excludePrefixes: Array.isArray(stored.excludeSessionPrefixes) ? stored.excludeSessionPrefixes.join(', ') : '',
          })
        }
      }, [status, stored, draft])

      const save = async () => {
        if (!scope || !draft) return
        setSaving(true); setErr(''); setSaved(false)
        const broken = []
        const webhooks = {}
        for (const ch of CHANNELS) webhooks[ch] = String(draft[ch] || '').trim()
        const timeoutNum = Number(String(draft.timeoutMs).trim())
        const payload = {
          webhooks,
          events: splitList(draft.events),
          local: !!draft.local,
          enableSound: !!draft.enableSound,
          enableToasts: !!draft.enableToasts,
          enableDesktopNotifications: !!draft.enableDesktopNotifications,
          webPush: { enabled: !!draft.enableWebPush, onlyWhenAway: draft.webPushOnlyWhenAway !== false },
          notifyBackgroundOnly: !!draft.notifyBackgroundOnly,
          timeoutMs: Number.isFinite(timeoutNum) && timeoutNum > 0 ? timeoutNum : 5000,
          dnd: { start: String(draft.dndStart || '').trim(), end: String(draft.dndEnd || '').trim() },
          includeSession: !!draft.includeSession,
          includeDuration: !!draft.includeDuration,
          excludeSessionPrefixes: splitList(draft.excludePrefixes),
        }
        for (const [k, v] of Object.entries(payload)) {
          try { await scope.set(k, v) }
          catch (e) { broken.push(k + ': ' + (e && e.message || String(e))) }
        }
        setSaving(false)
        if (broken.length) { setErr(t('settings.saveFailed') + broken.join('; ')); return }
        setSaved(true)
        setTimeout(() => setSaved(false), 2500)
      }

      const field = (key, input) => React.createElement('div', { className: 'pn-field' },
        React.createElement('label', { className: 'pn-label' }, t('field.' + key)),
        input,
        key === 'events' ? React.createElement('span', { className: 'pn-hint' }, t('hint.events'))
          : CHANNELS.includes(key) ? React.createElement('span', { className: 'pn-hint' }, t('hint.cred'))
          : null,
      )

      // Row seat (plugins.row.config): the host page draws title/icon/crumb and the
      // padding, so the summary is a one-liner and the page drops our card chrome.
      if (props && props.view === 'summary') {
        return React.createElement('span', { className: 'pn-sub' }, t('subtitle'))
      }
      const page = !!(props && props.view === 'page')
      // On the plugin page (view === 'page') the head button is hidden, so the
      // body must not depend on the accordion state — always show the form there.
      const expanded = page || open

      return React.createElement(page ? 'div' : 'li', { className: page ? 'pn-page' : 'pn-card' },
        React.createElement('button', { type: 'button', className: 'pn-head', style: page ? { display: 'none' } : undefined, 'aria-expanded': page ? true : open, onClick: () => setOpen((v) => !v) },
          React.createElement('span', { style: { display: 'flex', flexDirection: 'column' } },
            React.createElement('span', { className: 'pn-title' }, t('title')),
            React.createElement('span', { className: 'pn-sub' }, t('subtitle')),
          ),
          React.createElement(Chevron, { open }),
        ),
        expanded ? React.createElement('div', { className: 'pn-body' },
          status === 'loading'
            ? React.createElement('p', { className: 'pn-hint', style: { padding: '12px 0' } }, t('settings.loading'))
            : status !== 'ready'
              ? React.createElement('p', { className: 'pn-msg-err', style: { padding: '12px 0' } }, t('settings.unavailable'))
              : React.createElement('div', null,
                  React.createElement('p', { className: 'pn-hint', style: { padding: '12px 0 0' } }, t('intro')),
                  ...CHANNELS.map((ch) => field(ch, React.createElement('input', {
                    className: 'pn-input', value: (draft && draft[ch]) || '',
                    onChange: (e) => setDraft({ ...draft, [ch]: e.target.value }),
                    autoComplete: 'off',
                  }))),
                  field('events', React.createElement('input', {
                    className: 'pn-input', value: (draft && draft.events) || '',
                    onChange: (e) => setDraft({ ...draft, events: e.target.value }),
                  })),
                  field('timeoutMs', React.createElement('input', {
                    className: 'pn-input', type: 'number', value: (draft && draft.timeoutMs) || '',
                    onChange: (e) => setDraft({ ...draft, timeoutMs: e.target.value }),
                  })),
                  field('dndStart', React.createElement('input', {
                    className: 'pn-input', value: (draft && draft.dndStart) || '',
                    onChange: (e) => setDraft({ ...draft, dndStart: e.target.value }),
                  })),
                  field('dndEnd', React.createElement('input', {
                    className: 'pn-input', value: (draft && draft.dndEnd) || '',
                    onChange: (e) => setDraft({ ...draft, dndEnd: e.target.value }),
                  })),
                  field('excludePrefixes', React.createElement('input', {
                    className: 'pn-input', value: (draft && draft.excludePrefixes) || '',
                    onChange: (e) => setDraft({ ...draft, excludePrefixes: e.target.value }),
                  })),
                  React.createElement('div', { className: 'pn-field', style: { flexDirection: 'row', alignItems: 'center', gap: 8, justifyContent: 'space-between' } },
                    React.createElement('div', { style: { display: 'flex', alignItems: 'center', gap: 8 } },
                      React.createElement('input', { type: 'checkbox', id: 'pn-sound', checked: !!(draft && draft.enableSound), onChange: (e) => setDraft({ ...draft, enableSound: e.target.checked }) }),
                      React.createElement('label', { htmlFor: 'pn-sound', className: 'pn-label' }, t('field.enableSound')),
                    ),
                    React.createElement('button', { type: 'button', className: 'pn-btn-action', onClick: () => playChime('task_done') }, t('btn.testSound')),
                  ),
                  React.createElement('div', { className: 'pn-field', style: { flexDirection: 'row', alignItems: 'center', gap: 8, justifyContent: 'space-between' } },
                    React.createElement('div', { style: { display: 'flex', alignItems: 'center', gap: 8 } },
                      React.createElement('input', { type: 'checkbox', id: 'pn-toasts', checked: !!(draft && draft.enableToasts), onChange: (e) => setDraft({ ...draft, enableToasts: e.target.checked }) }),
                      React.createElement('label', { htmlFor: 'pn-toasts', className: 'pn-label' }, t('field.enableToasts')),
                    ),
                    React.createElement('button', { type: 'button', className: 'pn-btn-action', onClick: () => showInAppToast({ kind: 'task_done', title: 'Example Task', summary: 'Turn completed with 2 tools', sessionId: 'sess-demo-123' }, t, ctx) }, t('btn.testToast')),
                  ),
                  React.createElement('div', { className: 'pn-field', style: { flexDirection: 'row', alignItems: 'center', gap: 8, justifyContent: 'space-between' } },
                    React.createElement('div', { style: { display: 'flex', alignItems: 'center', gap: 8 } },
                      React.createElement('input', { type: 'checkbox', id: 'pn-desktop', checked: !!(draft && draft.enableDesktopNotifications), onChange: (e) => setDraft({ ...draft, enableDesktopNotifications: e.target.checked }) }),
                      React.createElement('label', { htmlFor: 'pn-desktop', className: 'pn-label' }, t('field.enableDesktop')),
                    ),
                    permState === 'default'
                      ? React.createElement('button', { type: 'button', className: 'pn-btn-action', onClick: requestPermission }, t('btn.reqPermission'))
                      : React.createElement('span', { className: 'pn-hint' }, permState === 'granted' ? t('perm.granted') : t('perm.denied')),
                  ),
                  React.createElement('div', { className: 'pn-field' },
                    React.createElement('span', { className: 'pn-label' }, t('webpush.section')),
                    React.createElement('div', { style: { display: 'flex', alignItems: 'center', gap: 8 } },
                      React.createElement('input', { type: 'checkbox', id: 'pn-webpush', checked: !!(draft && draft.enableWebPush), onChange: (e) => setDraft({ ...draft, enableWebPush: e.target.checked }) }),
                      React.createElement('label', { htmlFor: 'pn-webpush', className: 'pn-label' }, t('field.enableWebPush')),
                    ),
                    React.createElement('div', { style: { display: 'flex', alignItems: 'center', gap: 8 } },
                      React.createElement('input', { type: 'checkbox', id: 'pn-wponlyaway', checked: (draft && draft.webPushOnlyWhenAway) !== false, onChange: (e) => setDraft({ ...draft, webPushOnlyWhenAway: e.target.checked }) }),
                      React.createElement('label', { htmlFor: 'pn-wponlyaway', className: 'pn-label' }, t('field.webPushOnlyWhenAway')),
                    ),
                    React.createElement('div', { style: { display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' } },
                      React.createElement('button', { type: 'button', className: 'pn-btn-action', onClick: onEnableWebPush }, t('btn.webpushEnable')),
                      React.createElement('button', { type: 'button', className: 'pn-btn-action', onClick: onTestPush }, t('btn.testPush')),
                      webPushStatusText ? React.createElement('span', { className: 'pn-hint' }, webPushStatusText) : null,
                    ),
                  ),
                  React.createElement('div', { className: 'pn-field', style: { flexDirection: 'row', alignItems: 'center', gap: 8 } },
                    React.createElement('input', { type: 'checkbox', id: 'pn-bgonly', checked: !!(draft && draft.notifyBackgroundOnly), onChange: (e) => setDraft({ ...draft, notifyBackgroundOnly: e.target.checked }) }),
                    React.createElement('label', { htmlFor: 'pn-bgonly', className: 'pn-label' }, t('field.notifyBackgroundOnly')),
                  ),
                  React.createElement('div', { className: 'pn-field', style: { flexDirection: 'row', alignItems: 'center', gap: 8 } },
                    React.createElement('input', { type: 'checkbox', id: 'pn-local', checked: !!(draft && draft.local), onChange: (e) => setDraft({ ...draft, local: e.target.checked }) }),
                    React.createElement('label', { htmlFor: 'pn-local', className: 'pn-label' }, t('field.local')),
                  ),
                  React.createElement('div', { className: 'pn-field', style: { flexDirection: 'row', alignItems: 'center', gap: 8 } },
                    React.createElement('input', { type: 'checkbox', id: 'pn-sess', checked: !!(draft && draft.includeSession), onChange: (e) => setDraft({ ...draft, includeSession: e.target.checked }) }),
                    React.createElement('label', { htmlFor: 'pn-sess', className: 'pn-label' }, t('field.includeSession')),
                  ),
                  React.createElement('div', { className: 'pn-field', style: { flexDirection: 'row', alignItems: 'center', gap: 8 } },
                    React.createElement('input', { type: 'checkbox', id: 'pn-dur', checked: !!(draft && draft.includeDuration), onChange: (e) => setDraft({ ...draft, includeDuration: e.target.checked }) }),
                    React.createElement('label', { htmlFor: 'pn-dur', className: 'pn-label' }, t('field.includeDuration')),
                  ),
                  err ? React.createElement('div', { className: 'pn-msg-err' }, err) : null,
                  saved ? React.createElement('div', { className: 'pn-msg-ok' }, t('settings.saved')) : null,
                  React.createElement('div', { className: 'pn-foot' },
                    React.createElement('button', { type: 'button', className: 'pn-save', disabled: saving, onClick: save }, saving ? t('settings.saving') : t('settings.save')),
                  ),
                ),
        ) : null,
      )
    }

    function apply(ctx) {
      const t = ctx.locale ? ctx.locale.bind(NS) : ((k) => k)
      ctx.effect(() => ctx.locale.register(NS, { en, zh }), 'dsh-plugin-notify: dictionaries')

      try {
        // Plugin-list seat (plugins.item) first: the seat the current core
        // (0.1.6-alpha.2) renders as the plugin's own page with its configuration. The
        // label is a static string on purpose — it is resolved while the page renders,
        // and a locale lookup there would take the whole client batch down with it.
        ctx.slots.inject('plugins.item', () => {
          ctx.slots.register(
            { name: 'plugins.item', id: ROW_ID, order: 40, label: () => 'Notify', locale: NS, inject: () => ({ ctx }) },
            (props) => React.createElement(NotifyCard, { ...props, ctx }),
          )
        })
        // Row seat and the legacy seat kept as fallbacks for older cores.
        ctx.slots.inject('plugins.row.config', () => {
          ctx.slots.register(
            { name: 'plugins.row.config', key: ROW_CONFIG_KEY, locale: NS, order: 40, inject: () => ({ ctx }) },
            (props) => React.createElement(NotifyCard, { ...props, ctx }),
          )
        })
        ctx.slots.inject('settings.plugin.item', () => {
          ctx.slots.register(
            { name: 'settings.plugin.item', key: NS, locale: NS, order: 40, inject: () => ({ ctx }) },
            (props) => React.createElement(NotifyCard, { ...props, ctx }),
          )
        })
      } catch (e) {
        console.warn('[dsh-plugin-notify] settings seats failed', e)
      }

      let currentSettings = {}
      if (ctx.configForms) {
        try {
          const candidates = [ctx.configForms.get(NS), ctx.configForms.get(ROW_ID)]
          const ready = candidates.find((s) => s && s.getSnapshot && s.getSnapshot().status === 'ready')
          const scope = ready || candidates[0]
          if (scope && typeof scope.subscribe === 'function') {
            scope.subscribe(() => {
              const snap = scope.getSnapshot ? scope.getSnapshot() : null
              if (snap && snap.status === 'ready' && snap.value) {
                currentSettings = snap.value
              }
            })
          }
          const initial = scope && typeof scope.getSnapshot === 'function' ? scope.getSnapshot() : null
          if (initial && initial.status === 'ready' && initial.value) {
            currentSettings = initial.value
          }
        } catch (_err) {
          // best effort: fallback if snapshot fails
        }
      }

      if (typeof ctx.effect === 'function') {
        ctx.effect(() => {
          return startSseListener(ctx, t, () => currentSettings)
        }, 'dsh-plugin-notify: sse')
      } else {
        startSseListener(ctx, t, () => currentSettings)
      }

      // Web push: a notification click that found this live window jumps it here.
      try {
        if (typeof navigator !== 'undefined' && navigator.serviceWorker && typeof navigator.serviceWorker.addEventListener === 'function') {
          ctx.effect(() => {
            const onMessage = (e) => {
              const d = e && e.data
              if (d && d.type === 'dsh-notify-jump' && d.sessionId) navigateToSession(ctx, d.sessionId)
            }
            navigator.serviceWorker.addEventListener('message', onMessage)
            return () => {
              try { navigator.serviceWorker.removeEventListener('message', onMessage) } catch (_err) { /* ignore */ }
            }
          }, 'dsh-plugin-notify: sw messages')
        }
      } catch (_err) {
        // best effort: service worker messaging unavailable
      }

      // A push notification that opened a fresh window lands here: ?dshNotifySession=<id>.
      try {
        consumeDeepLink(ctx)
      } catch (_err) {
        // best effort: deep-link consumption is optional
      }
    }

    module.exports = { apply, inject: ['slots', 'locale', 'configForms'] }
    return module.exports
  },
})
