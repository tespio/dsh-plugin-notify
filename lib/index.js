import { spawn } from 'node:child_process';
import crypto from 'node:crypto';
import fs from 'node:fs';
import fsp from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import Schema from '@deepseek-ai/schemastery';
import { credentialRef } from '@deepseek-ai/dsh-credentials';

export const name = '@goodandready/dsh-plugin-notify';
/** Settings namespace shared with the Web settings card. */
export const NS = '@goodandready/dsh-plugin-notify';

// Session firehose + credentials (webhook URL refs) + settings scope for the card + webServer for SSE events + connection for authentication.
export const inject = ['sessions', 'credentials', 'settings', 'webServer', 'connection'];

const webhookRef = (label) => Schema.string()
    .role('credential-ref')
    .volatile()
    .description(`${label}: DSH credential name whose value is the full webhook URL (not the URL itself). Empty disables the channel.`)

// Everything the settings card writes is marked volatile so dsh 0.2 accepts
// live edits through the settings controller (0.1 ignores the flag). Only
// leaves may be volatile: cordis 0.2 rejects volatile fields under a
// volatile enclosing object.
export const Config = Schema.object({
    webhooks: Schema.object({
        feishu: webhookRef('Feishu custom bot'),
        wecom: webhookRef('WeCom group bot'),
        dingtalk: webhookRef('DingTalk group bot'),
        slack: webhookRef('Slack Incoming Webhook'),
        discord: webhookRef('Discord webhook'),
        custom: webhookRef('Custom generic webhook (POST JSON)'),
    }).description('Per-channel credential refs for webhook URLs; leave empty to disable'),
    events: Schema.array(Schema.string())
        .volatile()
        .description('Events that trigger notifications: task_done / error / approval_requested'),
    local: Schema.boolean().default(true).volatile().description('Also emit a local system notification (macOS osascript)'),
    enableSound: Schema.boolean().default(false).volatile().description('Play synthesized audio chime on completion, error, or approval'),
    enableToasts: Schema.boolean().default(false).volatile().description('Show in-app on-screen toast notifications across sessions'),
    enableDesktopNotifications: Schema.boolean().default(false).volatile().description('Show native desktop/OS push notifications (Windows, macOS, Linux)'),
    notifyBackgroundOnly: Schema.boolean().default(false).volatile().description('Notify only if the event occurred in a background/inactive session'),
    timeoutMs: Schema.number().default(5000).volatile().description('Per-webhook request timeout (ms)'),
    dnd: Schema.object({
        start: Schema.string().default('').volatile().description('Do-not-disturb start (HH:MM, empty disables)'),
        end: Schema.string().default('').volatile().description('Do-not-disturb end (HH:MM, cross-midnight ok)'),
    }).description('DND window: events are logged but no local/webhook emission'),
    includeSession: Schema.boolean().default(true).volatile().description('Include the session line in notification text'),
    includeDuration: Schema.boolean().default(true).volatile().description('Include the duration line in notification text'),
    excludeSessionPrefixes: Schema.array(Schema.string())
        .default([])
        .volatile()
        .description('Skip notifications when session id starts with any prefix (e.g. msgw- for messenger-gateway)'),
    webPush: Schema.object({
        enabled: Schema.boolean().default(false).volatile()
            .description('Web Push (PWA) channel: send service-worker push notifications that reach devices with every dsh tab closed'),
        onlyWhenAway: Schema.boolean().default(true).volatile()
            .description('Skip web push while a browser client is connected to the SSE stream'),
        subject: Schema.string().default('mailto:notify@localhost').volatile()
            .description('VAPID subject (mailto: or https: contact URL) advertised to push services'),
        stateFile: Schema.string().default('').volatile()
            .description('State file for VAPID keys and push subscriptions (default: $DSH_HOME/plugin-notify-state.json)'),
    }).description('Web Push (PWA) channel configuration'),
});

function isExcludedSession(sessionId, prefixes) {
    const sid = String(sessionId);
    for (const p of prefixes ?? []) {
        if (typeof p === 'string' && p.length > 0 && sid.startsWith(p))
            return true;
    }
    return false;
}

// Unwrap Volatile boxes before any caller reads a value. A volatile field holds a box
// rather than its value, and the Loader mutates those boxes in place.
export function plainConfig(value) {
  if (value === null || typeof value !== 'object') return value
  if (Array.isArray(value)) return value.map(plainConfig)
  if (typeof value.get === 'function') return plainConfig(value.get())
  return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, plainConfig(v)]))
}

export const unwrapConfig = plainConfig

const DEFAULT_EVENTS = ['task_done', 'error', 'approval_requested'];
/** Per-session last `turn/start` epoch ms, for turn-duration reporting. */
export const turnStarts = new Map();
const warnedLegacyUrls = new Set();

/**
 * Purge turnStarts entries older than maxAgeMs (default 2 hours) to prevent
 * memory leaks from abandoned or cancelled sessions.
 */
