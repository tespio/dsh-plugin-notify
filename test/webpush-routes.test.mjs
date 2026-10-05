import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import {
  SW_SOURCE,
  handleServiceWorker,
  handlePushKey,
  handlePushSubscribe,
  handlePushUnsubscribe,
  handlePushTest,
  addSubscription,
  listSubscriptions,
  getVapidKeys,
  setWebPushLibrary,
} from '../lib/index.js'

function tempDir(t) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'pn-routes-'))
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }))
  return dir
}

function fakeReq(method = 'GET', { remoteAddress = '127.0.0.1', rawBody = null } = {}) {
  const listeners = {}
  const req = {
    method,
    headers: {},
    url: '/',
    socket: { remoteAddress },
    on(ev, fn) {
      listeners[ev] = listeners[ev] || []
      listeners[ev].push(fn)
      return req
    },
    emitNow(ev, arg) {
      for (const fn of listeners[ev] || []) fn(arg)
    },
  }
  if (rawBody !== null) {
    // Deliver the body on the next tick, after the handler attached its listeners.
    queueMicrotask(() => {
      req.emitNow('data', Buffer.from(rawBody, 'utf8'))
      req.emitNow('end')
    })
  }
  return req
}

function fakeRes() {
  return {
    statusCode: 0,
    headers: null,
    body: '',
    writeHead(status, hdrs) {
      this.statusCode = status
      this.headers = hdrs || {}
    },
    write(chunk) {
      this.body += String(chunk)
    },
    end(chunk) {
      if (chunk) this.body += String(chunk)
    },
  }
}

function enabledConfig(dir) {
  return { webPush: { enabled: true, onlyWhenAway: true, stateFile: path.join(dir, 'state.json') }, timeoutMs: 1000 }
}

test('sw.js is served unauthenticated with scope and cache headers', () => {
  const req = fakeReq('GET')
  const res = fakeRes()
  handleServiceWorker(req, res)
  assert.equal(res.statusCode, 200)
  assert.equal(res.headers['Content-Type'], 'text/javascript; charset=utf-8')
  assert.equal(res.headers['Service-Worker-Allowed'], '/')
  assert.equal(res.headers['Cache-Control'], 'no-store')
  assert.ok(res.body.includes('notificationclick'))
  assert.equal(res.body, SW_SOURCE)
})

test('sw.js rejects non-GET with 405', () => {
  const res = fakeRes()
  handleServiceWorker(fakeReq('POST'), res)
  assert.equal(res.statusCode, 405)
})

test('push routes refuse non-loopback peers when no connection service exists', async (t) => {
  const dir = tempDir(t)
  const ctx = { logger: { info() {}, warn() {} } }
  const cfg = enabledConfig(dir)
  const cases = [
    ['key', (res) => handlePushKey(fakeReq('GET', { remoteAddress: '203.0.113.5' }), res, ctx, () => cfg)],
    ['subscribe', (res) => handlePushSubscribe(fakeReq('POST', { remoteAddress: '203.0.113.5' }), res, ctx, () => cfg)],
    ['unsubscribe', (res) => handlePushUnsubscribe(fakeReq('POST', { remoteAddress: '203.0.113.5' }), res, ctx, () => cfg)],
    ['test', (res) => handlePushTest(fakeReq('POST', { remoteAddress: '203.0.113.5' }), res, ctx, () => cfg)],
  ]
  for (const [name, run] of cases) {
    const res = fakeRes()
    await run(res)
    assert.equal(res.statusCode, 403, `${name} should 403 for non-loopback`)
  }
})

test('push routes honor connection.requestRejection like the SSE stream', async (t) => {
  const dir = tempDir(t)
  const rejecting = { connection: { requestRejection: () => 401 } }
  const cfg = enabledConfig(dir)
  const req = fakeReq('GET')
  const res = fakeRes()
  await handlePushKey(req, res, rejecting, () => cfg)
  assert.equal(res.statusCode, 401)
  assert.equal(res.body, 'Unauthorized')

  const admitting = { connection: { requestRejection: () => undefined } }
  const res2 = fakeRes()
  await handlePushKey(fakeReq('GET'), res2, admitting, () => cfg)
  assert.equal(res2.statusCode, 200)
})

test('push/key: 404 while disabled, key material while enabled', async (t) => {
  const dir = tempDir(t)
  const ctx = { logger: { info() {}, warn() {} } }
  const res = fakeRes()
  await handlePushKey(fakeReq('GET'), res, ctx, () => ({ webPush: { enabled: false } }))
  assert.equal(res.statusCode, 404)

  const res2 = fakeRes()
  await handlePushKey(fakeReq('GET'), res2, ctx, () => enabledConfig(dir))
  assert.equal(res2.statusCode, 200)
  const body = JSON.parse(res2.body)
  const keys = await getVapidKeys(ctx, { stateFile: path.join(dir, 'state.json') })
  assert.equal(body.publicKey, keys.publicKey)
  assert.ok(body.subject)
})

