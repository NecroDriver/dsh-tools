// dsh-tools — Source Control host-side integration test (real git).
// Builds throwaway repositories in a temp root, points the plugin at it via
// settings.sc.roots, then drives sc.* methods through the registered
// webServer route: scan, status, diff (tracked + synthetic untracked),
// partial commit (unselected changes must survive), log, AI commit message
// (fake llm captures the composed prompt), and file-path traversal guards.
import { spawnSync, execFileSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync, rmSync as rmFile, renameSync, readFileSync } from 'node:fs';
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

// --- push guard: no remote configured → git-error, not a crash ---
r = await post('sc.push', { repo: repoA });
check('sc.push without remote → git-error failure with details',
  r.ok === false && r.error?.code === 'git-error' && typeof r.error?.details?.repo === 'string',
  `code=${r.error?.code}`);

const failed = results.filter((entry) => !entry.ok);
for (const dir of [process.env.DSH_TOOLS_HOME, root]) {
  if (failed.length === 0) { try { rmSync(dir, { recursive: true, force: true }); } catch { /* leave tmp */ } }
}
console.log(failed.length === 0 ? 'ALL CHECKS PASSED' : `${failed.length} CHECK(S) FAILED`);
process.exit(failed.length === 0 ? 0 : 1);
