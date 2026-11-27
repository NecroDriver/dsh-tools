#!/usr/bin/env node
// Renders the dsh-tools client ScPanel against a mini hooks-capable React
// and a minimal DOM stub, then exercises the source-control flows:
// scan → diff → partial selection → AI message → commit → push → Escape.
// Run with any Node 18+:  node scripts/test-client-render.cjs
'use strict';

const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const ROOT = path.resolve(__dirname, '..');
const SOURCE = fs.readFileSync(path.join(ROOT, 'client.js'), 'utf8');

// ---------------------------------------------------------------- fake DOM
function fakeElement(tag) {
  return {
    tagName: tag,
    style: {},
    dataset: {},
    children: [],
    parentElement: null,
    listeners: {},
    className: '',
    _text: '',
    isConnected: true,
    offsetHeight: 0,
    offsetWidth: 0,
    contains(node) {
      if (node === null || node === undefined || typeof node !== 'object') return false;
      if (node === this) return true;
      return this.children.some((child) => typeof child.contains === 'function' && child.contains(node));
    },
    getBoundingClientRect() { return { top: 280, left: 8, bottom: 308, right: 56, width: 48, height: 28 }; },
    append(...nodes) {
      for (const node of nodes) if (node && typeof node === 'object') node.parentElement = this;
      this.children.push(...nodes);
    },
    appendChild(node) { this.children.push(node); node.parentElement = this; },
    insertBefore(node, ref) {
      const i = ref ? this.children.indexOf(ref) : -1;
      if (i === -1) this.children.push(node); else this.children.splice(i, 0, node);
      node.parentElement = this;
    },
    replaceChildren(...nodes) {
      for (const child of this.children) child.parentElement = null;
      this.children.length = 0;
      for (const node of nodes) { this.children.push(node); node.parentElement = this; }
    },
    remove() {
      const p = this.parentElement;
      if (p != null) { const i = p.children.indexOf(this); if (i !== -1) p.children.splice(i, 1); }
      this.parentElement = null;
    },
    setAttribute() {},
    removeAttribute() {},
    addEventListener(type, fn) { (this.listeners[type] ??= []).push(fn); },
    removeEventListener() {},
    querySelector() { return null; },
    querySelectorAll() { return []; },
    dispatchEvent() {},
    focus() {},
    closest() { return null; },
    get firstChild() { return this.children[0] ?? null; },
    get textContent() { return this._text; },
    set textContent(v) { this._text = String(v ?? ''); this.children.length = 0; },
    get innerText() { return ''; },
  };
}

const windowListeners = {};
const documentListeners = {};
const execCommands = [];
const moInstances = [];   // MutationObserver stub instances (phrase-row re-insert guard)
const sandbox = {
  console,
  setTimeout: (fn) => { queueMicrotask(fn); return 0; },
  clearTimeout() {},
  window: null,
  document: {
    getElementById: () => null,
    createElement: fakeElement,
    head: fakeElement('head'),
    body: fakeElement('body'),
    documentElement: { lang: 'zh' },
    addEventListener: (type, fn) => { (documentListeners[type] ??= []).push(fn); },
    removeEventListener: () => {},
    querySelector: () => null,
    execCommand: (...args) => { execCommands.push(args); return true; },
  },
  MutationObserver: class {
    constructor(cb) { this.cb = cb; moInstances.push(this); }
    observe() { this.live = true; }
    disconnect() { this.live = false; }
    trigger() { if (this.live !== false) this.cb([]); }
  },
  Node: { TEXT_NODE: 3, ELEMENT_NODE: 1 },
  InputEvent: class {},
  getSelection: () => null,
};
sandbox.window = {
  innerWidth: 320,
  innerHeight: 800,
  addEventListener: (type, fn) => { (windowListeners[type] ??= []).push(fn); },
  removeEventListener: () => {},
};

// ------------------------------------------------------------- mini React
const FRAGMENT = Symbol('dsh-test-fragment');
class MiniReact {
  constructor(schedule) {
    this.schedule = schedule;
    this.instances = new Map();
    this.Fragment = FRAGMENT;
  }
  createElement(type, props, ...children) {
    const flat = [];
    const push = (child) => {
      if (child === null || child === undefined || child === false || child === true) return;
      if (Array.isArray(child)) { child.forEach(push); return; }
      flat.push(child);
    };
    children.forEach(push);
    return { type, props: props ?? {}, children: flat };
  }
  hookSlot(kind, init) {
    const inst = this.current;
    if (!inst.slots.has(inst.index)) inst.slots.set(inst.index, { kind, value: init });
    const slot = inst.slots.get(inst.index);
    inst.index += 1;
    return slot;
  }
  useState(init) {
    const slot = this.hookSlot('state', typeof init === 'function' ? init() : init);
    return [slot.value, (update) => {
      slot.value = typeof update === 'function' ? update(slot.value) : update;
      this.schedule();
    }];
  }
  useRef(init) {
    const slot = this.hookSlot('ref', { current: init });
    return slot.value;
  }
  useMemo(fn, deps) {
    const slot = this.hookSlot('memo', null);
    if (slot.value === null || !shallowEqual(slot.value.deps, deps)) slot.value = { deps, value: fn() };
    return slot.value.value;
  }
  useCallback(fn, deps) { return this.useMemo(() => fn, deps); }
  useEffect(fn, deps) {
    const slot = this.hookSlot('effect', null);
    slot.value = { fn, deps };
  }
  useSyncExternalStore(subscribe, getSnapshot) {
    const slot = this.hookSlot('store', null);
    if (slot.value === null) {
      slot.value = { snapshot: getSnapshot() };
      try { subscribe(() => { slot.value.snapshot = getSnapshot(); this.schedule(); }); } catch { /* ignore */ }
    }
    return slot.value.snapshot;
  }
}