export function cleanupTurnStarts(maxAgeMs = 7200000, now = Date.now()) {
    let deleted = 0;
    for (const [sid, start] of turnStarts.entries()) {
        if (now - start > maxAgeMs) {
            turnStarts.delete(sid);
            deleted++;
        }
    }
    return deleted;
}

/** Resolve a config value to a webhook URL: credential ref (preferred), env fallback, or legacy raw URL. */
export async function resolveWebhookValue(ctx, refOrUrl) {
    if (!refOrUrl || typeof refOrUrl !== 'string') return '';
    const v = refOrUrl.trim();
    if (!v) return '';
    if (/^https?:\/\//i.test(v)) {
        if (!warnedLegacyUrls.has(v)) {
            warnedLegacyUrls.add(v);
            ctx?.logger?.warn?.('[plugin-notify] raw webhook URL in Config is deprecated; store the URL in Credentials and put only the credential name in settings');
        }
        return v;
    }
    if (ctx?.credentials && typeof ctx.credentials.resolve === 'function') {
        try {
            const hit = await ctx.credentials.resolve(credentialRef(v));
            if (hit?.value) return String(hit.value);
        } catch (error) {
            ctx?.logger?.warn?.(`[plugin-notify] credential resolve skipped for ${v}: ${String(error)}`);
        }
    }
    return process.env[v] || '';
}

export async function resolveWebhooks(ctx, webhooks = {}) {
    const out = {};
    for (const [channel, ref] of Object.entries(webhooks || {})) {
        const url = await resolveWebhookValue(ctx, ref);
        if (url) out[channel] = url;
    }
    return out;
}

export const sseClients = new Set();

export function sendSseHeartbeat() {
    if (sseClients.size === 0) return 0;
    let sent = 0;
    for (const res of sseClients) {
        try {
            res.write(': ping\n\n');
            sent++;
        } catch {
            sseClients.delete(res);
        }
    }
    return sent;
}

function isLoopback(address) {
    if (!address) return false;
    return address === '127.0.0.1' || address === '::1' || address === '::ffff:127.0.0.1' || address === 'localhost';
}

function connectionOf(ctx) {
    if (!ctx) return null;
    return Reflect.get(ctx, 'connection') || null;
}

/**
 * Origin and session verification for internal SSE events stream.
 * Delegates to DSH connection service (Host/Origin fence + browser authentication session),
 * with loopback-only fallback when connection service is absent (e.g. standalone tests).
 */
export function isTrustedRequest(request, targetCtx) {
    if (!request || !request.headers) return false;

    const conn = connectionOf(targetCtx);
    if (conn && typeof conn.requestRejection === 'function') {
        const rejection = conn.requestRejection(request);
        return rejection === void 0;
    }

    const remoteAddr = request.socket?.remoteAddress || request.connection?.remoteAddress;
    return Boolean(remoteAddr && isLoopback(remoteAddr));
}

export function broadcastSse(eventData) {
    if (sseClients.size === 0) return 0;
    const raw = `data: ${JSON.stringify(eventData)}\n\n`;
    let sent = 0;
    for (const res of sseClients) {
        try {
            res.write(raw);
            sent++;
        } catch {
            sseClients.delete(res);
        }
    }
    return sent;
}

export function handleSseConnection(req, res, targetCtx) {
    if (req.method !== 'GET') {
        res.statusCode = 405;
        if (typeof res.setHeader === 'function') res.setHeader('allow', 'GET');
        if (typeof res.writeHead === 'function') res.writeHead(405, { 'Content-Type': 'text/plain; charset=utf-8' });
        if (typeof res.end === 'function') res.end('Method Not Allowed');
        return;
    }

    const conn = connectionOf(targetCtx);
    if (conn && typeof conn.requestRejection === 'function') {
        const rejection = conn.requestRejection(req);
        if (rejection !== void 0) {
            res.statusCode = rejection;
            if (typeof res.writeHead === 'function') {
                res.writeHead(rejection, { 'Content-Type': 'text/plain; charset=utf-8' });
            }
            if (typeof res.end === 'function') {
                res.end(rejection === 401 ? 'Unauthorized' : 'Forbidden');
            }
            return;
        }
    } else {
        const remoteAddr = req.socket?.remoteAddress || req.connection?.remoteAddress;
        if (!remoteAddr || !isLoopback(remoteAddr)) {
            res.statusCode = 403;
            if (typeof res.writeHead === 'function') {
                res.writeHead(403, { 'Content-Type': 'text/plain; charset=utf-8' });
            }
            if (typeof res.end === 'function') {
                res.end('Forbidden');
            }
            return;
        }
    }

    if (typeof res.writeHead === 'function') {
        res.writeHead(200, {
            'Content-Type': 'text/event-stream',
            'Cache-Control': 'no-cache, no-transform',
            'Connection': 'keep-alive',
        });
    }
    if (typeof res.write === 'function') {
        res.write(': connected\n\n');
    }
    sseClients.add(res);

    const onEnd = () => {
        sseClients.delete(res);
    };
    if (typeof req.on === 'function') req.on('close', onEnd);
    if (typeof res.on === 'function') {
        res.on('close', onEnd);
        res.on('error', onEnd);
    }
}

