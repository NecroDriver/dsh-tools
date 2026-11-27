// dsh-tools — Source Control host-side integration test (real git).
// Builds throwaway repositories in a temp root, points the plugin at it via
// settings.sc.roots, then drives sc.* methods through the registered
// webServer route: scan, status, diff (tracked + synthetic untracked),
// partial commit (unselected changes must survive), log, AI commit message
// (fake llm captures the composed prompt), file-path traversal guards,
// pull (git pull --rebase --autostash with a real origin), and the prisma
// script runner (missing scripts / echo scripts / failing script).
import { spawnSync, execFileSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync, rmSync as rmFile, renameSync, readFileSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

if (spawnSync('git', ['--version'], { encoding: 'utf8', windowsHide: true }).status !== 0) {
  console.error('git not available in PATH — cannot run SC integration test');
  process.exit(1);
}

process.env.DSH_TOOLS_HOME = mkdtempSync(join(tmpdir(), 'dsh-tools-sc-home-'));
import { apply, parsePorcelain } from '../index.js';

const results = [];
const check = (name, ok, detail = '') => {
  results.push({ name, ok });
  console.log(`${ok ? 'PASS' : 'FAIL'} ${name}${detail ? ` — ${detail}` : ''}`);
};

let route = null;
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
const post = async (method, payload) => {
  let resolveFinished;
  const finished = new Promise((resolve) => { resolveFinished = resolve; });
  const res = { status: 0, payload: null, writeHead(status) { this.status = status; }, end(payload) { this.payload = payload; resolveFinished(this); } };
  route.handler(nodeRequest({
    headers: { host: '127.0.0.1:14489', 'content-type': 'application/json' },
    body: JSON.stringify({ type: 'client-request', rpcId: `r${Math.random()}`, method: 'dsh-tools', payload: { method, payload } }),
  }), res);
  const done = await finished;
  return JSON.parse(done.payload).result;
};

const git = (dir, ...args) => execFileSync('git', ['-C', dir, ...args], { encoding: 'utf8', windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'] });
const initRepo = (dir) => {
  mkdirSync(dir, { recursive: true });
  git(dir, 'init', '-b', 'main');
  git(dir, 'config', 'user.name', 'SC Test');
  git(dir, 'config', 'user.email', 'sc-test@example.com');
  git(dir, 'config', 'commit.gpgsign', 'false');
};

// --- fixture: temp root with two live repos + one repo inside node_modules ---
const root = mkdtempSync(join(tmpdir(), 'dsh-tools-sc-root-'));
const repoA = join(root, 'alpha');
const repoB = join(root, 'nested', 'beta');
const skipRepo = join(root, 'node_modules', 'skiprepo');
initRepo(repoA);
initRepo(repoB);
initRepo(skipRepo);
writeFileSync(join(repoA, 'a.txt'), 'alpha base\n');
writeFileSync(join(repoA, 'c.txt'), 'to be deleted\n');
writeFileSync(join(repoA, 'd.txt'), 'renamed away\n');
git(repoA, 'add', '-A');
git(repoA, 'commit', '-m', 'base: init');
// working-copy changes in repoA
writeFileSync(join(repoA, 'a.txt'), 'alpha base\nalpha modified\n');
writeFileSync(join(repoA, 'b.txt'), 'brand new file\n');
rmFile(join(repoA, 'c.txt'));
renameSync(join(repoA, 'd.txt'), join(repoA, 'e.txt'));
git(repoA, 'add', '-A', '--', 'd.txt', 'e.txt'); // stage the rename so git pairs it (R + orig)
git(repoB, 'commit', '--allow-empty', '-m', 'beta: empty');

// point the plugin at the temp root
await post('settings.set', { sc: { roots: [root] } });

// --- sc.repos: finds both real repos, skips node_modules ---
let r = await post('sc.repos', {});
const repoNames = (r.value?.repos ?? []).map((entry) => entry.name).sort();
check('sc.repos finds alpha + nested beta, skips node_modules',
  r.ok === true && repoNames.join(',') === 'alpha,beta',
  `repos=${JSON.stringify(repoNames)} roots=${JSON.stringify(r.value?.roots)}`);

// --- sc.repos with client-hinted roots: hint works even with no settings roots ---
const hintRoot = mkdtempSync(join(tmpdir(), 'dsh-tools-sc-hint-'));
const hintRepo = join(hintRoot, 'hinted');
initRepo(hintRepo);
git(hintRepo, 'commit', '--allow-empty', '-m', 'hint: empty');
await post('settings.set', { sc: { roots: [] } });
r = await post('sc.repos', { roots: [hintRoot] });
const hintNames = (r.value?.repos ?? []).map((entry) => entry.name).sort();
check('sc.repos uses client-hinted roots without settings',
  r.ok === true && hintNames.join(',') === 'hinted',
  `repos=${JSON.stringify(hintNames)} roots=${JSON.stringify(r.value?.roots)}`);
r = await post('sc.repos', { roots: [hintRoot, 'relative/path', 42, null] });
check('sc.repos ignores malformed hints',
  r.ok === true && (r.value?.repos ?? []).map((entry) => entry.name).join(',') === 'hinted',
  `repos=${JSON.stringify((r.value?.repos ?? []).map((entry) => entry.name))}`);

// --- v0.6.5: client hints are EXCLUSIVE of the workspace registry (m03593) ---
// The registry lists every workspace on the machine; merging it while the
// client hints the current workspace showed sibling projects in the panel.
const regRoot = mkdtempSync(join(tmpdir(), 'dsh-tools-sc-reg-'));
initRepo(join(regRoot, 'registryrepo'));
git(join(regRoot, 'registryrepo'), 'commit', '--allow-empty', '-m', 'registry: empty');
const registryFiber = fibers.find((f) => Array.isArray(f.names) && f.names.includes('workspaceRegistry'));
check('workspaceRegistry capture fiber registered', registryFiber !== undefined,
  `fibers=${JSON.stringify(fibers.map((f) => f.names))}`);
const regDispose = registryFiber.cb({ workspaceRegistry: { list: () => [{ path: regRoot }] } });
r = await post('sc.repos', { roots: [hintRoot] });
const exclNames = (r.value?.repos ?? []).map((entry) => entry.name).sort();
check('sc.repos skips registry when client hints a root',
  r.ok === true && exclNames.join(',') === 'hinted',
  `repos=${JSON.stringify(exclNames)} roots=${JSON.stringify(r.value?.roots)}`);
r = await post('sc.repos', {});
const regNames = (r.value?.repos ?? []).map((entry) => entry.name).sort();
check('sc.repos falls back to registry without client hints',
  r.ok === true && regNames.join(',') === 'registryrepo',
  `repos=${JSON.stringify(regNames)} roots=${JSON.stringify(r.value?.roots)}`);
if (typeof regDispose === 'function') regDispose();
await post('settings.set', { sc: { roots: [root] } });

// --- sc.status: statuses M / A / D / R with orig ---
r = await post('sc.status', { repo: repoA });
const byPath = Object.fromEntries((r.value?.files ?? []).map((f) => [f.path, f]));
check('sc.status reports M/A/D + rename R with orig',
  r.ok === true && r.value?.branch === 'main'
  && byPath['a.txt']?.status === 'M' && byPath['a.txt']?.staged === false
  && byPath['b.txt']?.status === 'A' && byPath['b.txt']?.staged === false
  && byPath['c.txt']?.status === 'D'
  && byPath['e.txt']?.status === 'R' && byPath['e.txt']?.orig === 'd.txt'
  && byPath['e.txt']?.staged === true,
  `files=${JSON.stringify(r.value?.files)}`);

// --- parsePorcelain unit: staged + untracked + ignored ---
const unit = parsePorcelain('M  staged.txt\0A  added.txt\0?? new.txt\0!! ignored.txt\0R  after.txt\0before.txt\0');
const unitMap = Object.fromEntries(unit.map((f) => [f.path, f]));
check('parsePorcelain maps xy → status + staged flag + rename orig',
  unitMap['staged.txt'].status === 'M' && unitMap['staged.txt'].staged === true
  && unitMap['new.txt'].status === 'A' && unitMap['new.txt'].staged === false
  && unitMap['ignored.txt'] === undefined
  && unitMap['after.txt'].status === 'R' && unitMap['after.txt'].orig === 'before.txt',
  `parsed=${JSON.stringify(unit)}`);

// --- sc.diff: tracked modification shows +new ; untracked gets synthetic + ---
r = await post('sc.diff', { repo: repoA, file: 'a.txt' });
check('sc.diff tracked file shows the modification',
  r.ok === true && r.value?.diff?.includes('+alpha modified') === true
  && r.value?.diff?.includes('+++ b/a.txt') === true,
  `diff=${JSON.stringify((r.value?.diff ?? '').slice(0, 140))}`);
r = await post('sc.diff', { repo: repoA, file: 'b.txt', untracked: true });
check('sc.diff untracked file → synthetic all-plus diff',
  r.ok === true && (r.value?.diff ?? '').includes('brand new file')
  && (r.value?.diff ?? '').startsWith('diff --git') === true,
  `diff=${JSON.stringify((r.value?.diff ?? '').slice(0, 140))}`);
check('sc.diff untracked synthetic carries @@ hunk header (v0.7.10)',
  /^diff --git[^\n]*\nnew file mode[^\n]*\n--- \/dev\/null\n\+\+\+ [^\n]*\n@@ -0,0 \+1,\d+ @@\n\+/.test(r.value?.diff ?? '') === true,
  `head=${JSON.stringify((r.value?.diff ?? '').split('\n').slice(0, 5).join('⏎'))}`);
r = await post('sc.diff', { repo: repoA, file: 'b.txt' });
check('sc.diff untracked without flag still auto-synthetic (ls-files probe)',
  r.ok === true && (r.value?.diff ?? '').includes('brand new file'));
r = await post('sc.diff', { repo: repoA, file: '..\\evil.txt' });
check('sc.diff rejects path traversal', r.ok === false && r.error?.code === 'bad-request');
r = await post('sc.diff', { repo: repoA, file: 'nope.txt' });
check('sc.diff missing file → graceful synthetic fallback',
  r.ok === true && (r.value?.diff ?? '').includes('no longer exists'));

// --- partial commit: select only a.txt; b/c/e must survive ---
r = await post('sc.commit', { repo: repoA, files: ['a.txt'], message: 'feat: modify a only' });
check('sc.commit partial → ok with short hash + count 1',
  r.ok === true && /^[0-9a-f]{7,}$/.test(r.value?.commit ?? '') && r.value?.count === 1,
  `commit=${r.value?.commit} count=${r.value?.count}`);
r = await post('sc.status', { repo: repoA });
const after = Object.fromEntries((r.value?.files ?? []).map((f) => [f.path, f.status]));
check('unselected changes survive partial commit',
  after['a.txt'] === undefined && after['b.txt'] === 'A' && after['c.txt'] === 'D' && after['e.txt'] === 'R',
  `after=${JSON.stringify(after)}`);
r = await post('sc.log', { repo: repoA });
check('sc.log returns subjects incl. new commit',
  r.ok === true && (r.value?.subjects ?? []).includes('feat: modify a only') && r.value.subjects.includes('base: init'),
  `subjects=${JSON.stringify(r.value?.subjects)}`);
r = await post('sc.commit', { repo: repoA, files: ['a.txt'], message: 'not a change anymore' });
check('sc.commit rejects file that is no longer a change', r.ok === false && r.error?.code === 'bad-request');

// --- sc.commitMessage: fake llm captures composed prompt ---
const seenPrepareCalls = [];
const seenUserMessages = [];
const fakeLlm = {
  prepareCall: async (config) => {
    seenPrepareCalls.push(config);
    return {
      config: { provider: config.provider, model: config.model },
      stream: async function* gen() { yield { type: 'text-delta', index: 0, text: 'feat: modify b and e' }; },
    };
  },
};
const llmFiber = fibers.find((f) => f.names.includes('llm'));
// intercept runAssist user text by wrapping stream: capture via messages? easier: patch fake llm is enough; runAssist builds the user text internally — capture through prepareCall's second arg? runAssist passes (config, signal, configure). The user message goes to stream(options) — record options there.
fakeLlm.prepareCall = async (config, signal, configure) => {
  seenPrepareCalls.push(config);
  return {
    config: { provider: config.provider, model: config.model },
    stream: async function* gen(options) {
      seenUserMessages.push(options?.messages?.[0]?.content?.[0]?.text ?? '');
      yield { type: 'text-delta', index: 0, text: 'feat: modify b and e' };
    },
  };
};
const selectorFiber = fibers.find((f) => f.names.includes('agentDefaultModel'));
await llmFiber.cb({ llm: fakeLlm });
await selectorFiber.cb({ agentDefaultModel: { currentSelection: () => ({ provider: 'deepseek', model: 'test-model' }) } });
r = await post('sc.commitMessage', { repo: repoA, files: ['b.txt', 'e.txt'], lang: 'zh' });
const prompt = seenUserMessages.at(-1) ?? '';
check('sc.commitMessage → ok draft from llm, prompt carries history + per-file diff',
  r.ok === true && r.value?.draft === 'feat: modify b and e'
  && prompt.includes('base: init') && prompt.includes('feat: modify a only')
  && prompt.includes('### b.txt') && prompt.includes('brand new file')
  && prompt.includes('### e.txt'),
  `draft=${JSON.stringify(r.value?.draft)} promptHead=${JSON.stringify(prompt.slice(0, 160))}`);
check('sc.commitMessage uses selection-route model',
  seenPrepareCalls.at(-1)?.provider === 'deepseek' && seenPrepareCalls.at(-1)?.model === 'test-model');

// --- v0.8.2: AI commit draft must pass sc.commit validation ---
// Model streams can carry CRLF (\r is a control char → bad-request) and can
// ignore soft length asks, so the draft pipeline normalizes both.
const seenSystems = [];
let commitYield = 'feat: modify b and e';
fakeLlm.prepareCall = async (config) => {
  seenPrepareCalls.push(config);
  return {
    config: { provider: config.provider, model: config.model },
    stream: async function* gen(options) {
      seenUserMessages.push(options?.messages?.[0]?.content?.[0]?.text ?? '');
      seenSystems.push(String(options?.system ?? ''));
      yield { type: 'text-delta', index: 0, text: commitYield };
    },
  };
};
commitYield = 'feat: multi\r\n\r\nbody one\r\nbody two\r';
r = await post('sc.commitMessage', { repo: repoA, files: ['b.txt'], lang: 'zh' });
check('commit draft normalizes CRLF/CR to LF (control chars stripped)',
  r.ok === true && !/[\u0000-\u0008\u000b-\u001f]/.test(r.value?.draft ?? '')
    && (r.value?.draft ?? '') === 'feat: multi\n\nbody one\nbody two',
  `draft=${JSON.stringify(r.value?.draft)}`);
check('commit system prompt carries hard length limits (400 total / 72 subject)',
  (seenSystems.at(-1) ?? '').includes('400') && (seenSystems.at(-1) ?? '').includes('72'),
  `systemHead=${JSON.stringify((seenSystems.at(-1) ?? '').slice(0, 80))}`);
commitYield = `feat: ${'a'.repeat(100)}\n\n${'x'.repeat(600)}`;
r = await post('sc.commitMessage', { repo: repoA, files: ['b.txt'], lang: 'zh' });
check('commit draft over 500 chars truncates on a line boundary (subject survives)',
  r.ok === true && (r.value?.draft ?? '').length <= 500 && (r.value?.draft ?? '') === `feat: ${'a'.repeat(100)}`,
  `len=${(r.value?.draft ?? '').length} draft=${JSON.stringify((r.value?.draft ?? '').slice(0, 60))}`);
r = await post('sc.commit', { repo: repoA, files: ['b.txt'], message: 'y'.repeat(501) });
check('sc.commit still rejects >500-char message', r.ok === false && r.error?.code === 'bad-request');

// --- v0.8 sc.revert: M/D/R restored from HEAD, A (untracked + staged) deleted ---
mkdirSync(join(repoA, 'nested'), { recursive: true });
writeFileSync(join(repoA, 'nested', 'n.txt'), 'untracked nested\n');
writeFileSync(join(repoA, 'f.txt'), 'staged addition\n');
git(repoA, 'add', '--', 'f.txt');
r = await post('sc.revert', { repo: repoA, files: ['b.txt', 'c.txt', 'e.txt', 'f.txt', 'nested/n.txt'] });
check('sc.revert → restored=2 (c D, e R) deleted=3 (b untracked, f staged, nested/n), failed=0',
  r.ok === true && r.value?.failed === 0 && r.value?.restored === 2 && r.value?.deleted === 3,
  `ok=${r.ok} restored=${r.value?.restored} deleted=${r.value?.deleted} failed=${r.value?.failed} error=${JSON.stringify(r.error)} results=${JSON.stringify(r.value?.results)}`);
check('sc.revert removed additions (files + now-empty dir gone)',
  !existsSync(join(repoA, 'b.txt')) && !existsSync(join(repoA, 'f.txt'))
  && !existsSync(join(repoA, 'e.txt')) && !existsSync(join(repoA, 'nested')),
  `b=${existsSync(join(repoA, 'b.txt'))} f=${existsSync(join(repoA, 'f.txt'))} e=${existsSync(join(repoA, 'e.txt'))} nested=${existsSync(join(repoA, 'nested'))}`);
check('sc.revert restored deletion + rename to HEAD content',
  readFileSync(join(repoA, 'c.txt'), 'utf8').replace(/\r\n/g, '\n') === 'to be deleted\n'
  && readFileSync(join(repoA, 'd.txt'), 'utf8').replace(/\r\n/g, '\n') === 'renamed away\n');
r = await post('sc.status', { repo: repoA });
check('sc.status after revert → working copy clean',
  r.ok === true && r.value?.files?.length === 0,
  `files=${JSON.stringify(r.value?.files)}`);
r = await post('sc.revert', { repo: repoA, files: ['a.txt'] });
check('sc.revert rejects file that is not a change', r.ok === false && r.error?.code === 'bad-request');
r = await post('sc.revert', { repo: repoA, files: ['../evil.txt'] });
check('sc.revert rejects traversal path', r.ok === false && r.error?.code === 'bad-request');
r = await post('sc.revert', { repo: 'relative/path', files: ['a.txt'] });
check('sc.revert rejects non-absolute repo', r.ok === false && r.error?.code === 'bad-request');

// --- push guard: no remote configured → git-error, not a crash ---
r = await post('sc.push', { repo: repoA });
check('sc.push without remote → git-error failure with details',
  r.ok === false && r.error?.code === 'git-error' && typeof r.error?.details?.repo === 'string',
  `code=${r.error?.code}`);

// --- sc.pull: no remote → git-error guard, not a crash ---
r = await post('sc.pull', { repo: repoB });
check('sc.pull without remote → git-error failure',
  r.ok === false && r.error?.code === 'git-error',
  `code=${r.error?.code}`);

// --- sc.pull: real origin + dirty worktree (autostash must survive) ---
const upstream = join(root, 'upstream');
initRepo(upstream);
writeFileSync(join(upstream, 'shared.txt'), 'v1\n');
git(upstream, 'add', '-A');
git(upstream, 'commit', '-m', 'upstream: v1');
const cloned = join(root, 'cloned');
execFileSync('git', ['clone', upstream, cloned], { encoding: 'utf8', windowsHide: true });
git(cloned, 'config', 'user.name', 'SC Test');
git(cloned, 'config', 'user.email', 'sc-test@example.com');
writeFileSync(join(upstream, 'shared.txt'), 'v2 from upstream\n');
git(upstream, 'add', '-A');
git(upstream, 'commit', '-m', 'upstream: v2');
writeFileSync(join(cloned, 'shared.txt'), 'v1\nlocal dirty edit\n'); // autostash candidate
r = await post('sc.pull', { repo: cloned });
const pulledShared = readFileSync(join(cloned, 'shared.txt'), 'utf8');
let clonedLog = '';
try { clonedLog = git(cloned, 'log', '--pretty=format:%s'); } catch { /* unchanged */ }
check('sc.pull rebases onto origin and autostashes local edit',
  r.ok === true && clonedLog.includes('upstream: v2')
  && pulledShared.includes('v2 from upstream') && pulledShared.includes('local dirty edit'),
  `ok=${r.ok} log=${JSON.stringify(clonedLog)} shared=${JSON.stringify(pulledShared)}`);

// --- sc.prisma: repo without prisma scripts → distinct no-prisma-scripts code ---
r = await post('sc.prisma', { repo: repoB });
check('sc.prisma without scripts → no-prisma-scripts failure',
  r.ok === false && r.error?.code === 'no-prisma-scripts' && typeof r.error?.details?.repo === 'string',
  `code=${r.error?.code}`);

// --- sc.prisma: both echo scripts run in order (real pnpm) ---
writeFileSync(join(repoB, 'package.json'), JSON.stringify({
  name: 'beta-fixture',
  private: true,
  scripts: { 'prisma:generate': 'echo gen-ok', 'prisma:push': 'echo push-ok' },
}, null, 2));
r = await post('sc.prisma', { repo: repoB });
check('sc.prisma runs prisma:generate then prisma:push via pnpm',
  r.ok === true && (r.value?.ran ?? []).join(',') === 'prisma:generate,prisma:push'
  && (r.value?.output ?? '').includes('gen-ok') === true
  && (r.value?.output ?? '').includes('push-ok') === true,
  `ran=${JSON.stringify(r.value?.ran)} output=${JSON.stringify((r.value?.output ?? '').slice(0, 200))}`);

// --- sc.prisma: only one script present → runs just that one ---
writeFileSync(join(repoA, 'package.json'), JSON.stringify({
  name: 'alpha-fixture',
  private: true,
  scripts: { 'prisma:generate': 'echo gen-only' },
}, null, 2));
r = await post('sc.prisma', { repo: repoA });
check('sc.prisma with a single script runs only it',
  r.ok === true && (r.value?.ran ?? []).join(',') === 'prisma:generate'
  && (r.value?.output ?? '').includes('gen-only') === true,
  `ran=${JSON.stringify(r.value?.ran)}`);

// --- sc.prisma: failing script → pnpm-error carrying the script name ---
writeFileSync(join(repoB, 'package.json'), JSON.stringify({
  name: 'beta-fixture',
  private: true,
  scripts: { 'prisma:generate': 'echo gen-ok', 'prisma:push': 'echo boom >&2 && exit 1' },
}, null, 2));
r = await post('sc.prisma', { repo: repoB });
check('sc.prisma failing script → pnpm-error with script detail',
  r.ok === false && r.error?.code === 'pnpm-error' && r.error?.details?.script === 'prisma:push',
  `code=${r.error?.code} script=${r.error?.details?.script} msg=${JSON.stringify((r.error?.message ?? '').slice(0, 160))}`);

// --- sc.pull / sc.prisma: malformed repo path → bad-request ---
r = await post('sc.pull', { repo: 'relative/path' });
check('sc.pull rejects non-absolute repo', r.ok === false && r.error?.code === 'bad-request');
r = await post('sc.prisma', { repo: 'relative/path' });
check('sc.prisma rejects non-absolute repo', r.ok === false && r.error?.code === 'bad-request');

// ==========================================================================
// v0.8.0 — interactive process sessions (sc.run / sc.procOutput /
// sc.procInput / sc.procKill / sc.rebaseAbort)
// ==========================================================================
const pollUntil = async (sessionId, predicate, { intervalMs = 60, timeoutMs = 45000 } = {}) => {
  const start = Date.now();
  for (;;) {
    const res = await post('sc.procOutput', { sessionId, since: 0 });
    if (res.ok !== true) return res;
    if (predicate(res.value)) return res;
    if (Date.now() - start > timeoutMs) {
      return { ok: false, error: { code: 'test-timeout', message: String(res.value?.output ?? '').slice(-200) } };
    }
    await new Promise((resolve) => setTimeout(resolve, intervalMs));
  }
};
const pollDone = (sessionId) => pollUntil(sessionId, (value) => value?.done === true);

// fixture: interactive repo whose prisma:push asks a y/n question on stdin
const askRepo = mkdtempSync(join(tmpdir(), 'dsh-tools-sc-ask-'));
initRepo(askRepo);
git(askRepo, 'commit', '--allow-empty', '-m', 'ask: init');
mkdirSync(join(askRepo, 'scripts'), { recursive: true });
writeFileSync(join(askRepo, 'scripts', 'ask.mjs'), [
  "process.stdout.write('continue? ');",
  "const chunk = await new Promise((resolve) => {",
  "  process.stdin.once('data', resolve);",
  "  process.stdin.once('end', () => resolve(Buffer.alloc(0)));",
  "});",
  "const answer = String(chunk).trim().toLowerCase();",
  "console.log(`YOU SAID ${answer}`);",
  "process.exit(answer === 'y' ? 0 : 3);",
  '',
].join('\n'));
writeFileSync(join(askRepo, 'package.json'), JSON.stringify({
  name: 'ask-fixture',
  private: true,
  scripts: { 'prisma:generate': 'echo gen-ok', 'prisma:push': 'node scripts/ask.mjs' },
}, null, 2));

// fixture: sleeping repos (long-lived sessions for busy/limit/kill tests)
const makeSleepRepo = (label) => {
  const dir = mkdtempSync(join(tmpdir(), `dsh-tools-sc-${label}-`));
  initRepo(dir);
  git(dir, 'commit', '--allow-empty', '-m', `${label}: init`);
  mkdirSync(join(dir, 'scripts'), { recursive: true });
  writeFileSync(join(dir, 'scripts', 'sleep.mjs'), 'setTimeout(() => process.exit(0), 30000);\n');
  writeFileSync(join(dir, 'package.json'), JSON.stringify({
    name: `${label}-fixture`,
    private: true,
    scripts: { 'prisma:generate': 'node scripts/sleep.mjs' },
  }, null, 2));
  return dir;
};
const sleepRepos = [makeSleepRepo('sleep1'), makeSleepRepo('sleep2'), makeSleepRepo('sleep3'), makeSleepRepo('sleep4')];

// --- sc.run prisma + interactive stdin: procInput answers the prompt ---
r = await post('sc.run', { repo: askRepo, kind: 'prisma' });
check('sc.run prisma starts a session and reports the command',
  r.ok === true && typeof r.value?.sessionId === 'string'
    && r.value.command === 'pnpm run prisma:generate && pnpm run prisma:push'
    && r.value.kind === 'prisma',
  `ok=${r.ok} command=${JSON.stringify(r.value?.command)}`);
const askId = r.value.sessionId;
r = await pollUntil(askId, (value) => String(value?.output ?? '').includes('continue?'));
check('sc.procOutput streams the prompt while running',
  r.ok === true && r.value?.done === false,
  `output=${JSON.stringify(String(r.value?.output ?? '').slice(-80))} err=${JSON.stringify(r.error)}`);
// incremental since: everything up to the prompt must not replay at since=total
const promptTotal = r.value?.total ?? 0;
r = await post('sc.procOutput', { sessionId: askId, since: promptTotal });
check('sc.procOutput honors since (no replay of consumed output)',
  r.ok === true && !String(r.value?.output ?? '').includes('continue?'),
  `since=${promptTotal} output=${JSON.stringify(r.value?.output)}`);
r = await post('sc.procInput', { sessionId: askId, line: 'y' });
check('sc.procInput delivers a line to the child', r.ok === true, `err=${JSON.stringify(r.error)}`);
r = await pollDone(askId);
check('answered session exits 0 with the answer echoed',
  r.ok === true && r.value?.exitCode === 0 && String(r.value?.output ?? '').includes('YOU SAID y'),
  `exit=${r.value?.exitCode} output=${JSON.stringify(String(r.value?.output ?? '').slice(-80))}`);

// --- finished session rejects further input; empty line is bad-request ---
r = await post('sc.procInput', { sessionId: askId, line: 'y' });
check('sc.procInput on finished session → proc-done', r.ok === false && r.error?.code === 'proc-done',
  `code=${r.error?.code}`);
r = await post('sc.procInput', { sessionId: 'nope' });
check('sc.procInput unknown session → bad-request', r.ok === false && r.error?.code === 'bad-request',
  `code=${r.error?.code}`);

// --- non-zero exit propagates (answer n → exit 3) ---
r = await post('sc.run', { repo: askRepo, kind: 'prisma' });
const askId2 = r.value?.sessionId;
await pollUntil(askId2, (value) => String(value?.output ?? '').includes('continue?'));
await post('sc.procInput', { sessionId: askId2, line: 'n' });
r = await pollDone(askId2);
check('sc.procOutput reports non-zero exit code',
  r.ok === true && r.value?.exitCode === 3 && String(r.value?.output ?? '').includes('YOU SAID n'),
  `exit=${r.value?.exitCode}`);

// --- proc-busy: same repo cannot run two live sessions ---
r = await post('sc.run', { repo: sleepRepos[0], kind: 'prisma' });
const busyId = r.value?.sessionId;
check('sc.run starts the long session', r.ok === true, `err=${JSON.stringify(r.error)}`);
r = await post('sc.run', { repo: sleepRepos[0], kind: 'prisma' });
check('sc.run on a busy repo → proc-busy',
  r.ok === false && r.error?.code === 'proc-busy' && r.error?.details?.sessionId === busyId,
  `code=${r.error?.code}`);

// --- proc-limit: cap concurrent sessions across repos (max 4) ---
const limitIds = [busyId];
for (const repo of sleepRepos.slice(1)) {
  const started = await post('sc.run', { repo, kind: 'prisma' });
  limitIds.push(started.value?.sessionId);
}
r = await post('sc.run', { repo: askRepo, kind: 'pull' });
check('sc.run beyond SC_PROC_MAX → proc-limit',
  r.ok === false && r.error?.code === 'proc-limit',
  `code=${r.error?.code}`);

// --- procKill: tree-kill marks killReason and finishes the session ---
r = await post('sc.procKill', { sessionId: busyId });
check('sc.procKill acknowledges', r.ok === true, `err=${JSON.stringify(r.error)}`);
r = await pollDone(busyId);
check('killed session is done with killReason user and non-zero exit',
  r.ok === true && r.value?.killReason === 'user' && r.value?.exitCode !== 0,
  `reason=${r.value?.killReason} exit=${r.value?.exitCode}`);
for (const id of limitIds) { await post('sc.procKill', { sessionId: id }); }
await Promise.all(limitIds.map((id) => pollDone(id)));

// --- acceptDataLoss flag reaches the prisma:push command line ---
writeFileSync(join(repoA, 'package.json'), JSON.stringify({
  name: 'alpha-fixture',
  private: true,
  scripts: { 'prisma:generate': 'echo gen-ok', 'prisma:push': 'echo push-flag' },
}, null, 2));
r = await post('sc.run', { repo: repoA, kind: 'prisma', acceptDataLoss: true });
check('sc.run acceptDataLoss appends the flag to prisma:push',
  r.ok === true && String(r.value?.command ?? '').includes('pnpm run prisma:push -- --accept-data-loss'),
  `command=${JSON.stringify(r.value?.command)}`);
await pollDone(r.value.sessionId);

// --- rebase conflict → non-zero exit → sc.rebaseAbort restores the repo ---
const confUpstream = join(root, 'conf-upstream');
initRepo(confUpstream);
writeFileSync(join(confUpstream, 'shared.txt'), 'v1\n');
git(confUpstream, 'add', '-A');
git(confUpstream, 'commit', '-m', 'upstream: v1');
const confRepo = join(root, 'conf-cloned');
execFileSync('git', ['clone', confUpstream, confRepo], { encoding: 'utf8', windowsHide: true });
git(confRepo, 'config', 'user.name', 'SC Test');
git(confRepo, 'config', 'user.email', 'sc-test@example.com');
writeFileSync(join(confUpstream, 'shared.txt'), 'v2 upstream\n');
git(confUpstream, 'add', '-A');
git(confUpstream, 'commit', '-m', 'upstream: v2');
writeFileSync(join(confRepo, 'shared.txt'), 'v2 local\n');
git(confRepo, 'add', '-A');
git(confRepo, 'commit', '-m', 'local: v2');
r = await post('sc.run', { repo: confRepo, kind: 'pull' });
const confId = r.value?.sessionId;
r = await pollDone(confId);
check('conflicting pull session exits non-zero and surfaces CONFLICT',
  r.ok === true && r.value?.exitCode !== 0 && /CONFLICT|could not apply/i.test(String(r.value?.output ?? '')),
  `exit=${r.value?.exitCode} output=${JSON.stringify(String(r.value?.output ?? '').slice(-160))}`);
r = await post('sc.rebaseAbort', { repo: confRepo });
check('sc.rebaseAbort succeeds', r.ok === true, `err=${JSON.stringify(r.error)}`);
const rebaseClean = !existsSync(join(confRepo, '.git', 'rebase-merge'))
  && !existsSync(join(confRepo, '.git', 'rebase-apply'));
const statusPorcelain = git(confRepo, 'status', '--porcelain');
check('rebase --abort leaves no rebase state and a clean tree',
  rebaseClean && statusPorcelain === '',
  `restate=${rebaseClean} status=${JSON.stringify(statusPorcelain)}`);

// --- sc.run / sc.rebaseAbort guards ---
r = await post('sc.run', { repo: 'relative/path' });
check('sc.run rejects non-absolute repo', r.ok === false && r.error?.code === 'bad-request');
r = await post('sc.procOutput', { sessionId: 42, since: 'x' });
check('sc.procOutput requires a string sessionId', r.ok === false && r.error?.code === 'bad-request');

const failed = results.filter((entry) => !entry.ok);
for (const dir of [process.env.DSH_TOOLS_HOME, root]) {
  if (failed.length === 0) { try { rmSync(dir, { recursive: true, force: true }); } catch { /* leave tmp */ } }
}
console.log(failed.length === 0 ? 'ALL CHECKS PASSED' : `${failed.length} CHECK(S) FAILED`);
process.exit(failed.length === 0 ? 0 : 1);