function shallowEqual(a, b) {
  if (!Array.isArray(a) || !Array.isArray(b) || a.length !== b.length) return false;
  for (let i = 0; i < a.length; i += 1) if (a[i] !== b[i]) return false;
  return true;
}

// Materialize: replace function components by their output; collect effects.
function materialize(react, element, keyPath, effects) {
  if (element === null || element === undefined || typeof element !== 'object') return element;
  if (typeof element.type === 'function') {
    const name = element.type.name || 'anon';
    const instKey = `${name}#${keyPath}`;
    let inst = react.instances.get(instKey);
    if (!inst) { inst = { index: 0, slots: new Map() }; react.instances.set(instKey, inst); }
    inst.index = 0;
    const prev = react.current;
    react.current = inst;
    let out;
    try { out = element.type(element.props); } finally { react.current = prev; }
    return materialize(react, out, keyPath, effects);
  }
  const children = element.children.map((child, i) => materialize(react, child, `${keyPath}/${i}`, effects));
  // Function refs on host nodes: hand the component a live stand-in node so
  // imperative escapes (popover anchors) can be driven from the test.
  if (typeof element.props.ref === 'function') {
    const standIn = fakeElement(String(element.type));
    element.props.ref(standIn);
  }
  return { type: element.type, props: element.props, children };
}

function findAll(node, pred, found = []) {
  if (node === null || node === undefined || typeof node !== 'object') return found;
  if (typeof node.type === 'string' && pred(node)) found.push(node);
  for (const child of node.children ?? []) findAll(child, pred, found);
  return found;
}
const byClass = (cls) => (node) => String(node.props.className ?? '').split(/\s+/).includes(cls);

// ------------------------------------------------------------------ run it
let pending = false;
const rerenders = [];
const schedule = () => {
  if (pending) return;
  pending = true;
  queueMicrotask(() => { pending = false; for (const fn of rerenders.splice(0)) fn(); });
};
const react = new MiniReact(schedule);

const calls = [];
let lastRunKind = 'pull';
let procPollCount = 0;
const stubs = {
  'settings.get': () => ({ ok: true, value: { settings: {
    features: { moreMenu: true, generate: true, optimize: true, history: true, sc: true, phrases: true },
    model: { provider: '', model: '' },
    sc: { roots: [] },
    phrases: ['使用 skill 优化', '继续上面的方案'],
  } } }),
  'models.list': () => ({ ok: true, value: { providers: [], defaultSelection: null, override: null } }),
  'settings.set': (payload) => ({ ok: true, value: { settings: {
    features: { moreMenu: true, generate: true, optimize: true, history: true, sc: true, phrases: true },
    model: { provider: '', model: '' },
    sc: { roots: [] },
    phrases: Array.isArray(payload?.phrases) ? payload.phrases : [],
  } } }),
  'sc.repos': () => ({ ok: true, value: { roots: [], repos: [
    { id: 'C:/t/repo-a', name: 'repo-a', path: 'C:/t/repo-a' },
  ], truncated: false } }),
  'sc.status': () => ({ ok: true, value: { repo: 'C:/t/repo-a', branch: 'main', files: [
    { path: 'src/new.js', status: 'A', staged: false, orig: null },
    { path: 'src/mod.js', status: 'M', staged: false, orig: null },
    { path: 'src/gone.js', status: 'D', staged: true, orig: null },
  ], truncated: false } }),
  'sc.diff': () => ({ ok: true, value: { diff: 'diff --git a/f.txt b/f.txt\nindex 111..222 100644\n--- a/f.txt\n+++ b/f.txt\n@@ -1,2 +1,2 @@\n-hello\n+world\n ctx' } }),
  'sc.commitMessage': () => ({ ok: true, value: { draft: 'feat: add things', lang: 'zh' } }),
  'sc.commit': () => ({ ok: true, value: { commit: 'abc1234', count: 1 } }),
  'sc.push': () => ({ ok: true, value: { output: 'pushed' } }),
  'sc.pull': () => ({ ok: true, value: { repo: 'C:/t/repo-a', output: 'Already up to date.' } }),
  'sc.prisma': () => ({ ok: true, value: { repo: 'C:/t/repo-a', ran: ['prisma:generate', 'prisma:push'], output: 'done' } }),
  // v0.8.0 interactive sessions: sc.run mints sessionId; procOutput feeds
  // one "partial" chunk then completes, so the poll chain (setTimeout runs
  // as a microtask here) exercises incremental appends before resolving.
  'sc.run': (payload) => {
    lastRunKind = payload?.kind === 'prisma' ? 'prisma' : 'pull';
    return {
      ok: true,
      value: {
        sessionId: 'sess-1',
        repo: payload?.repo,
        kind: lastRunKind,
        command: lastRunKind === 'prisma'
          ? 'pnpm run prisma:generate && pnpm run prisma:push'
          : 'git pull --rebase --autostash',
      },
    };
  },
  'sc.procOutput': () => {
    procPollCount += 1;
    if (procPollCount % 2 === 1) {
      return { ok: true, value: { output: 'partial', total: 7, done: false, exitCode: null, kind: lastRunKind } };
    }
    return { ok: true, value: { output: ' + done', total: 17, done: true, exitCode: 0, kind: lastRunKind } };
  },
  'sc.procInput': () => ({ ok: true, value: {} }),
  'sc.procKill': () => ({ ok: true, value: {} }),
  'sc.rebaseAbort': () => ({ ok: true, value: { repo: 'C:/t/repo-a', output: '' } }),
  'usage.today': () => ({ ok: true, value: {
    timeZone: 'Asia/Shanghai',
    today: { day: '2026-11-23', isToday: true, inputTokens: 180_000, outputTokens: 42_000, cacheReadTokens: 980_000, cacheWriteTokens: 32_500, requests: 17, total: 1_234_500 },
    days: Array.from({ length: 14 }, (_, i) => ({ day: `2026-11-${String(10 + i)}`, isToday: i === 13, inputTokens: 0, outputTokens: 0, cacheReadTokens: 0, cacheWriteTokens: 0, requests: 0, total: i === 13 ? 1_234_500 : i === 12 ? 40_000 : 0 })),
    activeSessions: 4,
  } }),
};
const call = async (method, payload) => {
  calls.push({ method, payload });
  await new Promise((resolve) => setImmediate(resolve));
  return (stubs[method] ?? (() => ({ ok: false, error: { code: 'unknown', message: method, details: {} } })))(payload);
};