export function closeAllSseClients() {
    for (const res of Array.from(sseClients)) {
        try {
            if (!res.writableEnded) {
                if (typeof res.write === 'function' && res.headersSent) {
                    try {
                        res.write(': closing\n\n');
                    } catch { /* ignore write failure */ }
                }
                if (typeof res.end === 'function') {
                    res.end();
                } else if (typeof res.destroy === 'function') {
                    res.destroy();
                }
            }
        } catch {
            // ignore close error
        } finally {
            sseClients.delete(res);
        }
    }
    sseClients.clear();
}

// ---------------------------------------------------------------------------
// Web Push (PWA) channel: VAPID keys + subscription state, push routes, sender.
// Reaches devices with every dsh tab closed — the SSE/local channels cannot.
// ---------------------------------------------------------------------------

/** Service worker served at GET /dsh-plugin-notify/sw.js (no secrets inside). */
export const SW_SOURCE = [
    'self.addEventListener("push", (event) => {',
    '  let data = {};',
    '  try { data = event.data ? event.data.json() : {}; } catch (_) { data = {}; }',
    '  const title = data.title || "DeepSeek Harness";',
    '  event.waitUntil(self.registration.showNotification(title, {',
    '    body: data.body || "",',
    '    tag: data.tag || "dsh-notify",',
    '    data: { sessionId: data.sessionId || "" },',
    '  }));',
    '});',
    'self.addEventListener("notificationclick", (event) => {',
    '  event.notification.close();',
    '  const sessionId = (event.notification.data && event.notification.data.sessionId) || "";',
    '  const target = sessionId ? "./?dshNotifySession=" + encodeURIComponent(sessionId) : "./";',
    '  event.waitUntil((async () => {',
    '    const clientList = await self.clients.matchAll({ type: "window", includeUncontrolled: true });',
    '    for (const client of clientList) {',
    '      let pathname = "";',
    '      try { pathname = new URL(client.url).pathname; } catch (_) { continue; }',
    '      if (pathname.endsWith("/") || pathname.endsWith("/index.html")) {',
    '        await client.focus();',
    '        if (sessionId) client.postMessage({ type: "dsh-notify-jump", sessionId });',
    '        return;',
    '      }',
    '    }',
    '    await self.clients.openWindow(target);',
    '  })());',
    '});',
].join('\n');

/** Env overrides so users can keep VAPID keys out of the state file entirely. */
export const VAPID_PUBLIC_ENV = 'DSH_NOTIFY_VAPID_PUBLIC_KEY';
export const VAPID_PRIVATE_ENV = 'DSH_NOTIFY_VAPID_PRIVATE_KEY';

/** P-256 VAPID keypair as base64url — raw 65-byte point / raw 32-byte scalar,
 *  the exact shapes web-push.generateVAPIDKeys() produces (applicationServerKey needs the raw point).
 *  ECDH, not DER slicing: the pkcs8 DER ends with the public key, so slice(-32) would grab point bytes. */
export function generateVapidKeys() {
    const ecdh = crypto.createECDH('prime256v1');
    ecdh.generateKeys();
    return {
        publicKey: ecdh.getPublicKey('base64url'),
        privateKey: ecdh.getPrivateKey('base64url'),
    };
}

export function resolveStatePath(webPushConfig = {}) {
    if (webPushConfig && typeof webPushConfig.stateFile === 'string' && webPushConfig.stateFile.trim())
        return webPushConfig.stateFile.trim();
    const home = (process.env.DSH_HOME && process.env.DSH_HOME.trim())
        || path.join(os.homedir(), '.dsh');
    return path.join(home, 'plugin-notify-state.json');
}

export async function loadState(statePath) {
    try {
        const raw = await fsp.readFile(statePath, 'utf8');
        const parsed = JSON.parse(raw);
        return {
            vapid: (parsed && typeof parsed.vapid === 'object' && parsed.vapid) || null,
            subscriptions: Array.isArray(parsed?.subscriptions) ? parsed.subscriptions : [],
        };
    } catch {
        return { vapid: null, subscriptions: [] };
    }
}

/** Atomic-ish persist: temp file + rename, serialized per path to avoid RMW races. */
const writeChains = new Map();
export function saveState(statePath, state) {
    const prev = writeChains.get(statePath) || Promise.resolve();
    const next = prev.catch(() => {}).then(async () => {
        await fsp.mkdir(path.dirname(statePath), { recursive: true });
        const tmp = `${statePath}.${process.pid}.${Date.now()}.tmp`;
        await fsp.writeFile(tmp, JSON.stringify(state, null, 2), 'utf8');
        await fsp.rename(tmp, statePath);
    });
    writeChains.set(statePath, next);
    return next;
}

