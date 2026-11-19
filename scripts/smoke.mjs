// dsh-tools — Host route smoke test (no live DSH needed).
// Drives apply() with a stub ctx, then exercises the registered webServer
// route handler: envelope validation, admission (loopback + same-origin),
// method dispatch, and the restart safety chain (this process's parent is a
// shell, not the desktop app, so restart must refuse with parent-mismatch).
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

const failed = results.filter((entry) => !entry.ok || envelopeGuardFailed);
console.log(failed.length === 0 ? 'ALL CHECKS PASSED' : `${failed.length} CHECK(S) FAILED`);
process.exit(failed.length === 0 ? 0 : 1);