test('push/subscribe: persists valid subscriptions, rejects invalid bodies', async (t) => {
  const dir = tempDir(t)
  const ctx = { logger: { info() {}, warn() {} } }
  const cfg = enabledConfig(dir)
  const stateFile = path.join(dir, 'state.json')

  const res = fakeRes()
  await handlePushSubscribe(fakeReq('POST', { rawBody: JSON.stringify({ endpoint: 'https://push.example/a', keys: { p256dh: 'p', auth: 'a' } }) }), res, ctx, () => cfg)
  assert.equal(res.statusCode, 200)
  assert.deepEqual(JSON.parse(res.body), { ok: true, count: 1 })

  // Same endpoint again → dedupe, count stays 1.
  const res2 = fakeRes()
  await handlePushSubscribe(fakeReq('POST', { rawBody: JSON.stringify({ endpoint: 'https://push.example/a', keys: { p256dh: 'p2', auth: 'a2' } }) }), res2, ctx, () => cfg)
  assert.equal(JSON.parse(res2.body).count, 1)
  const subs = await listSubscriptions(stateFile)
  assert.equal(subs[0].keys.p256dh, 'p2')

  // Invalid subscription → 400.
  const res3 = fakeRes()
  await handlePushSubscribe(fakeReq('POST', { rawBody: JSON.stringify({ endpoint: 'http://insecure/a', keys: { p256dh: 'p', auth: 'a' } }) }), res3, ctx, () => cfg)
  assert.equal(res3.statusCode, 400)

  // Non-JSON body → 400.
  const res4 = fakeRes()
  await handlePushSubscribe(fakeReq('POST', { rawBody: 'not json' }), res4, ctx, () => cfg)
  assert.equal(res4.statusCode, 400)

  // Disabled → 404.
  const res5 = fakeRes()
  await handlePushSubscribe(fakeReq('POST', { rawBody: '{}' }), res5, ctx, () => ({ webPush: { enabled: false } }))
  assert.equal(res5.statusCode, 404)
})

test('push/unsubscribe: removes by endpoint', async (t) => {
  const dir = tempDir(t)
  const ctx = { logger: { info() {}, warn() {} } }
  const cfg = enabledConfig(dir)
  const stateFile = path.join(dir, 'state.json')
  await addSubscription(stateFile, { endpoint: 'https://push.example/a', keys: { p256dh: 'p', auth: 'a' } })

  const missing = fakeRes()
  await handlePushUnsubscribe(fakeReq('POST', { rawBody: '{}' }), missing, ctx, () => cfg)
  assert.equal(missing.statusCode, 400)

  const res = fakeRes()
  await handlePushUnsubscribe(fakeReq('POST', { rawBody: JSON.stringify({ endpoint: 'https://push.example/a' }) }), res, ctx, () => cfg)
  assert.equal(res.statusCode, 200)
  assert.deepEqual(JSON.parse(res.body), { ok: true, removed: 1 })
  assert.deepEqual(await listSubscriptions(stateFile), [])
})

test('push/test: sends to stored subscriptions via the injected library', async (t) => {
  const dir = tempDir(t)
  const ctx = { logger: { info() {}, warn() {} } }
  const cfg = enabledConfig(dir)
  const stateFile = path.join(dir, 'state.json')
  await addSubscription(stateFile, { endpoint: 'https://push.example/a', keys: { p256dh: 'p', auth: 'a' } })

  const sends = []
  setWebPushLibrary({ sendNotification: async (sub, payload, opts) => { sends.push({ sub, payload, opts }) } })
  t.after(() => setWebPushLibrary(null))

  const res = fakeRes()
  await handlePushTest(fakeReq('POST'), res, ctx, () => cfg)
  assert.equal(res.statusCode, 200)
  assert.deepEqual(JSON.parse(res.body), { ok: true, sent: 1 })
  assert.equal(sends.length, 1)
  const payload = JSON.parse(sends[0].payload)
  assert.equal(payload.kind, 'task_done')
  assert.ok(sends[0].opts.vapid.publicKey)
})

test('push routes answer 405 on wrong methods', async (t) => {
  const dir = tempDir(t)
  const ctx = { logger: { info() {}, warn() {} } }
  const cfg = enabledConfig(dir)
  const res = fakeRes()
  await handlePushKey(fakeReq('POST'), res, ctx, () => cfg)
  assert.equal(res.statusCode, 405)
  const res2 = fakeRes()
  await handlePushSubscribe(fakeReq('GET'), res2, ctx, () => cfg)
  assert.equal(res2.statusCode, 405)
})