/** Env keys win; otherwise state file; otherwise generate once and persist. */
export async function getVapidKeys(ctx, webPushConfig = {}) {
    const envPub = process.env[VAPID_PUBLIC_ENV];
    const envPriv = process.env[VAPID_PRIVATE_ENV];
    if (envPub && envPriv) {
        return { publicKey: envPub, privateKey: envPriv };
    }
    const statePath = resolveStatePath(webPushConfig);
    const state = await loadState(statePath);
    if (state.vapid && state.vapid.publicKey && state.vapid.privateKey)
        return state.vapid;
    const keys = generateVapidKeys();
    state.vapid = keys;
    await saveState(statePath, state);
    ctx?.logger?.info?.(`[plugin-notify] generated VAPID keys → ${statePath}`);
    return keys;
}

function isValidSubscription(sub) {
    return Boolean(
        sub
        && typeof sub.endpoint === 'string'
        && /^https:\/\//i.test(sub.endpoint)
        && sub.keys
        && typeof sub.keys.p256dh === 'string' && sub.keys.p256dh.length > 0
        && typeof sub.keys.auth === 'string' && sub.keys.auth.length > 0,
    );
}

export async function addSubscription(statePath, sub) {
    if (!isValidSubscription(sub))
        throw new Error('invalid push subscription (need https endpoint and keys.p256dh/auth)');
    const state = await loadState(statePath);
    const clean = { endpoint: sub.endpoint, keys: { p256dh: sub.keys.p256dh, auth: sub.keys.auth }, addedAt: Date.now() };
    const existing = state.subscriptions.findIndex((s) => s.endpoint === clean.endpoint);
    if (existing >= 0) state.subscriptions[existing] = clean;
    else state.subscriptions.push(clean);
    await saveState(statePath, state);
    return state.subscriptions.length;
}

export async function removeSubscription(statePath, endpoint) {
    const state = await loadState(statePath);
    const before = state.subscriptions.length;
    state.subscriptions = state.subscriptions.filter((s) => s.endpoint !== endpoint);
    if (state.subscriptions.length !== before)
        await saveState(statePath, state);
    return before - state.subscriptions.length;
}

export async function listSubscriptions(statePath) {
    const state = await loadState(statePath);
    return state.subscriptions;
}

let webPushLibrary = null;
/** Test seam: inject a stub with async sendNotification(sub, payload, options). */
export function setWebPushLibrary(lib) {
    webPushLibrary = lib;
}
async function getWebPush() {
    if (!webPushLibrary) {
        const mod = await import('web-push');
        webPushLibrary = mod.default ?? mod;
    }
    return webPushLibrary;
}

/** Compact payload for the 4 KB push budget: pointer + label, never secret material. */
export function webPushPayload(n, config = {}) {
    const badge = n.kind === 'task_done' ? '✅' : n.kind === 'error' ? '⚠️' : '⏸️';
    const kindLabel = n.kind === 'task_done' ? 'Task done' : n.kind === 'error' ? 'Error' : 'Approval needed';
    const title = `${badge} ${kindLabel}: ${n.title || n.sessionId || ''}`.trim();
    const bodyLines = [];
    if (n.summary) bodyLines.push(n.summary);
    if (n.reason) bodyLines.push(`Reason: ${n.reason}`);
    if ((config.includeDuration ?? true) && n.durationMs !== undefined)
        bodyLines.push(`Duration: ${formatDuration(n.durationMs)}`);
    if ((config.includeSession ?? true) && n.sessionId)
        bodyLines.push(`Session: ${n.sessionId}`);
    return {
        kind: n.kind,
        title,
        body: bodyLines.join('\n'),
        sessionId: n.sessionId || '',
        tag: `dsh-notify-${n.sessionId || 'any'}`,
        ts: Date.now(),
    };
}

const inFlightDeliveries = new Set();
/** Test seam: resolves once every in-flight deliverWebPush has finished. */
export async function settleWebPushDeliveries() {
  while (inFlightDeliveries.size > 0) {
    await Promise.allSettled([...inFlightDeliveries]);
  }
}

export function deliverWebPush(ctx, n, config = {}) {
    let tracked;
    tracked = (async () => {
        const wp = config.webPush || {};
        const statePath = resolveStatePath(wp);
        const subscriptions = await listSubscriptions(statePath);
        if (subscriptions.length === 0) return 0;
        const keys = await getVapidKeys(ctx, wp);
        const webpush = await getWebPush();
        const payload = JSON.stringify(webPushPayload(n, config));
        let sent = 0;
        for (const sub of subscriptions) {
            try {
                await webpush.sendNotification(sub, payload, {
                    vapidDetails: {
                        subject: wp.subject || 'mailto:notify@localhost',
                        publicKey: keys.publicKey,
                        privateKey: keys.privateKey,
                    },
                    timeout: Math.max(config.timeoutMs ?? 5000, 1000),
                });
                sent++;
            } catch (error) {
                if (error?.statusCode === 404 || error?.statusCode === 410) {
                    await removeSubscription(statePath, sub.endpoint);
                    ctx?.logger?.info?.(`[plugin-notify] pruned dead push subscription (${error.statusCode})`);
                } else {
                    ctx?.logger?.warn?.(`[plugin-notify] web push send failed: ${String(error)}`);
                }
            }
        }
        return sent;
    })().finally(() => {
        inFlightDeliveries.delete(tracked);
    });
    inFlightDeliveries.add(tracked);
    return tracked;
}

