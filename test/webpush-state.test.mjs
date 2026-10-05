import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import {
  generateVapidKeys,
  resolveStatePath,
  loadState,
  saveState,
  getVapidKeys,
  addSubscription,
  removeSubscription,
  listSubscriptions,
  VAPID_PUBLIC_ENV,
  VAPID_PRIVATE_ENV,
} from '../lib/index.js'

function tempDir(t) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'pn-webpush-'))
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }))
  return dir
}

const BASE64URL = /^[A-Za-z0-9_-]+$/

test('generateVapidKeys returns base64url P-256 keys', () => {
  const keys = generateVapidKeys()
  assert.match(keys.publicKey, BASE64URL)
  assert.match(keys.privateKey, BASE64URL)
  // Raw uncompressed point (65 bytes → 87 base64url chars) and raw scalar
  // (32 bytes → 43 chars) — the shapes web-push and applicationServerKey expect.
  assert.equal(keys.publicKey.length, 87)
  assert.equal(keys.privateKey.length, 43)
  // Two calls never collide.
  const again = generateVapidKeys()
  assert.notEqual(again.publicKey, keys.publicKey)
})

test('resolveStatePath: explicit stateFile wins, then DSH_HOME, then ~/.dsh', (t) => {
  const prevHome = process.env.DSH_HOME
  t.after(() => {
    if (prevHome === undefined) delete process.env.DSH_HOME
    else process.env.DSH_HOME = prevHome
  })

  assert.equal(resolveStatePath({ stateFile: ' /tmp/x/state.json ' }), '/tmp/x/state.json')

  process.env.DSH_HOME = '/tmp/dsh-home'
  assert.equal(resolveStatePath({}), path.join('/tmp/dsh-home', 'plugin-notify-state.json'))
  assert.equal(resolveStatePath(), path.join('/tmp/dsh-home', 'plugin-notify-state.json'))

  delete process.env.DSH_HOME
  assert.equal(resolveStatePath({}), path.join(os.homedir(), '.dsh', 'plugin-notify-state.json'))
})

test('loadState tolerates missing and corrupted files', async (t) => {
  const dir = tempDir(t)
  const missing = await loadState(path.join(dir, 'nope.json'))
  assert.deepEqual(missing, { vapid: null, subscriptions: [] })

  const corrupted = path.join(dir, 'bad.json')
  fs.writeFileSync(corrupted, '{ not json', 'utf8')
  assert.deepEqual(await loadState(corrupted), { vapid: null, subscriptions: [] })
})

test('saveState round-trips and leaves no temp files behind', async (t) => {
  const dir = tempDir(t)
  const file = path.join(dir, 'state.json')
  await saveState(file, { vapid: { publicKey: 'pub', privateKey: 'priv' }, subscriptions: [] })
  const loaded = await loadState(file)
  assert.equal(loaded.vapid.publicKey, 'pub')
  const leftovers = fs.readdirSync(dir).filter((f) => f.includes('.tmp'))
  assert.deepEqual(leftovers, [])
})

test('getVapidKeys generates once, persists, then reuses', async (t) => {
  const dir = tempDir(t)
  const file = path.join(dir, 'state.json')
  const ctx = { logger: { info() {}, warn() {} } }

  const first = await getVapidKeys(ctx, { stateFile: file })
  assert.ok(first.publicKey && first.privateKey)
  const savedAt = fs.statSync(file).mtimeMs

  const second = await getVapidKeys(ctx, { stateFile: file })
  assert.equal(second.publicKey, first.publicKey)
  assert.equal(second.privateKey, first.privateKey)
  // No regeneration rewrite on the second call.
  assert.equal(fs.statSync(file).mtimeMs, savedAt)
})

test('getVapidKeys env override wins over the state file', async (t) => {
  const dir = tempDir(t)
  const file = path.join(dir, 'state.json')
  const prev = { pub: process.env[VAPID_PUBLIC_ENV], priv: process.env[VAPID_PRIVATE_ENV] }
  process.env[VAPID_PUBLIC_ENV] = 'env-public-key'
  process.env[VAPID_PRIVATE_ENV] = 'env-private-key'
  t.after(() => {
    if (prev.pub === undefined) delete process.env[VAPID_PUBLIC_ENV]
    else process.env[VAPID_PUBLIC_ENV] = prev.pub
    if (prev.priv === undefined) delete process.env[VAPID_PRIVATE_ENV]
    else process.env[VAPID_PRIVATE_ENV] = prev.priv
  })

  const keys = await getVapidKeys(null, { stateFile: file })
  assert.equal(keys.publicKey, 'env-public-key')
  assert.equal(keys.privateKey, 'env-private-key')
  // Env mode must not create the state file.
  assert.equal(fs.existsSync(file), false)
})

function validSub(endpoint = 'https://push.example/abc') {
  return { endpoint, keys: { p256dh: 'p256dh-key', auth: 'auth-key' } }
}

test('addSubscription validates and dedupes by endpoint', async (t) => {
  const dir = tempDir(t)
  const file = path.join(dir, 'state.json')

  await assert.rejects(() => addSubscription(file, { endpoint: 'http://insecure/abc', keys: { p256dh: 'a', auth: 'b' } }))
  await assert.rejects(() => addSubscription(file, { endpoint: 'https://push.example/abc', keys: {} }))

  assert.equal(await addSubscription(file, validSub()), 1)
  assert.equal(await addSubscription(file, validSub()), 1)
  assert.equal(await addSubscription(file, validSub('https://push.example/second')), 2)

  const subs = await listSubscriptions(file)
  assert.equal(subs.length, 2)
  assert.equal(subs[0].endpoint, 'https://push.example/abc')
})

test('removeSubscription removes and reports', async (t) => {
  const dir = tempDir(t)
  const file = path.join(dir, 'state.json')
  await addSubscription(file, validSub())

  assert.equal(await removeSubscription(file, 'https://push.example/abc'), 1)
  assert.equal(await removeSubscription(file, 'https://push.example/abc'), 0)
  assert.deepEqual(await listSubscriptions(file), [])
})

test('concurrent saveState calls serialize into a valid file', async (t) => {
  const dir = tempDir(t)
  const file = path.join(dir, 'state.json')
  await Promise.all(
    Array.from({ length: 12 }, (_, i) => saveState(file, { vapid: null, subscriptions: [{ endpoint: `https://push.example/${i}`, keys: { p256dh: 'x', auth: 'y' }, addedAt: i }] })),
  )
  const subs = await listSubscriptions(file)
  assert.equal(subs.length, 1)
})
