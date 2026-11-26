// dsh-tools — Host route smoke test (no live DSH needed).
// Drives apply() with a stub ctx, then exercises the registered webServer
// route handler: envelope validation, admission (loopback + same-origin),
// method dispatch, and the restart safety chain (this process's parent is a
// shell, not the desktop app, so restart must refuse with parent-mismatch).
// Settings persistence goes to a throwaway DSH_TOOLS_HOME (set before import —
// the module caches settings and resolves the directory at call time).
import { mkdtempSync, rmSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
process.env.DSH_TOOLS_HOME = mkdtempSync(join(tmpdir(), 'dsh-tools-smoke-'));
import { apply } from '../index.js';

const results = [];
const check = (name, ok, detail = '') => {
  results.push({ name, ok });
  console.log(`${ok ? 'PASS' : 'FAIL'} ${name}${detail ? ` — ${detail}` : ''}`);
};

let route = null;
let fetchRoute = null;
const fibers = [];
const ctx = {
  logger: { info: () => {}, warn: () => {}, error: () => {} },
  // Runtime child fibers for optional services (llm / agentDefaultModel).
  inject(names, cb) {
    const fiber = { names, cb, disposed: false, dispose() { this.disposed = true; } };
    fibers.push(fiber);
    return fiber;
  },
  // Static-inject shape: apply() reads ctx.webServer / ctx.connection directly.
  webServer: {
    register(def) { route = def; return () => { route = null; }; },
  },
  connection: {
    fetch: {
      register(def) { fetchRoute = def; return () => { fetchRoute = null; }; },
    },
  },
};

const cleanup = apply(ctx);
check('apply registers both legs (webServer exact + connection.fetch) and returns a cleanup function',
  typeof cleanup === 'function' && route?.kind === 'exact' && route?.path === '/api/dsh-tools'
  && fetchRoute?.path === '/api/dsh-tools' && fetchRoute?.methods?.includes('POST'));

function nodeRequest({ method = 'POST', headers = {}, body = '' } = {}) {
  return {
    method,
    headers,
    async *[Symbol.asyncIterator]() { if (body !== '') yield Buffer.from(body, 'utf8'); },
  };
}
function nodeResponse() {
  let resolveFinished;
  const finished = new Promise((resolve) => { resolveFinished = resolve; });
  const res = {
    status: 0,
    payload: null,
    writeHead(status, headers) { this.status = status; this.headers = headers; },
    end(payload) { this.payload = payload; resolveFinished(this); },
  };
  return { res, finished };
}
const post = async (opts) => {
  const { res, finished } = nodeResponse();
  route.handler(nodeRequest(opts), res);
  return await finished;
};

let rpcSeq = 0;
const envelope = (method, payload) => JSON.stringify({
  type: 'client-request', rpcId: `r${++rpcSeq}`, method: 'dsh-tools',
  payload: { method, payload },
});
const baseHeaders = { host: '127.0.0.1:14489', 'content-type': 'application/json' };

// --- replica of the REAL client validator (dsh-client-connection
// lib/types/client/rpc.js parseConnectionResponse). Every 200 response must
// pass it — this is the guard against "connection: invalid server-response
// failure"-class envelope bugs (missing error.details bit us in v0.2.0).
function parseConnectionResponse(value) {
  const rec = (v) => typeof v === 'object' && v !== null && !Array.isArray(v);
  if (!rec(value) || value.type !== 'server-response' || typeof value.rpcId !== 'string') throw new TypeError('connection: invalid server-response envelope');
  const result = value.result;
  if (!rec(result)) throw new TypeError('connection: invalid server-response result');
  if (result.ok === true) return result;
  if (result.ok !== false || !rec(result.error)) throw new TypeError('connection: invalid server-response result');
  const { error } = result;
  if (typeof error.code !== 'string' || typeof error.message !== 'string' || !rec(error.details)) throw new TypeError('connection: invalid server-response failure');
  return result;
}
let envelopeGuardFailed = false;
const envelopeGuard = (payload) => {
  try { parseConnectionResponse(JSON.parse(payload)); return true; } catch (error) {
    envelopeGuardFailed = true;
    check('200 body passes the real client envelope validator', false, error.message);
    return false;
  }
};

// --- admission ---
let res = await post({ headers: { ...baseHeaders, origin: 'http://evil.example.com' }, body: envelope('restart.plan', {}) });
check('non-loopback origin → 403', res.status === 403);
res = await post({ headers: { ...baseHeaders, host: '10.0.0.5:14489' }, body: envelope('restart.plan', {}) });
check('non-loopback host → 403', res.status === 403);
res = await post({ headers: { ...baseHeaders, 'sec-fetch-site': 'cross-site' }, body: envelope('restart.plan', {}) });
check('cross-site browser request → 403', res.status === 403);
res = await post({ method: 'GET', headers: baseHeaders });
check('GET → 405', res.status === 405);
res = await post({ headers: { ...baseHeaders, 'content-type': 'text/plain' }, body: 'x' });
check('wrong content-type → 415', res.status === 415);
res = await post({ headers: baseHeaders, body: 'not json' });
check('non-JSON body → 400', res.status === 400);

// --- envelope validation ---
res = await post({ headers: baseHeaders, body: JSON.stringify({ type: 'nonsense' }) });
let message = JSON.parse(res.payload);
check('bad envelope → ok:false bad-request',
  envelopeGuard(res.payload) && res.status === 200
  && message.result?.ok === false && message.result?.error?.code === 'bad-request'
  && typeof message.result?.error?.details === 'object');
res = await post({ headers: baseHeaders, body: envelope('no.such.method', {}) });
message = JSON.parse(res.payload);
check('unknown method → ok:false bad-request',
  envelopeGuard(res.payload)
  && message.result?.ok === false && message.result?.error?.code === 'bad-request');

// --- restart.plan: desktop facts pass through (no side effects) ---
res = await post({ headers: baseHeaders, body: envelope('restart.plan', {}) });
message = JSON.parse(res.payload);
const plan = message.result?.value;
check('restart.plan ok with facts',
  envelopeGuard(res.payload) && message.result?.ok === true
  && typeof plan?.desktop === 'boolean' && Number.isInteger(plan?.hostPid),
  `desktop=${plan?.desktop} appExe=${plan?.appExe ?? '(none)'}`);

// --- restart must refuse here: this smoke process's parent is a shell ---
res = await post({ headers: baseHeaders, body: envelope('restart', { dryRun: true }) });
message = JSON.parse(res.payload);
check('restart in non-desktop parent → refused (parent-mismatch or not-desktop, with diag details)',
  envelopeGuard(res.payload) && message.result?.ok === false
  && ['parent-mismatch', 'not-desktop'].includes(message.result?.error?.code)
  && message.result?.error?.details?.appPid !== undefined,
  `code=${message.result?.error?.code} parent=${message.result?.error?.details?.parentPath ?? '(none)'}`);

// --- suggest: before any llm service is captured ---
res = await post({ headers: baseHeaders, body: envelope('suggest', { lastReply: 'AI reply text', lang: 'zh' }) });
message = JSON.parse(res.payload);
check('suggest without llm service → ok:false llm-unavailable',
  envelopeGuard(res.payload) && message.result?.ok === false
  && message.result?.error?.code === 'llm-unavailable');
res = await post({ headers: baseHeaders, body: envelope('suggest', { lastReply: '   ', lang: 'zh' }) });
message = JSON.parse(res.payload);
check('suggest with blank context → ok:false empty-context',
  envelopeGuard(res.payload) && message.result?.ok === false
  && message.result?.error?.code === 'empty-context');

// --- suggest: capture fake llm + agentDefaultModel through the child fibers ---
const seenPrepareCalls = [];
const fakeLlm = {
  prepareCall: async (config) => {
    seenPrepareCalls.push(config);
    return {
      config: { provider: config.provider, model: config.model },
      stream: async function* fakeStream() {
        yield { type: 'reasoning-delta', index: 0, text: '(inner monologue must be ignored)' };
        yield { type: 'text-delta', index: 1, text: '「好的，' };
        yield { type: 'text-delta', index: 1, text: '就按方案A继续。」' };
      },
    };
  },
};
const llmFiber = fibers.find((f) => f.names.includes('llm'));
const selectorFiber = fibers.find((f) => f.names.includes('agentDefaultModel'));
await llmFiber.cb({ llm: fakeLlm });
await selectorFiber.cb({ agentDefaultModel: { currentSelection: () => ({ provider: 'deepseek', model: 'test-model' }) } });
res = await post({ headers: baseHeaders, body: envelope('suggest', { lastReply: 'AI reply text', lang: 'zh' }) });
message = JSON.parse(res.payload);
check('suggest with llm → ok, draft accumulates text-delta only, quotes stripped, route from selection',
  envelopeGuard(res.payload) && message.result?.ok === true
  && message.result?.value?.draft === '好的，就按方案A继续。'
  && seenPrepareCalls.at(-1)?.provider === 'deepseek'
  && seenPrepareCalls.at(-1)?.model === 'test-model',
  `draft=${JSON.stringify(message.result?.value?.draft)}`);

// --- settings: get defaults, set flags + model override, roundtrip on disk ---
res = await post({ headers: baseHeaders, body: envelope('settings.get', {}) });
message = JSON.parse(res.payload);
check('settings.get → defaults with all features on (incl. openSidebar)',
  envelopeGuard(res.payload) && message.result?.ok === true
  && message.result?.value?.settings?.features?.moreMenu === true
  && message.result?.value?.settings?.features?.openSidebar === true
  && message.result?.value?.settings?.model?.provider === '');
res = await post({ headers: baseHeaders, body: envelope('settings.set', { features: { generate: false, history: false, openSidebar: false }, model: { provider: 'fast', model: 'm-mini' } }) });
message = JSON.parse(res.payload);
check('settings.set accepts flags + full model override',
  envelopeGuard(res.payload) && message.result?.ok === true
  && message.result?.value?.settings?.features?.generate === false
  && message.result?.value?.settings?.features?.history === false
  && message.result?.value?.settings?.features?.openSidebar === false
  && message.result?.value?.settings?.features?.moreMenu === true
  && message.result?.value?.settings?.model?.provider === 'fast');
res = await post({ headers: baseHeaders, body: envelope('settings.set', { model: { provider: 'fast', model: '' } }) });
message = JSON.parse(res.payload);
check('settings.set rejects half model override (provider without model)',
  envelopeGuard(res.payload) && message.result?.ok === false
  && message.result?.error?.code === 'bad-request');
let settingsOnDisk = null;
try { settingsOnDisk = JSON.parse(readFileSync(join(process.env.DSH_TOOLS_HOME, 'settings.json'), 'utf8')); } catch { /* fail below */ }
check('settings persisted to DSH_TOOLS_HOME/settings.json',
  settingsOnDisk?.features?.generate === false && settingsOnDisk?.features?.openSidebar === false
  && settingsOnDisk?.model?.model === 'm-mini');

// --- quick phrases: normalize, persist, roundtrip ---
res = await post({ headers: baseHeaders, body: envelope('settings.set', {
  phrases: ['  使用 skill 优化  ', '', '使用 skill 优化', 42, 'x'.repeat(300), 'keep me', 'sixth', 'seventh'],
}) });
message = JSON.parse(res.payload);
check('settings.set normalizes phrases (trim/dedupe/cap200/cap5)',
  envelopeGuard(res.payload) && message.result?.ok === true
  && JSON.stringify(message.result?.value?.settings?.phrases) === JSON.stringify(['使用 skill 优化', 'x'.repeat(200), 'keep me', 'sixth', 'seventh']),
  `phrases=${JSON.stringify(message.result?.value?.settings?.phrases)}`);
let phrasesOnDisk = null;
try { phrasesOnDisk = JSON.parse(readFileSync(join(process.env.DSH_TOOLS_HOME, 'settings.json'), 'utf8')).phrases; } catch { /* fail below */ }
check('phrases persisted to disk',
  Array.isArray(phrasesOnDisk) && phrasesOnDisk.length === 5 && phrasesOnDisk[0] === '使用 skill 优化');
res = await post({ headers: baseHeaders, body: envelope('settings.get', {}) });
message = JSON.parse(res.payload);
check('settings.get returns phrases',
  envelopeGuard(res.payload) && message.result?.ok === true
  && message.result?.value?.settings?.phrases?.[0] === '使用 skill 优化');

// --- optimize: honors the settings model override, rewrites the prompt ---
fakeLlm.prepareCall = async (config) => {
  seenPrepareCalls.push(config);
  return {
    config: { provider: config.provider, model: config.model },
    stream: async function* optStream() {
      yield { type: 'text-delta', index: 0, text: '目标：修复登录超时。\n约束：仅改前端。' };
    },
  };
};
res = await post({ headers: baseHeaders, body: envelope('optimize', { prompt: '帮我修下登录老是超时', lang: 'zh' }) });
message = JSON.parse(res.payload);
check('optimize → ok and prepareCall uses the override model',
  envelopeGuard(res.payload) && message.result?.ok === true
  && message.result?.value?.draft === '目标：修复登录超时。\n约束：仅改前端。'
  && seenPrepareCalls.at(-1)?.provider === 'fast'
  && seenPrepareCalls.at(-1)?.model === 'm-mini',
  `draft=${JSON.stringify(message.result?.value?.draft)}`);
res = await post({ headers: baseHeaders, body: envelope('optimize', { prompt: '   ', lang: 'zh' }) });
message = JSON.parse(res.payload);
check('optimize with blank prompt → ok:false empty-context',
  envelopeGuard(res.payload) && message.result?.ok === false
  && message.result?.error?.code === 'empty-context');

// --- models.list: providers + models via the captured llm service ---
fakeLlm.listProviders = async () => [
  { id: 'deepseek', label: 'DeepSeek' },
  { id: 'fast-one' },
];
fakeLlm.listModels = async (provider) => (provider === 'deepseek'
  ? [{ id: 'deepseek-chat' }, { id: 'deepseek-reasoner', label: 'Reasoner' }]
  : [{ model: 'mini-fast' }]);
res = await post({ headers: baseHeaders, body: envelope('models.list', {}) });
message = JSON.parse(res.payload);
const catalog = message.result?.value;
check('models.list → providers with normalized models + default selection',
  envelopeGuard(res.payload) && message.result?.ok === true
  && catalog?.providers?.length === 2
  && catalog?.providers?.[0]?.models?.[0]?.id === 'deepseek-chat'
  && catalog?.providers?.[0]?.models?.[1]?.label === 'Reasoner'
  && catalog?.providers?.[1]?.models?.[0]?.id === 'mini-fast'
  && catalog?.defaultSelection?.provider === 'deepseek'
  && catalog?.override?.provider === 'fast');

// --- dev.ping / dev.reconcile: hot-reload support surface ---
res = await post({ headers: baseHeaders, body: envelope('dev.ping', {}) });
message = JSON.parse(res.payload);
check('dev.ping → ok with version and pid',
  envelopeGuard(res.payload) && message.result?.ok === true
  && typeof message.result?.value?.version === 'string'
  && typeof message.result?.value?.pid === 'number');
res = await post({ headers: baseHeaders, body: envelope('dev.reconcile', {}) });
message = JSON.parse(res.payload);
check('dev.reconcile without hmr service → ok:false hmr-unavailable',
  envelopeGuard(res.payload) && message.result?.ok === false
  && message.result?.error?.code === 'hmr-unavailable'
  && typeof message.result?.error?.details === 'object' && message.result?.error?.details !== null);
// Capture the hmr fiber the same way apply() registers it, then retry:
// the reply must come back before the (async) reconciliation runs.
const hmrFiber = fibers.find((fiber) => fiber.names.includes('hmr'));
const reconcileCalls = [];
hmrFiber.cb({
  hmr: {
    runExclusive: (fn) => { reconcileCalls.push('runExclusive'); return Promise.resolve(fn()); },
    reconcileProfile: async () => {
      reconcileCalls.push('reconcileProfile');
      return { warnings: [], pending: [], restartReason: null };
    },
  },
});
res = await post({ headers: baseHeaders, body: envelope('dev.reconcile', {}) });
message = JSON.parse(res.payload);
// setTimeout(0) races with promise resolution; poll briefly instead of a
// single setImmediate so the check stays deterministic.
for (let i = 0; i < 50 && reconcileCalls.length < 2; i += 1) {
  await new Promise((resolve) => { setTimeout(resolve, 5); });
}
check('dev.reconcile with hmr → scheduled immediately, reconciliation runs async',
  envelopeGuard(res.payload) && message.result?.ok === true
  && message.result?.value?.scheduled === true
  && reconcileCalls.length === 2
  && reconcileCalls[0] === 'runExclusive' && reconcileCalls[1] === 'reconcileProfile');

// --- fetch leg (connection.fetch bus) ---
const fakeRequest = ({ headers = {}, body = null, method = 'POST' } = {}) => ({
  method,
  headers: new Headers(headers),
  json: async () => (body === null ? undefined : JSON.parse(body)),
});
let fres = await fetchRoute.fetch(fakeRequest({
  headers: { host: '127.0.0.1:14489', 'content-type': 'application/json' },
  body: envelope('restart.plan', {}),
}));
const ftext = await fres.text();
const fmessage = JSON.parse(ftext);
check('fetch leg restart.plan → ok (valid envelope)',
  fres.status === 200 && envelopeGuard(ftext)
  && fmessage.result?.ok === true && fmessage.result?.value?.hostPid === plan.hostPid);
fres = await fetchRoute.fetch(fakeRequest({
  headers: { host: '127.0.0.1:14489', origin: 'http://evil.example.com' },
  body: envelope('restart.plan', {}),
}));
check('fetch leg non-loopback origin → 403', fres.status === 403);

// --- dispose ---
let disposed = true;
try {
  cleanup();
} catch { disposed = false; }
check('cleanup runs clean', disposed && route === null && fetchRoute === null);

// --- v0.6.4 hot-swap fix: apply() must register its teardown through
// ctx.effect (Cordis ignores the returned disposer on plugin stop — the bug
// that left /api/dsh-tools owned by a dead v0.6.0 fiber for three "hot"
// updates). The returned value still works for bare stubs.
{
  let effectDisposer = null;
  const effectCtx = {
    ...ctx,
    effect(factory) { effectDisposer = factory(); return () => { effectDisposer?.(); effectDisposer = null; }; },
  };
  const cleanup2 = apply(effectCtx);
  check('apply registers teardown via ctx.effect when present',
    typeof effectDisposer === 'function' && route?.path === '/api/dsh-tools' && typeof cleanup2 === 'function');
  let effectRanClean = true;
  try { effectDisposer(); } catch { effectRanClean = false; }
  check('ctx.effect disposer tears routes down (hot-swap ownership fix)',
    effectRanClean && route === null && fetchRoute === null);
  // Idempotency: calling the returned cleanup after the effect disposer is a no-op.
  try { cleanup2(); } catch { /* must not throw */ }
}

const failed = results.filter((entry) => !entry.ok || envelopeGuardFailed);
if (failed.length === 0) {
  try { rmSync(process.env.DSH_TOOLS_HOME, { recursive: true, force: true }); } catch { /* leave tmp dir */ }
}
console.log(failed.length === 0 ? 'ALL CHECKS PASSED' : `${failed.length} CHECK(S) FAILED`);
process.exit(failed.length === 0 ? 0 : 1);