function readJsonBody(req, limit = 64 * 1024) {
    return new Promise((resolve, reject) => {
        let size = 0;
        const chunks = [];
        req.on('data', (chunk) => {
            size += chunk.length;
            if (size > limit) {
                reject(new Error('request body too large'));
                req.destroy();
                return;
            }
            chunks.push(chunk);
        });
        req.on('end', () => {
            try {
                resolve(chunks.length ? JSON.parse(Buffer.concat(chunks).toString('utf8')) : {});
            } catch {
                reject(new Error('invalid JSON body'));
            }
        });
        req.on('error', reject);
    });
}

function writeJson(res, status, body, headers = {}) {
    if (typeof res.writeHead === 'function') {
        res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', ...headers });
    } else {
        res.statusCode = status;
    }
    if (typeof res.end === 'function') res.end(JSON.stringify(body));
}

function writeText(res, status, text, headers = {}) {
    if (typeof res.writeHead === 'function') {
        res.writeHead(status, { 'Content-Type': 'text/plain; charset=utf-8', ...headers });
    } else {
        res.statusCode = status;
    }
    if (typeof res.end === 'function') res.end(text);
}

/** Shared auth for push routes: same fence as the SSE stream. Returns true when accepted. */
export function authorizePushRequest(req, res, targetCtx) {
    const conn = connectionOf(targetCtx);
    if (conn && typeof conn.requestRejection === 'function') {
        const rejection = conn.requestRejection(req);
        if (rejection !== void 0) {
            writeText(res, rejection, rejection === 401 ? 'Unauthorized' : 'Forbidden');
            return false;
        }
        return true;
    }
    const remoteAddr = req.socket?.remoteAddress || req.connection?.remoteAddress;
    if (!remoteAddr || !isLoopback(remoteAddr)) {
        writeText(res, 403, 'Forbidden');
        return false;
    }
    return true;
}

export function handleServiceWorker(req, res) {
    if (req.method !== 'GET') {
        writeText(res, 405, 'Method Not Allowed', { allow: 'GET' });
        return;
    }
    // Unauthenticated on purpose: static, no secrets; the header lets the SW
    // control the app root even though the script lives under /dsh-plugin-notify/.
    if (typeof res.writeHead === 'function') {
        res.writeHead(200, {
            'Content-Type': 'text/javascript; charset=utf-8',
            'Service-Worker-Allowed': '/',
            'Cache-Control': 'no-store',
        });
    } else {
        res.statusCode = 200;
    }
    if (typeof res.end === 'function') res.end(SW_SOURCE);
}

export async function handlePushKey(req, res, targetCtx, getConfig) {
    const getConfigU = () => unwrapConfig(getConfig());
    if (req.method !== 'GET') return writeText(res, 405, 'Method Not Allowed', { allow: 'GET' });
    if (!authorizePushRequest(req, res, targetCtx)) return;
    const cfg = getConfigU();
    if (!(cfg.webPush && cfg.webPush.enabled)) return writeText(res, 404, 'web push disabled');
    const keys = await getVapidKeys(targetCtx, cfg.webPush || {});
    writeJson(res, 200, { publicKey: keys.publicKey, subject: cfg.webPush.subject || 'mailto:notify@localhost' });
}

export async function handlePushSubscribe(req, res, targetCtx, getConfig) {
    const getConfigU = () => unwrapConfig(getConfig());
    if (req.method !== 'POST') return writeText(res, 405, 'Method Not Allowed', { allow: 'POST' });
    if (!authorizePushRequest(req, res, targetCtx)) return;
    const cfg = getConfigU();
    if (!(cfg.webPush && cfg.webPush.enabled)) return writeText(res, 404, 'web push disabled');
    let sub;
    try {
        sub = await readJsonBody(req);
    } catch (error) {
        return writeText(res, 400, String(error.message || error));
    }
    const statePath = resolveStatePath(cfg.webPush || {});
    try {
        const count = await addSubscription(statePath, sub);
        targetCtx?.logger?.info?.(`[plugin-notify] push subscribed (${count} total)`);
        writeJson(res, 200, { ok: true, count });
    } catch (error) {
        writeText(res, 400, String(error.message || error));
    }
}

export async function handlePushUnsubscribe(req, res, targetCtx, getConfig) {
    const getConfigU = () => unwrapConfig(getConfig());
    if (req.method !== 'POST') return writeText(res, 405, 'Method Not Allowed', { allow: 'POST' });
    if (!authorizePushRequest(req, res, targetCtx)) return;
    const cfg = getConfigU();
    if (!(cfg.webPush && cfg.webPush.enabled)) return writeText(res, 404, 'web push disabled');
    let body;
    try {
        body = await readJsonBody(req);
    } catch (error) {
        return writeText(res, 400, String(error.message || error));
    }
    if (!body || typeof body.endpoint !== 'string') return writeText(res, 400, 'endpoint required');
    const removed = await removeSubscription(resolveStatePath(cfg.webPush || {}), body.endpoint);
    writeJson(res, 200, { ok: true, removed });
}