const registrations = [];
const fibers = [];       // ctx.inject(names, cb) captures
const fakeTabs = {       // sidebarRightTabs registry stub
  defs: [],
  disposed: [],
  register(def) { this.defs.push(def); const h = { def }; this.disposed.push(h); return () => { h.gone = true; }; },
};
const ctx = {
  get: () => undefined,
  connection: { rpc: { call: (channel, key, envelope) => call(envelope.method, envelope.payload) } },
  inject: (names, cb) => {
    const fiber = { dispose() { this.disposed = true; } };
    fibers.push({ names, cb, fiber });
    return fiber;
  },
  slots: {
    register: (reg, render) => { registrations.push({ slot: reg.name, ...reg, render }); return () => {}; },
    inject: (name, setup) => setup(),
  },
};

const captured = [];
sandbox.window.__ModuleLoader__ = { load: (definition) => { captured.push(definition); } };
vm.createContext(sandbox);
vm.runInContext(SOURCE, sandbox, { filename: 'client.js' });
if (captured.length !== 1) { console.error('FAIL loader captured', captured.length); process.exit(1); }
const mod = captured[0].factory((name) => {
  if (name === 'react') return react;
  throw new Error(`unexpected require: ${name}`);
});

const check = (label, condition) => {
  if (!condition) { console.error(`FAIL: ${label}`); process.exitCode = 1; }
  else console.log(`ok - ${label}`);
};

const dispose = mod.apply(ctx);

// 0) guide type registration via the sidebarRightTabs capture
const tabsFiber = fibers.find((f) => f.names.includes('sidebarRightTabs'));
check('sidebarRightTabs fiber requested', tabsFiber !== undefined);
tabsFiber.cb({ sidebarRightTabs: fakeTabs });
const sessionsFiber = fibers.find((f) => f.names.includes('sessions'));
check('sessions fiber requested for root hints', sessionsFiber !== undefined);
// Stable snapshot object — the real store caches; a fresh object per call
// would look like an ever-changing snapshot to useSyncExternalStore.
const fakeSessionsSnapshot = {
  byId: {
    s1: { id: 's1', cwd: 'D:/Workspace/personal/reader', retainedBy: { mainView: 2 } },
    s2: { id: 's2', cwd: 'D:/Workspace/personal', retainedBy: {} },
  },
};
sessionsFiber.cb({ sessions: { list: { getSnapshot: () => fakeSessionsSnapshot } } });
check('tab type registered once', fakeTabs.defs.length === 1);
const def = fakeTabs.defs[0];
check('type id/kind', def?.id === 'dsh-tools-sc' && def?.kind === 'dsh-tools-sc');
check('guide entry shape', def?.guide?.[0]?.id === 'sc' && def.guide[0].order === 5
  && typeof def.guide[0].title === 'function' && typeof def.guide[0].description === 'function'
  && typeof def.guide[0].icon === 'function');

