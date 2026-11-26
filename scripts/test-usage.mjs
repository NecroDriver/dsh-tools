// dsh-tools — usage aggregation test.
// Part 1: pure fold semantics against dsh-token-meter's `tokenUsage`
// projection rules (last-sample settlement, addReplacing over (turn, step),
// retry slot closing) plus the day-attribution extension (retractions land on
// the PREVIOUS sample's day, additions on the new event's day).
// Part 2: route-level 'usage.today' through the registered webServer route
// with a fake sessionQuery service (two sessions, incremental rescan,
// 30s cache, force bypass, dead-session pruning).
import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

process.env.DSH_TOOLS_HOME = mkdtempSync(join(tmpdir(), 'dsh-tools-usage-home-'));
import {
  apply,
  USAGE_KEEP_DAYS,
  createUsageState,
  foldUsageEvents,
  buildUsagePayload,
  usageDayKey,
  usageOfEvent,
  lastUsageChunk,
  shiftDayKey,
} from '../index.js';

const results = [];
const check = (name, ok, detail = '') => {
  results.push({ name, ok });
  console.log(`${ok ? 'PASS' : 'FAIL'} ${name}${detail ? ` — ${detail}` : ''}`);
};

const TZ = 'Asia/Shanghai';
const dayAt = (dayKey, hour = 12) => new Date(`${dayKey}T${String(hour).padStart(2, '0')}:00:00`).getTime();
const TODAY = usageDayKey(Date.now(), TZ);
const YESTERDAY = shiftDayKey(TODAY, -1);

// --- pure helpers -----------------------------------------------------------

check('usageDayKey zero-pads and is sortable', usageDayKey(dayAt('2026-03-07'), TZ) === '2026-03-07');
check('shiftDayKey crosses month boundary', shiftDayKey('2026-03-01', -1) === '2026-02-28' && shiftDayKey('2026-03-01', -31) === '2026-01-29');
check('usageDayKey honors timeZone', usageDayKey(Date.UTC(2026, 10, 23, 1, 0, 0), 'UTC') === '2026-11-23' && usageDayKey(Date.UTC(2026, 10, 23, 1, 0, 0), 'America/New_York') === '2026-11-22');

check('lastUsageChunk finds the LAST usage chunk', lastUsageChunk([
  { type: 'text-delta', text: 'a' },
  { type: 'usage', usage: { inputTokens: 1, outputTokens: 1 } },
  { type: 'usage', usage: { inputTokens: 2, outputTokens: 3 } },
])?.inputTokens === 2 && lastUsageChunk([{ type: 'text-delta' }]) === undefined);

check('usageOfEvent: message reads data.usage, attempt reads last stream chunk', (() => {
  const a = usageOfEvent({ type: 'assistant/message', data: { usage: { inputTokens: 5, outputTokens: 6 } } });
  const b = usageOfEvent({ type: 'assistant/attempt', data: { turn: 1, step: 2, stream: [{ type: 'usage', usage: { inputTokens: 7, outputTokens: 8 } }] } });
  const c = usageOfEvent({ type: 'user/message', data: { usage: { inputTokens: 99, outputTokens: 99 } } });
  return a?.inputTokens === 5 && b?.outputTokens === 8 && c === undefined;
})());

// --- fold: settlement + replacement ----------------------------------------

const usageState = () => {
  const state = createUsageState();
  const fold = (...events) => foldUsageEvents(state, events, TODAY, TZ);
  return { state, fold };
};

{
  const { state, fold } = usageState();
  fold(
    { type: 'assistant/message', time: dayAt(TODAY, 10), data: { turn: 1, step: 0, usage: { inputTokens: 100, outputTokens: 40, cacheReadTokens: 500, cacheWriteTokens: 10 } } },
  );
  const day = state.days.get(TODAY);
  check('assistant/message adds all four buckets + one request',
    day.inputTokens === 100 && day.outputTokens === 40 && day.cacheReadTokens === 500 && day.cacheWriteTokens === 10 && day.requests === 1);
}