export async function handlePushTest(req, res, targetCtx, getConfig) {
    const getConfigU = () => unwrapConfig(getConfig());
    if (req.method !== 'POST') return writeText(res, 405, 'Method Not Allowed', { allow: 'POST' });
    if (!authorizePushRequest(req, res, targetCtx)) return;
    const cfg = getConfigU();
    if (!(cfg.webPush && cfg.webPush.enabled)) return writeText(res, 404, 'web push disabled');
    const sent = await deliverWebPush(targetCtx, {
        kind: 'task_done',
        title: 'Test notification',
        sessionId: 'test',
        summary: 'If you can read this, the dsh-plugin-notify web push channel works.',
    }, cfg);
    writeJson(res, 200, { ok: true, sent });
}

function mountWebServer(targetCtx, hostCtx, getConfig) {
    if (!targetCtx?.webServer?.register) return () => {};
    // Async route wrapper: an unexpected rejection becomes a 500 instead of an
    // unhandled rejection; authorized handlers have already written their response.
    const asyncRoute = (handler) => (req, res) => {
        Promise.resolve(handler(req, res)).catch(() => {
            try { writeText(res, 500, 'internal error'); } catch { /* ignore */ }
        });
    };
    const routeDefs = [
        {
            kind: 'exact',
            path: '/dsh-plugin-notify/events',
            handler: (req, res) => handleSseConnection(req, res, targetCtx),
        },
        {
            kind: 'exact',
            path: '/dsh-plugin-notify/sw.js',
            handler: (req, res) => handleServiceWorker(req, res),
        },
        {
            kind: 'exact',
            path: '/dsh-plugin-notify/push/key',
            handler: asyncRoute((req, res) => handlePushKey(req, res, targetCtx, getConfig)),
        },
        {
            kind: 'exact',
            path: '/dsh-plugin-notify/push/subscribe',
            handler: asyncRoute((req, res) => handlePushSubscribe(req, res, targetCtx, getConfig)),
        },
        {
            kind: 'exact',
            path: '/dsh-plugin-notify/push/unsubscribe',
            handler: asyncRoute((req, res) => handlePushUnsubscribe(req, res, targetCtx, getConfig)),
        },
        {
            kind: 'exact',
            path: '/dsh-plugin-notify/push/test',
            handler: asyncRoute((req, res) => handlePushTest(req, res, targetCtx, getConfig)),
        },
    ];

    let timer = null;
    const startHeartbeat = () => {
        timer = setInterval(() => sendSseHeartbeat(), 25000);
        timer?.unref?.();
        return () => {
            if (timer) {
                clearInterval(timer);
                timer = null;
            }
        };
    };

    let unregister = null;
    let disposed = false;
    const cleanup = () => {
        if (disposed) return;
        disposed = true;
        if (timer) {
            clearInterval(timer);
            timer = null;
        }
        if (Array.isArray(unregister)) {
            for (const fn of unregister) {
                try { fn(); } catch { /* ignore */ }
            }
            unregister = null;
        }
        closeAllSseClients();
    };

    if (typeof targetCtx.effect === 'function') {
        targetCtx.effect(() => {
            unregister = routeDefs.map((routeDef) => targetCtx.webServer.register(routeDef));
            return () => cleanup();
        }, 'dsh-plugin-notify: sse events');
        targetCtx.effect(() => {
            return startHeartbeat();
        }, 'dsh-plugin-notify: sse heartbeat');
    } else {
        unregister = routeDefs.map((routeDef) => targetCtx.webServer.register(routeDef));
        startHeartbeat();
    }

    return cleanup;
}