const paneTab = registrations.find((r) => r.slot === 'sidebar.right.pane.tab' && r.key === 'dsh-tools-sc');
check('pane tab body registered', paneTab !== undefined);
const usageReg = registrations.find((r) => r.slot === 'sidebar.footer.action');
check('usage chip registered in sidebar footer', usageReg?.id === 'dsh-tools-usage'
  && usageReg.order === 5 && typeof usageReg.render === 'function'
  && typeof usageReg.label === 'function' && usageReg.label() === '今日 Token 用量');
check('no shell overlay drawer', registrations.find((r) => r.slot === 'shell.overlay') === undefined);

const settle = () => new Promise((resolve) => setImmediate(resolve));
// Effects run async work that writes hook state; materialize again after.
// paneTab.render is the component itself, so wrap it in an element to give
// materialize a function-type node (it installs the hooks context).
const render = () => materialize(react, react.createElement(paneTab.render, {}), '', []);
const runEffects = async () => {
  const fns = [];
  for (const inst of react.instances.values()) {
    for (const slot of inst.slots.values()) if (slot.kind === 'effect' && slot.value?.fn) fns.push(slot.value.fn);
  }
  for (const fn of fns) { try { fn(); } catch { /* effect error surfaces on settle */ } }
  await settle(); await settle();
};