{
  // Live attempt sample then final message with the same (turn, step) — the
  // attempt's buckets must be REPLACED, not double-counted.
  const { state, fold } = usageState();
  fold(
    { type: 'assistant/attempt', time: dayAt(TODAY, 10), data: { turn: 1, step: 0, stream: [{ type: 'usage', usage: { inputTokens: 60, outputTokens: 5 } }] } },
    { type: 'assistant/message', time: dayAt(TODAY, 10), data: { turn: 1, step: 0, usage: { inputTokens: 100, outputTokens: 40 } } },
  );
  const day = state.days.get(TODAY);
  check('attempt→message same slot replaces buckets; only the message counts as request',
    day.inputTokens === 100 && day.outputTokens === 40 && day.requests === 1);
}

{
  // Replacement with different totals updates the day by the delta.
  const { state, fold } = usageState();
  fold(
    { type: 'assistant/message', time: dayAt(TODAY, 10), data: { turn: 1, step: 0, usage: { inputTokens: 100, outputTokens: 40 } } },
    { type: 'assistant/message', time: dayAt(TODAY, 11), data: { turn: 1, step: 0, usage: { inputTokens: 130, outputTokens: 40 } } },
  );
  const day = state.days.get(TODAY);
  check('replacement with different buckets applies -previous +next', day.inputTokens === 130 && day.requests === 1);
}

{
  // llm/retry-started closes the slot: the retried attempt AND the final
  // message both settle (token-meter semantics).
  const { state, fold } = usageState();
  fold(
    { type: 'assistant/attempt', time: dayAt(TODAY, 10), data: { turn: 1, step: 0, stream: [{ type: 'usage', usage: { inputTokens: 60, outputTokens: 5 } }] } },
    { type: 'llm/retry-started', time: dayAt(TODAY, 10, 5), data: { turn: 1, step: 0 } },
    { type: 'assistant/message', time: dayAt(TODAY, 10), data: { turn: 1, step: 0, usage: { inputTokens: 100, outputTokens: 40 } } },
  );
  const day = state.days.get(TODAY);
  check('retry-started closes slot so both settlements count',
    day.inputTokens === 160 && day.outputTokens === 45 && day.requests === 1);
}

{
  // Cross-midnight replacement: retract from the old day, add to the new.
  const { state, fold } = usageState();
  fold(
    { type: 'assistant/message', time: dayAt(YESTERDAY, 23), data: { turn: 1, step: 0, usage: { inputTokens: 100, outputTokens: 40 } } },
    { type: 'assistant/message', time: dayAt(TODAY, 0, 30), data: { turn: 1, step: 0, usage: { inputTokens: 120, outputTokens: 40 } } },
  );
  check('cross-midnight replacement splits across days',
    state.days.get(YESTERDAY)?.inputTokens === 0 && state.days.get(TODAY)?.inputTokens === 120
    && state.days.get(YESTERDAY)?.requests === 1 && state.days.get(TODAY)?.requests === 0);
}

{
  // Same-buckets replacement is a no-op delta but keeps the settlement slot.
  const { state, fold } = usageState();
  fold(
    { type: 'assistant/message', time: dayAt(TODAY, 10), data: { turn: 1, step: 0, usage: { inputTokens: 100, outputTokens: 40 } } },
    { type: 'assistant/message', time: dayAt(TODAY, 11), data: { turn: 1, step: 0, usage: { inputTokens: 100, outputTokens: 40 } } },
  );
  const day = state.days.get(TODAY);
  check('equal replacement is a no-op', day.inputTokens === 100 && day.requests === 1);
}

{
  // Garbage samples are ignored (no usage key, non-numeric, negative).
  const { state, fold } = usageState();
  fold(
    { type: 'assistant/message', time: dayAt(TODAY, 10), data: { turn: 1, step: 0 } },
    { type: 'assistant/attempt', time: dayAt(TODAY, 10), data: { turn: 1, step: 1, stream: [{ type: 'usage', usage: { inputTokens: 'lots', outputTokens: 5 } }] } },
    { type: 'assistant/message', time: dayAt(TODAY, 10), data: { turn: 1, step: 2, usage: { inputTokens: -3, outputTokens: 0 } } },
  );
  check('implausible samples ignored', !state.days.has(TODAY) || buildUsagePayload([[ 's', state ]]).today.total === 0);
}