export function apply(ctx, config = {}) {
    let getConfig = () => config ?? {};

    let webServerMounted = false;
    let unmountWebServer = null;

    const tryMountWebServer = (target) => {
        if (webServerMounted) return;
        if (target?.webServer?.register) {
            webServerMounted = true;
            const effectiveTarget = target?.connection ? target : (ctx?.connection ? ctx : target);
            unmountWebServer = mountWebServer(effectiveTarget, ctx, () => getConfig());
        }
    };

    const disposePlugin = () => {
        if (typeof unmountWebServer === 'function') {
            try { unmountWebServer(); } catch { /* ignore */ }
            unmountWebServer = null;
        }
        closeAllSseClients();
        turnStarts.clear();
        webServerMounted = false;
    };

    if (typeof ctx.effect === 'function') {
        ctx.effect(() => () => disposePlugin(), 'dsh-plugin-notify: lifecycle cleanup');
    }
    if (typeof ctx.on === 'function') {
        ctx.on('dispose', disposePlugin);
    }

    if (typeof ctx.inject === 'function') {
        ctx.inject(['settings'], (sctx) => {
            if (typeof sctx.settings?.register === 'function') {
                const scope = sctx.settings.register(NS, Config, { base: config ?? {} });
                getConfig = () => scope.get() ?? config ?? {};
                return;
            }
            const row = (() => { try { return sctx.settings?.describe?.().find((r) => r && r.ns === NS); } catch { return null; } })();
            const scope = {
              get: () => row?.value ?? config ?? {},
              replace: async (next) => {
                try {
                  return await sctx.settings?.replace?.(NS, next, row?.revision);
                } catch (err) {
                  ctx?.logger?.warn?.(`[plugin-notify] settings replace failed: ${String(err)}`);
                }
              },
            };
            getConfig = () => scope.get() ?? config ?? {};
        });
        ctx.inject(['webServer'], (wctx) => tryMountWebServer(wctx))
    }
    if (ctx.webServer) {
        tryMountWebServer(ctx);
    }

    const dispatch = (n) => {
        const cfg = unwrapConfig(getConfig());
        const dnd = cfg.dnd;
        if (inDnd(dnd)) {
            (ctx?.logger?.debug ?? ctx?.logger?.info)?.(`[plugin-notify] ${n.kind} · ${n.title} · session ${n.sessionId} · DND (${dnd?.start}-${dnd?.end}), logged only`);
            return;
        }
        const timeoutMs = cfg.timeoutMs ?? 5000;
        const local = cfg.local ?? true;
        const includeSession = cfg.includeSession ?? true;
        const includeDuration = cfg.includeDuration ?? true;

        // Broadcast to connected web/desktop clients via SSE
        broadcastSse({
            kind: n.kind,
            title: n.title,
            sessionId: n.sessionId,
            summary: n.summary,
            reason: n.reason,
            durationMs: n.durationMs,
            timestamp: Date.now(),
        });

        // Resolve credential refs then fire-and-forget posts; never block the agent loop.
        Promise.resolve()
            .then(() => resolveWebhooks(ctx, cfg.webhooks ?? {}))
            .then((urls) => send(ctx, n, urls, timeoutMs, local, includeSession, includeDuration))
            .catch((error) => {
                ctx?.logger?.warn?.(`[plugin-notify] webhook resolve/send failed: ${String(error)}`);
            });

        // Web Push (PWA) channel: reaches devices with every dsh tab closed.
        const wp = cfg.webPush;
        if (wp && wp.enabled) {
            const away = sseClients.size === 0;
            if (away || wp.onlyWhenAway === false) {
                deliverWebPush(ctx, n, cfg).catch((error) => {
                    ctx?.logger?.warn?.(`[plugin-notify] web push dispatch failed: ${String(error)}`);
                });
            } else {
                (ctx?.logger?.debug ?? ctx?.logger?.info)?.(`[plugin-notify] ${n.kind} · session ${n.sessionId} · web push skipped (clients connected)`);
            }
        }
    };

    ctx.on('session/event', (session, event) => {
        const cfg = getConfig();
        const events = new Set(normalizeEvents(cfg.events));
        const excludeSessionPrefixes = cfg.excludeSessionPrefixes ?? [];

        if (event.type === 'turn/start') {
            if (turnStarts.size > 100) {
                cleanupTurnStarts();
            }
            turnStarts.set(String(session.id), Date.now());
            return;
        }
        if (event.type === 'turn/end') {
            if (isExcludedSession(session.id, excludeSessionPrefixes))
                return;
            const reason = event.data.reason;
            const kind = reason.kind === 'completed' ? 'task_done' : 'error';
            if (!events.has(kind))
                return;
            const started = turnStarts.get(String(session.id));
            turnStarts.delete(String(session.id));
            dispatch({
                kind,
                title: sessionTitle(session),
                sessionId: String(session.id),
                summary: summarizeTurn(session, event.data.turn),
                reason: reasonLabel(reason),
                durationMs: started === undefined ? undefined : Date.now() - started,
            });
            return;
        }
        if (event.type === 'approval/asked') {
            if (isExcludedSession(session.id, excludeSessionPrefixes))
                return;
            if (!events.has('approval_requested'))
                return;
            const data = event.data;
            dispatch({
                kind: 'approval_requested',
                title: sessionTitle(session),
                sessionId: String(session.id),
                summary: `Waiting for approval: tool ${data.toolName}${data.reason ? ` (${data.reason})` : ''}`,
            });
        }
    });
}

function normalizeEvents(configured) {
    if (!configured || configured.length === 0)
        return [...DEFAULT_EVENTS];
    const known = ['task_done', 'error', 'approval_requested'];
    return known.filter(kind => configured.includes(kind));
}