(async () => {
  // 1) tab body mounts and loads repositories immediately
  let tree = render(); await runEffects(); tree = render();
  const step = async () => { tree = render(); await runEffects(); tree = render(); };
  check('tab body rendered', findAll(tree, byClass('dsh-tools-scTab'))[0] !== undefined);
  const reposCall = calls.find((c) => c.method === 'sc.repos');
  check('sc.repos hints only the main-view session cwd (m03593)',
    JSON.stringify(reposCall?.payload?.roots) === JSON.stringify(['D:/Workspace/personal/reader']),
    `roots=${JSON.stringify(reposCall?.payload?.roots)}`);
  check('repo group shown', findAll(tree, byClass('dsh-tools-scRepoName'))[0]?.children[0] === 'repo-a');
  check('branch chip', findAll(tree, byClass('dsh-tools-scBranch'))[0]?.children[0] === 'main');
  // Default collapsed (user request 2026-11-23): no file rows until expanded.
  check('repo group collapsed by default',
    findAll(tree, (n) => byClass('dsh-tools-scChev')(n) && String(n.props.className).includes('is-open')).length === 0
    && findAll(tree, byClass('dsh-tools-scFiles')).length === 0
    && findAll(tree, byClass('dsh-tools-scFile')).length === 0);
  findAll(tree, byClass('dsh-tools-scGroupHeadMain'))[0].props.onClick();
  await settle();
  await step();
  check('clicking the group head expands it', findAll(tree, byClass('dsh-tools-scFiles')).length === 1);
  const files = findAll(tree, byClass('dsh-tools-scFile'));
  check('three file rows', files.length === 3);
  const badges = findAll(tree, byClass('dsh-tools-scBadge')).map((b) => b.children[0]).sort().join(',');
  check('badges A,D,M', badges === 'A,D,M');

  // 2) diff toggles
  const mains = findAll(tree, byClass('dsh-tools-scFileMain'));
  mains[0].props.onClick();
  await settle();
  await step();
  const diff = findAll(tree, byClass('dsh-tools-scDiff'))[0];
  check('diff rendered', diff !== undefined && diff.children.some((line) => line.children[0] === '+world'));
  check('unified view filters git preamble (v0.7.10)',
    diff !== undefined && diff.children.every((line) => line.children[0] !== 'diff --git a/f.txt b/f.txt'
      && line.children[0] !== '--- a/f.txt' && line.children[0] !== '+++ b/f.txt'));

  // 2b) diff layout toggle (v0.7.9): unified default → split → back.
  const styleBtn = () => findAll(tree, byClass('dsh-tools-scMini'))
    .find((b) => b.children.some((c) => c.children?.[0] === '纵向' || c.children?.[0] === '横向'));
  check('diff style toggle present (unified)', styleBtn() !== undefined
    && styleBtn().props['aria-pressed'] === 'false');
  check('split view absent before toggle', findAll(tree, byClass('dsh-tools-scDiffSplit')).length === 0);
  styleBtn().props.onClick();
  await settle(); await step();
  const split = findAll(tree, byClass('dsh-tools-scDiffSplit'))[0];
  check('split view rendered', split !== undefined);
  check('split view filters git preamble (v0.7.10)',
    split !== undefined && split.children.every((cell) => cell.children?.[0] !== 'diff --git a/f.txt b/f.txt'
      && cell.children?.[0] !== '--- a/f.txt'));
  check('split hunk header kept', findAll(tree, byClass('dsh-tools-dh'))[0]?.children[0] === '@@ -1,2 +1,2 @@');
  const splitCells = findAll(tree, byClass('dsh-tools-dc'));
  const delCell = splitCells.find((c) => String(c.props.className).includes('is-del'));
  const addCell = splitCells.find((c) => String(c.props.className).includes('is-add'));
  check('split pairs del/add rows', delCell?.children[0] === 'hello' && addCell?.children[0] === 'world');
  const nos = findAll(tree, byClass('dsh-tools-dno')).map((n) => n.children[0]).join(',');
  check('split line numbers follow hunk header', nos === '1,1,2,2', `nos=${nos}`);
  check('toggle pressed in split mode', styleBtn()?.props['aria-pressed'] === 'true');
  styleBtn().props.onClick();
  await settle(); await step();
  check('back to unified', findAll(tree, byClass('dsh-tools-scDiffSplit')).length === 0
    && findAll(tree, byClass('dsh-tools-scDiff')).length === 1);

  // 3) partial selection → commit bar
  const boxes = findAll(tree, (n) => n.type === 'input' && n.props.type === 'checkbox');
  check('three checkboxes', boxes.length === 3);
  boxes[1].props.onChange();
  await settle();
  await step();
  check('commit bar appears', findAll(tree, byClass('dsh-tools-scCommitBar')).length === 1);
  check('selection count', findAll(tree, byClass('dsh-tools-scCount'))[0]?.children[0] === '3');

  // 4) AI message
  const genBtn = findAll(tree, byClass('dsh-tools-scBtn')).find((b) => b.children.some((c) => c.children?.[0] === 'AI 生成'));
  check('generate button present', genBtn !== undefined);
  genBtn.props.onClick();
  await settle(); await settle();
  await step();
  const msgBox = findAll(tree, byClass('dsh-tools-scMsg'))[0];
  check('message filled', msgBox?.props.value === 'feat: add things');
  const msgCall = calls.find((c) => c.method === 'sc.commitMessage');
  check('commitMessage got selection', JSON.stringify(msgCall?.payload.files) === JSON.stringify(['src/mod.js']));

  // 5) commit with the AI message
  // v0.8.3: 提交并推送 took over is-primary; v0.8.4 gave plain 提交 an icon
  // too, so locate it by its span text child like the other buttons.
  const commitBtn = findAll(tree, byClass('dsh-tools-scBtn'))
    .find((b) => b.children.some((c) => c.children?.[0] === '提交'));
  check('commit button present', commitBtn !== undefined);
  commitBtn.props.onClick();
  await settle(); await settle();
  await step();
  const commitCall = calls.find((c) => c.method === 'sc.commit');
  check('commit sent only selected file', JSON.stringify(commitCall?.payload.files) === JSON.stringify(['src/mod.js']));
  check('commit message forwarded', commitCall?.payload.message === 'feat: add things');
  check('committed note shows hash', findAll(tree, (n) => n.children[0] === '已提交 abc1234').length === 1);

  // 5b) v0.8.3 提交并推送 — one click fires sc.commit then sc.push
  const reboxes = findAll(tree, (n) => n.type === 'input' && n.props.type === 'checkbox');
  reboxes[0].props.onChange();
  await settle();
  await step();
  const combinedBtn = findAll(tree, byClass('dsh-tools-scBtn'))
    .find((b) => b.children.some((c) => c.children?.[0] === '提交并推送'));
  check('commit-and-push button present as primary', combinedBtn !== undefined
    && String(combinedBtn.props.className).includes('is-primary'));
  const beforeCombined = calls.length;
  combinedBtn.props.onClick();
  await settle(); await settle(); await settle();
  await step();
  const combinedCommit = calls.slice(beforeCombined).find((c) => c.method === 'sc.commit');
  const combinedPush = calls.slice(beforeCombined).find((c) => c.method === 'sc.push');
  check('commit-and-push: one click fires commit then push',
    combinedCommit !== undefined && combinedPush !== undefined
    && calls.indexOf(combinedCommit) < calls.indexOf(combinedPush));
  check('commit-and-push final note', findAll(tree, (n) => n.children[0] === '已提交 abc1234 · 已推送').length === 1);

  // 6) push from the group header
  const pushBtn = findAll(tree, byClass('dsh-tools-scIconBtn')).find((b) => b.props.title === '推送');
  check('push button present', pushBtn !== undefined);
  pushBtn.props.onClick();
  await settle(); await settle();
  check('push called', calls.some((c) => c.method === 'sc.push'));

  // 6b) v0.7.5 per-group update buttons: 更新代码 / 更新数据库 icons
  //     (v0.8.0: both now drive interactive sc.run sessions + a console)
  const pullBtn = findAll(tree, byClass('dsh-tools-scIconBtn'))
    .find((b) => b.props.title === '更新代码：git pull --rebase --autostash');
  check('group update-code button present', pullBtn !== undefined);
  pullBtn.props.onClick();
  await settle(); await settle(); await settle();
  // Sample BEFORE runEffects()/step(): this harness re-fires the mount
  // effect, whose loadAll() intentionally resets the console sessions
  // (a rescan resets the panel in production too).
  tree = render();
  check('sc.run called with repo path + kind pull (v0.8.0)',
    calls.some((c) => c.method === 'sc.run' && c.payload?.repo === 'C:/t/repo-a' && c.payload?.kind === 'pull'));
  check('console block rendered (v0.8.0)', findAll(tree, byClass('dsh-tools-scConsole')).length === 1);
  const consoleOut = findAll(tree, byClass('dsh-tools-scConsoleOut'))[0];
  check('console streams incremental chunks', String(consoleOut?.children[0] ?? '').includes('partial')
    && String(consoleOut?.children[0] ?? '').includes(' + done'));
  check('console state shows exit 0', findAll(tree, byClass('dsh-tools-scConsoleState'))[0]?.children[0] === '退出码 0');
  check('console copy action present',
    findAll(tree, byClass('dsh-tools-scMini')).some((b) => b.children.some((c) => c?.children?.[0] === '复制输出')));
  await step();
  check('pull success note', findAll(tree, (n) => n.children[0] === '代码已更新').length === 1);
  const dbBtn = findAll(tree, byClass('dsh-tools-scIconBtn'))
    .find((b) => b.props.title === '更新数据库：pnpm prisma:generate → pnpm prisma:push');
  check('group update-database button present', dbBtn !== undefined);
  dbBtn.props.onClick();
  await settle(); await settle(); await settle();
  check('sc.run called with repo path + kind prisma (v0.8.0)',
    calls.some((c) => c.method === 'sc.run' && c.payload?.repo === 'C:/t/repo-a' && c.payload?.kind === 'prisma'));

  // 6c) v0.7.5 top update bar: both buttons sweep every listed repository
  const barButtons = findAll(tree, byClass('dsh-tools-scMini'));
  const topPull = barButtons.find((b) => b.children.some((c) => c?.children?.[0] === '更新代码'));
  const topDb = barButtons.find((b) => b.children.some((c) => c?.children?.[0] === '更新数据库'));
  check('top update bar shows both buttons', topPull !== undefined && topDb !== undefined);
  const pullsBefore = calls.filter((c) => c.method === 'sc.run').length;
  topPull.props.onClick();
  await settle(); await settle(); await settle();
  // Sample BEFORE runEffects(): this fake harness re-fires every effect on
  // each step(), which re-runs loadAll() and its intentional batchNote
  // reset — real React only re-runs that effect on a workspace switch.
  tree = render();
  check('batch pull swept the repo', calls.filter((c) => c.method === 'sc.run').length === pullsBefore + 1);
  check('batch summary note', findAll(tree, byClass('dsh-tools-scBatchNote'))[0]?.children[0] === '代码已更新 1');

  // 7) quick phrases: hidden overlay host injects an in-card row above the
  //    draft editor; pills build from the store and click inserts at the caret
  const phraseReg = registrations.find((r) => r.slot === 'conversation.input.overlay' && r.id === 'dsh-tools-phrases');
  check('phrase host slot registered', phraseReg !== undefined);
  const phraseTree = materialize(react, react.createElement(phraseReg.render, {}), 'ph', []);
  const hostSpan = findAll(phraseTree, byClass('dsh-tools-phraseHost'))[0];
  check('bootstrap host renders hidden', hostSpan !== undefined
    && hostSpan.props.style?.display === 'none');
  // Simulate the real DOM chain: host span -> slot-entry wrapper -> overlay
  // anchor -> composer card, with the draft editor nested one level inside
  // the card. The wrapper level is what broke v0.6.7's fixed "two hops up"
  // card lookup; attachBootstrap must find the card via closest().
  const fakeEd = fakeElement('div');
  const fakeEdHost = fakeElement('div'); fakeEdHost.appendChild(fakeEd);
  const fakeCardEl = fakeElement('div');
  fakeCardEl.querySelector = (sel) => (String(sel).includes('contenteditable') ? fakeEd : null);
  const fakeAnchorEl = fakeElement('div');
  const fakeEntryWrap = fakeElement('div');
  const fakeSpanEl = fakeElement('span');
  fakeSpanEl.closest = (sel) => (sel === '[data-composer-card]' ? fakeCardEl : null);
  fakeEntryWrap.appendChild(fakeSpanEl);
  fakeAnchorEl.appendChild(fakeEntryWrap);
  fakeCardEl.appendChild(fakeAnchorEl);
  fakeCardEl.appendChild(fakeEdHost);
  hostSpan.props.ref(fakeSpanEl);
  const phraseRow = fakeCardEl.children.find((c) => c.className === 'dsh-tools-phraseBar');
  check('in-card phrase row inserted above the draft editor',
    phraseRow !== undefined && phraseRow.parentElement === fakeCardEl
    && fakeCardEl.children.indexOf(phraseRow) < fakeCardEl.children.indexOf(fakeEdHost));
  check('two phrase pills built', phraseRow !== undefined && phraseRow.children.length === 2
    && phraseRow.children[0].textContent === '使用 skill 优化'
    && phraseRow.style.display === '');
  execCommands.length = 0;
  const pillBtn = phraseRow.children[0];
  pillBtn.closest = (sel) => (sel === '[data-composer-card]' ? fakeCardEl : null);
  pillBtn.listeners.click[0]();
  check('pill click inserts text at caret (no selectAll)',
    execCommands.length === 1 && execCommands[0][0] === 'insertText' && execCommands[0][2] === '使用 skill 优化');

  // 7b) re-insert guard: a React re-render that drops the row puts it back
  const guardObserver = moInstances[moInstances.length - 1];
  check('row guard watches the card', guardObserver !== undefined && guardObserver.live === true);
  fakeCardEl.children.splice(fakeCardEl.children.indexOf(phraseRow), 1);
  phraseRow.parentElement = null;
  guardObserver.trigger();
  check('dropped row re-inserts above the draft editor',
    fakeCardEl.children.indexOf(phraseRow) !== -1
    && fakeCardEl.children.indexOf(phraseRow) < fakeCardEl.children.indexOf(fakeEdHost));

  // 8) settings panel: phrases editor round-trips through settings.set
  const settingsReg = registrations.find((r) => r.slot === 'settings.section' && r.id === 'dsh-tools');
  check('settings panel registered', settingsReg !== undefined);
  let panelTree = materialize(react, react.createElement(settingsReg.render, {}), 'sp', []);
  await runEffectsPanel(panelTree);
  panelTree = materialize(react, react.createElement(settingsReg.render, {}), 'sp', []);
  const phraseInputs = findAll(panelTree, byClass('dsh-tools-phraseInput'));
  check('phrase editor shows stored phrases', phraseInputs.length === 2 && phraseInputs[0].props.value === '使用 skill 优化');
  const phraseAddBtn = findAll(panelTree, byClass('dsh-tools-scBtn')).find((b) => b.children.some((c) => c.children?.[0] === '添加常用语'));
  check('phrase add button present', phraseAddBtn !== undefined);

  // 8b) phrase editor round-trip drives the live row (store sync)
  const removeBtns = findAll(panelTree, byClass('dsh-tools-scRootRemove'));
  check('phrase remove buttons present', removeBtns.length === 2);
  removeBtns[0].props.onClick();
  panelTree = materialize(react, react.createElement(settingsReg.render, {}), 'sp', []);
  findAll(panelTree, byClass('dsh-tools-primary'))[0].props.onClick();
  await settle(); await settle();
  const setCalls = calls.filter((c) => c.method === 'settings.set');
  const lastSet = setCalls[setCalls.length - 1];
  check('saving one removed phrase round-trips',
    Array.isArray(lastSet?.payload?.phrases) && lastSet.payload.phrases.length === 1);
  check('row shrinks to one pill', phraseRow.children.length === 1 && phraseRow.style.display === '');
  findAll(panelTree, byClass('dsh-tools-scRootRemove'))[0].props.onClick();
  panelTree = materialize(react, react.createElement(settingsReg.render, {}), 'sp', []);
  findAll(panelTree, byClass('dsh-tools-primary'))[0].props.onClick();
  await settle(); await settle();
  const setCalls2 = calls.filter((c) => c.method === 'settings.set');
  check('saving empty phrases round-trips',
    setCalls2[setCalls2.length - 1]?.payload?.phrases?.length === 0);
  check('empty store hides the in-card row', phraseRow.style.display === 'none');
  const addBtn2 = findAll(panelTree, byClass('dsh-tools-scBtn')).find((b) => b.children.some((c) => c?.children?.[0] === '添加常用语'));
  addBtn2.props.onClick();
  panelTree = materialize(react, react.createElement(settingsReg.render, {}), 'sp', []);
  findAll(panelTree, byClass('dsh-tools-phraseInput'))[0].props.onChange({ target: { value: '再来一条' } });
  panelTree = materialize(react, react.createElement(settingsReg.render, {}), 'sp', []);
  findAll(panelTree, byClass('dsh-tools-primary'))[0].props.onClick();
  await settle(); await settle();
  check('re-added phrase shows in the in-card row',
    phraseRow.style.display === '' && phraseRow.children.length === 1
    && phraseRow.children[0].textContent === '再来一条');

  // 7c) usage chip: wide row with formatted total, rail icon variant, and a
  //     body-level popover with buckets/chart/meta opened on click
  const usageTree = () => materialize(react, react.createElement(usageReg.render, { wide: true }), 'u', []);
  let chipTree = usageTree();
  await runEffectsPanel();           // mount effect -> usageStore.ensure()
  chipTree = usageTree();            // re-render with SWR data
  const chipBtn = findAll(chipTree, byClass('dsh-tools-usageChip'))[0];
  check('wide chip renders button with aria hooks', chipBtn !== undefined
    && chipBtn.props['aria-haspopup'] === 'dialog' && chipBtn.props['aria-expanded'] === 'false');
  const labelSpan = findAll(chipTree, byClass('dsh-tools-usageChipLabel'))[0];
  const valueSpan = findAll(chipTree, byClass('dsh-tools-usageChipValue'))[0];
  check('wide chip shows 今日 + compact total', labelSpan?.children?.[0] === '今日'
    && valueSpan?.children?.[0] === '1.23M');
  const usageCalls0 = calls.filter((c) => c.method === 'usage.today').length;
  check('mount fetched usage once', usageCalls0 === 1, `calls=${usageCalls0}`);
  const railTree = materialize(react, react.createElement(usageReg.render, { wide: false }), 'ur', []);
  const railBtn = findAll(railTree, byClass('dsh-tools-usageChip'))[0];
  check('rail variant is icon-only', String(railBtn?.props?.className).includes('is-rail')
    && findAll(railTree, byClass('dsh-tools-usageChipValue')).length === 0);
  // The button uses an object ref; point it at a live stand-in node so the
  // imperative popover anchor resolves during the click.
  const chipNode = fakeElement('button');
  chipBtn.props.ref.current = chipNode;
  chipBtn.props.onClick({ stopPropagation() {} });
  await settle(); await settle();
  const domFindAll = (node, pred, found = []) => {
    if (pred(node)) found.push(node);
    for (const child of node.children ?? []) domFindAll(child, pred, found);
    return found;
  };
  const byDomClass = (cls) => (node) => String(node?.className ?? '').split(/\s+/).includes(cls);
  const pop = sandbox.document.body.children.find((c) => c.className === 'dsh-tools-usagePop');
  check('click opens popover into body', pop !== undefined && pop.parentElement === sandbox.document.body);
  const popRows = pop ? pop.children : [];
  check('popover shows compact total', popRows.some((row) => (row._text ?? '').includes('1.23M')
    || (row.children ?? []).some((c) => (c._text ?? '').includes('1.23M'))));
  const bucketRows = domFindAll(pop, byDomClass('dsh-tools-usageBucketRow'));
  check('popover bucket rows', bucketRows.length === 4, `rows=${bucketRows.length}`);
  const chart = popRows.find(byDomClass('dsh-tools-usageChart'));
  const chartCols = chart ? domFindAll(chart, byDomClass('dsh-tools-usageCol')) : [];
  check('popover chart has 7 columns', chartCols.length === 7
    && String(chartCols[6].className).includes('is-today'));
  const chartTags = chart ? domFindAll(chart, byDomClass('dsh-tools-usageColTag')) : [];
  check('chart tags show weekdays + 今', chartTags.length === 7 && (chartTags[6]._text ?? '') === '今'
    && (chartTags[0]._text ?? '').length >= 1, `last=${chartTags[6]?._text}`);
  const tipEl = chart ? domFindAll(chart, byDomClass('dsh-tools-usageTip'))[0] : undefined;
  const tipOpen = () => String(tipEl?.className ?? '').includes('is-open');
  (chartCols[6]?.listeners?.mouseenter ?? []).forEach((fn) => fn());
  const tipText = tipEl ? domFindAll(tipEl, () => true).map((n) => n._text ?? '').join('|') : '';
  check('hover opens instant tooltip with values', tipOpen() && tipText.includes('1.23M')
    && tipText.includes('请求') && tipText.includes('今日'), `text=${tipText}`);
  (chartCols[6]?.listeners?.mouseleave ?? []).forEach((fn) => fn());
  check('leave closes tooltip', !tipOpen());
  check('popover meta mentions requests', domFindAll(pop, (n) => (n._text ?? '').includes('请求')).length > 0);
  const forced = calls.filter((c) => c.method === 'usage.today' && c.payload?.force === true);
  check('opening forces a refresh', forced.length >= 1, `forced=${forced.length}`);
  chipTree = usageTree();
  check('aria-expanded reflects open state',
    findAll(chipTree, byClass('dsh-tools-usageChip'))[0]?.props['aria-expanded'] === 'true');
  (windowListeners.keydown ?? []).forEach((fn) => fn({ key: 'Escape', stopPropagation() {} }));
  check('Escape closes the popover',
    sandbox.document.body.children.find((c) => c.className === 'dsh-tools-usagePop') === undefined);
  chipTree = usageTree();
  check('aria-expanded resets after close',
    findAll(chipTree, byClass('dsh-tools-usageChip'))[0]?.props['aria-expanded'] === 'false');

  // 9) dispose unregisters the type
  dispose();
  check('type disposed on unload', fakeTabs.disposed[0]?.gone === true);

  console.log(process.exitCode === 1 ? 'CLIENT RENDER TEST FAILED' : 'CLIENT RENDER TEST PASS');
})().catch((error) => { console.error('FAIL exception:', error); process.exit(1); });

// Run effects for a freshly materialized panel tree (same walker as runEffects
// but scoped to this render's effects collection).
async function runEffectsPanel() {
  const fns = [];
  for (const inst of react.instances.values()) {
    for (const slot of inst.slots.values()) if (slot.kind === 'effect' && slot.value?.fn) fns.push(slot.value.fn);
  }
  for (const fn of fns) { try { fn(); } catch { /* effect error surfaces on settle */ } }
  await new Promise((resolve) => setImmediate(resolve));
  await new Promise((resolve) => setImmediate(resolve));
}