{
  // Incremental: second fold only processes new events (checkpoint honored),
  // and a SHORTER log resets + refolds from zero.
  const { state, fold } = usageState();
  fold({ type: 'assistant/message', time: dayAt(TODAY, 10), data: { turn: 1, step: 0, usage: { inputTokens: 100, outputTokens: 40 } } });
  const seenAfterFirst = state.seen;
  fold(
    { type: 'assistant/message', time: dayAt(TODAY, 10), data: { turn: 1, step: 0, usage: { inputTokens: 100, outputTokens: 40 } } },
    { type: 'assistant/message', time: dayAt(TODAY, 11), data: { turn: 2, step: 0, usage: { inputTokens: 10, outputTokens: 5 } } },
  );
  const incremental = state.days.get(TODAY).inputTokens;
  fold({ type: 'assistant/message', time: dayAt(TODAY, 10), data: { turn: 1, step: 0, usage: { inputTokens: 100, outputTokens: 40 } } });
  check('incremental checkpoint + shorter-log reset',
    seenAfterFirst === 1 && incremental === 110 && state.seen === 1 && state.days.get(TODAY).inputTokens === 100);
}

{
  // Pruning: days older than KEEP window drop out of state.days.
  const { state } = usageState();
  foldUsageEvents(state, [
    { type: 'assistant/message', time: dayAt(shiftDayKey(TODAY, -30), 10), data: { turn: 1, step: 0, usage: { inputTokens: 999, outputTokens: 1 } } },
  ], TODAY, TZ);
  check('old days pruned', state.days.size === 0);
}

// --- buildUsagePayload -------------------------------------------------------

{
  const s1 = createUsageState();
  foldUsageEvents(s1, [
    { type: 'assistant/message', time: dayAt(TODAY, 10), data: { turn: 1, step: 0, usage: { inputTokens: 100, outputTokens: 40, cacheReadTokens: 500, cacheWriteTokens: 10 } } },
    { type: 'assistant/message', time: dayAt(YESTERDAY, 10), data: { turn: 2, step: 0, usage: { inputTokens: 10, outputTokens: 5 } } },
  ], TODAY, TZ);
  const s2 = createUsageState(); // session with NO usage at all
  const payload = buildUsagePayload([['s1', s1], ['s2', s2]], dayAt(TODAY, 12));
  check('payload: series length = KEEP window, ascending, today last',
    payload.days.length === USAGE_KEEP_DAYS && payload.days[payload.days.length - 1].day === TODAY && payload.days[payload.days.length - 1].isToday);
  check('payload: today aggregates both buckets and counts active sessions',
    payload.today.inputTokens === 100 && payload.today.outputTokens === 40 && payload.today.cacheReadTokens === 500
    && payload.today.cacheWriteTokens === 10 && payload.today.requests === 1 && payload.today.total === 650
    && payload.activeSessions === 1);
  const y = payload.days.find((d) => d.day === YESTERDAY);
  check('payload: yesterday row present with its own totals', y?.inputTokens === 10 && y?.total === 15 && y?.isToday === false);
  check('payload: timeZone reported', typeof payload.timeZone === 'string' && payload.timeZone.length > 0);
}

// --- route-level usage.today with fake sessionQuery -------------------------

let route = null;
let coldRoute = null;
const fibers = [];
const ctx = {
  logger: { info: () => {}, warn: () => {}, error: () => {} },
  inject(names, cb) {
    const fiber = { names, cb, dispose() {} };
    fibers.push(fiber);
    return fiber;
  },
  webServer: { register(def) { route = def; return () => { route = null; }; } },
  connection: { fetch: { register() { return () => {}; } } },
};
apply(ctx);

function nodeRequest({ method = 'POST', headers = {}, body = '' } = {}) {
  return {
    method, headers,
    async *[Symbol.asyncIterator]() { if (body !== '') yield Buffer.from(body, 'utf8'); },
  };
}
const postVia = async (routeDef, method, payload) => {
  let resolveFinished;
  const finished = new Promise((resolve) => { resolveFinished = resolve; });
  const res = { status: 0, payload: null, writeHead(status) { this.status = status; }, end(payload) { this.payload = payload; resolveFinished(this); } };
  routeDef.handler(nodeRequest({
    headers: { host: '127.0.0.1:14489', 'content-type': 'application/json' },
    body: JSON.stringify({ type: 'client-request', rpcId: `r${Math.random()}`, method: 'dsh-tools', payload: { method, payload } }),
  }), res);
  const done = await finished;
  return JSON.parse(done.payload).result;
};
const post = (method, payload) => postVia(route, method, payload);