function send(ctx, n, webhooks, timeoutMs, local, includeSession, includeDuration) {
    const text = renderText(n, includeSession, includeDuration);
    const signal = AbortSignal.timeout(timeoutMs);
    const channels = Object.keys(webhooks);
    (ctx?.logger?.debug ?? ctx?.logger?.info)?.(`[plugin-notify] ${n.kind} · ${n.title} · session ${n.sessionId} · channels ${channels.join(',') || 'none'} · local ${local}`);
    const post = (url, body) => {
        fetch(url, {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify(body),
            signal,
        }).catch(error => {
            ctx?.logger?.warn?.(`[plugin-notify] webhook POST failed (${String(url).slice(0, 64)}…): ${String(error)}`);
        });
    };
    if (webhooks.feishu)
        post(webhooks.feishu, { msg_type: 'text', content: { text } });
    if (webhooks.wecom)
        post(webhooks.wecom, { msgtype: 'text', text: { content: text } });
    if (webhooks.dingtalk)
        post(webhooks.dingtalk, { msgtype: 'text', text: { content: text } });
    if (webhooks.slack)
        post(webhooks.slack, { text });
    if (webhooks.discord)
        post(webhooks.discord, { content: text });
    if (webhooks.custom) {
        post(webhooks.custom, {
            text,
            kind: n.kind,
            title: n.title,
            sessionId: n.sessionId,
            durationMs: n.durationMs,
            time: new Date().toISOString(),
        });
    }
    if (local)
        notifyLocal(n.kind === 'task_done' ? '✅ Task done' : n.kind === 'error' ? '⚠️ Error' : '⏸️ Approval needed', text);
}

function renderText(n, includeSession, includeDuration) {
    const kindLabel = n.kind === 'task_done' ? 'Task done' : n.kind === 'error' ? 'Error' : 'Approval needed';
    const lines = [`【${kindLabel}】${n.title}`];
    if (n.summary)
        lines.push(`Summary: ${n.summary}`);
    if (n.reason)
        lines.push(`Reason: ${n.reason}`);
    if (includeDuration && n.durationMs !== undefined)
        lines.push(`Duration: ${formatDuration(n.durationMs)}`);
    if (includeSession)
        lines.push(`Session: ${n.sessionId}`);
    return lines.join('\n');
}

function parseHM(v) {
    if (!v)
        return null;
    const m = /^(\d{1,2}):(\d{2})$/.exec(v.trim());
    if (!m)
        return null;
    const h = Number(m[1]);
    const mi = Number(m[2]);
    if (h > 23 || mi > 59)
        return null;
    return h * 60 + mi;
}

function inDnd(dnd, now = new Date()) {
    const s = parseHM(dnd?.start);
    const e = parseHM(dnd?.end);
    if (s === null || e === null || s === e)
        return false;
    const cur = now.getHours() * 60 + now.getMinutes();
    return s < e ? cur >= s && cur < e : cur >= s || cur < e;
}

function formatDuration(ms) {
    const seconds = Math.round(ms / 1000);
    if (seconds < 60)
        return `${seconds}s`;
    const minutes = Math.floor(seconds / 60);
    const rest = seconds % 60;
    return rest === 0 ? `${minutes}m` : `${minutes}m ${rest}s`;
}

function reasonLabel(reason) {
    switch (reason.kind) {
        case 'completed': return 'completed';
        case 'error': return 'error';
        case 'aborted': return 'aborted';
        case 'blocked': return 'blocked';
        case 'max-tokens': return 'max-tokens';
        case 'interrupted': return 'interrupted';
        default: return reason.kind;
    }
}

export function textOf(content) {
    if (typeof content === 'string') return content;
    if (!Array.isArray(content)) return '';
    let out = '';
    for (const block of content) {
        if (typeof block === 'string') {
            out += block;
        } else if (typeof block === 'object' && block !== null && block.type === 'text') {
            const text = block.text;
            if (typeof text === 'string')
                out += text;
        }
    }
    return out;
}

export function sessionTitle(session) {
    const events = Array.isArray(session?.events) ? session.events : [];
    for (const event of events) {
        if (event && event.type === 'user/message') {
            const text = textOf(event.data?.content).replace(/\s+/g, ' ').trim();
            if (text)
                return text.length > 60 ? `${text.slice(0, 60)}…` : text;
        }
    }
    return String(session?.id ?? 'session');
}

export function summarizeTurn(session, turn) {
    const events = Array.isArray(session?.events) ? session.events : [];
    let toolCalls = 0;
    let lastText = '';
    // Reverse iteration: events for current turn are at the end of the events array
    for (let i = events.length - 1; i >= 0; i--) {
        const event = events[i];
        if (!event || !event.data) continue;
        if (event.data.turn !== turn) {
            if (typeof event.data.turn === 'number' && event.data.turn < turn) {
                break;
            }
            continue;
        }
        if (event.type === 'tool/call') {
            toolCalls += 1;
        }
        if (event.type === 'assistant/message' && !lastText) {
            const text = textOf(event.data.message?.content);
            if (text) {
                lastText = text;
            }
        }
    }
    const parts = [];
    if (lastText) {
        const trimmed = lastText.replace(/\s+/g, ' ').trim();
        parts.push(trimmed.length > 120 ? `${trimmed.slice(0, 120)}…` : trimmed);
    }
    if (toolCalls > 0)
        parts.push(`called ${toolCalls} tools`);
    return parts.join('; ') || '(no text output)';
}

function notifyLocal(title, text) {
    if (process.platform !== 'darwin')
        return;
    const esc = (s) => s.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
    const script = `display notification "${esc(text)}" with title "${esc(title)}"`;
    spawn('osascript', ['-e', script], { stdio: 'ignore' })
        .on('error', () => { })
        .unref();
}