// Fake sessionQuery: two sessions, one grows between scans.
const logs = new Map([
  ['s1', [
    { type: 'assistant/message', time: dayAt(TODAY, 10), data: { turn: 1, step: 0, usage: { inputTokens: 100, outputTokens: 40 } } },
  ]],
  ['s2', [
    { type: 'assistant/message', time: dayAt(TODAY, 11), data: { turn: 1, step: 0, usage: { inputTokens: 700, outputTokens: 300, cacheReadTokens: 5000, cacheWriteTokens: 200 } } },
  ]],
]);
const listSessions = () => [...logs.keys()].map((id) => ({ header: { id, createdAt: dayAt(TODAY, 9) }, live: false, persisted: true }));
const readSession = (id) => {
  if (!logs.has(id)) throw new Error('ENOENT');
  return { session: { header: { id } }, events: logs.get(id) };
};
for (const fiber of fibers) {
  if (fiber.names.includes('sessionQuery')) fiber.cb({ sessionQuery: { listSessions, readSession } });
}

{
  const result = await post('usage.today', {});
  const value = result.ok ? result.value : null;
  check('route: usage.today aggregates sessions', value !== null && value.today.inputTokens === 800 && value.today.total === 800 + 340 + 5000 + 200 && value.activeSessions === 2,
    JSON.stringify(value?.today ?? result));

  // Same call again within 30s: served from cache — remove s2's log and the
  // numbers must NOT change; then force:true rescans and they must.
  logs.delete('s2');
  const cached = (await post('usage.today', {})).value;
  check('route: 30s fresh window serves cache', cached.today.inputTokens === 800 && cached.activeSessions === 2);
  const forced = (await post('usage.today', { force: true })).value;
  check('route: force bypasses cache and prunes dead sessions', forced.today.inputTokens === 100 && forced.activeSessions === 1,
    JSON.stringify(forced?.today));

  // Session growth between scans folds incrementally.
  logs.set('s1', [
    ...logs.get('s1'),
    { type: 'assistant/message', time: dayAt(TODAY, 12), data: { turn: 2, step: 0, usage: { inputTokens: 50, outputTokens: 10 } } },
  ]);
  const grown = (await post('usage.today', { force: true })).value;
  check('route: incremental rescan picks up appended events', grown.today.inputTokens === 150 && grown.today.requests === 2,
    JSON.stringify(grown?.today));

  // scanUsage persisted its payload; a "restarted" module copy (fresh ESM URL)
  // with NO sessionQuery service must still answer instantly from disk. Age the
  // savedAt backwards first so the honest stale flag must come back true.
  {
    const cachePath = join(process.env.DSH_TOOLS_HOME, 'usage-cache.json');
    const aged = JSON.parse(readFileSync(cachePath, 'utf8'));
    aged.savedAt = Date.now() - 120_000;
    writeFileSync(cachePath, JSON.stringify(aged));
  }
  const restarted = await import(`../index.js?cold=${Date.now()}-${Math.random()}`);
  const coldFibers = [];
  const coldCtx = {
    logger: ctx.logger,
    inject(names, cb) {
      const fiber = { names, cb, dispose() {} };
      coldFibers.push(fiber); // NOTE: cb deliberately never fired → service stays null
      return fiber;
    },
    webServer: { register(def) { coldRoute = def; return () => { coldRoute = null; }; } },
    connection: { fetch: { register() { return () => {}; } } },
  };
  restarted.apply(coldCtx);
  const coldPost = (method, payload) => postVia(coldRoute, method, payload);
  const started = Date.now();
  const stale = await coldPost('usage.today', {});
  const elapsed = Date.now() - started;
  check('route: restart answers from disk cache with stale flag',
    stale?.ok === true && stale.value?.stale === true && stale.value?.today?.inputTokens === 150 && elapsed < 1500,
    `elapsed=${elapsed}ms ${JSON.stringify(stale?.value?.today ?? stale)}`);
}

// --- summary -----------------------------------------------------------------
const failed = results.filter((r) => !r.ok);
console.log(failed.length === 0 ? `\nAll ${results.length} usage checks passed.` : `\n${failed.length}/${results.length} usage checks FAILED.`);
process.exit(failed.length === 0 ? 0 : 1);
