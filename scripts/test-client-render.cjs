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
    listeners: {},
    append(...nodes) { this.children.push(...nodes); },
    remove() {},
    setAttribute() {},
    removeAttribute() {},
    addEventListener(type, fn) { (this.listeners[type] ??= []).push(fn); },
    removeEventListener() {},
    querySelector() { return null; },
    querySelectorAll() { return []; },
    dispatchEvent() {},
    get innerText() { return ''; },
  };
}

const windowListeners = {};
const documentListeners = {};
const execCommands = [];
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
  MutationObserver: class { observe() {} disconnect() {} },
  Node: { TEXT_NODE: 3, ELEMENT_NODE: 1 },
  InputEvent: class {},
  getSelection: () => null,
};
sandbox.window = {
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
const stubs = {
  'settings.get': () => ({ ok: true, value: { settings: {
    features: { moreMenu: true, generate: true, optimize: true, history: true, sc: true, phrases: true },
    model: { provider: '', model: '' },
    sc: { roots: [] },
    phrases: ['使用 skill 优化', '继续上面的方案'],
  } } }),
  'models.list': () => ({ ok: true, value: { providers: [], defaultSelection: null, override: null } }),
  'sc.repos': () => ({ ok: true, value: { roots: [], repos: [
    { id: 'C:/t/repo-a', name: 'repo-a', path: 'C:/t/repo-a' },
  ], truncated: false } }),
  'sc.status': () => ({ ok: true, value: { repo: 'C:/t/repo-a', branch: 'main', files: [
    { path: 'src/new.js', status: 'A', staged: false, orig: null },
    { path: 'src/mod.js', status: 'M', staged: false, orig: null },
    { path: 'src/gone.js', status: 'D', staged: true, orig: null },
  ], truncated: false } }),
  'sc.diff': () => ({ ok: true, value: { diff: '+hello\n-world\n@@ -1 +1 @@\n ctx' } }),
  'sc.commitMessage': () => ({ ok: true, value: { draft: 'feat: add things', lang: 'zh' } }),
  'sc.commit': () => ({ ok: true, value: { commit: 'abc1234', count: 1 } }),
  'sc.push': () => ({ ok: true, value: { output: 'pushed' } }),
};
const call = async (method, payload) => {
  calls.push({ method, payload });
  await new Promise((resolve) => setImmediate(resolve));
  return (stubs[method] ?? (() => ({ ok: false, error: { code: 'unknown', message: method, details: {} } })))();
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
sessionsFiber.cb({ sessions: { list: { getSnapshot: () => ({ byId: {
  s1: { id: 's1', cwd: 'D:/Workspace/personal', retainedBy: { mainView: 2 } } ,
  s2: { id: 's2', cwd: 'D:/Workspace/personal', retainedBy: {} },
} }) } } });
check('tab type registered once', fakeTabs.defs.length === 1);
const def = fakeTabs.defs[0];
check('type id/kind', def?.id === 'dsh-tools-sc' && def?.kind === 'dsh-tools-sc');
check('guide entry shape', def?.guide?.[0]?.id === 'sc' && def.guide[0].order === 5
  && typeof def.guide[0].title === 'function' && typeof def.guide[0].description === 'function'
  && typeof def.guide[0].icon === 'function');

const paneTab = registrations.find((r) => r.slot === 'sidebar.right.pane.tab' && r.key === 'dsh-tools-sc');
check('pane tab body registered', paneTab !== undefined);
check('no sidebar footer entry', registrations.find((r) => r.slot === 'sidebar.footer.action') === undefined);
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
  check('sc.repos got session cwd hint', JSON.stringify(reposCall?.payload?.roots) === JSON.stringify(['D:/Workspace/personal']));
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
  check('diff rendered', diff !== undefined && diff.children.some((line) => line.children[0] === '+hello'));

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
  const commitBtn = findAll(tree, byClass('dsh-tools-scBtn is-primary'))[0]
    ?? findAll(tree, (n) => byClass('dsh-tools-scBtn')(n) && String(n.props.className).includes('is-primary'))[0];
  check('commit button present', commitBtn !== undefined);
  commitBtn.props.onClick();
  await settle(); await settle();
  await step();
  const commitCall = calls.find((c) => c.method === 'sc.commit');
  check('commit sent only selected file', JSON.stringify(commitCall?.payload.files) === JSON.stringify(['src/mod.js']));
  check('commit message forwarded', commitCall?.payload.message === 'feat: add things');
  check('committed note shows hash', findAll(tree, (n) => n.children[0] === '已提交 abc1234').length === 1);

  // 6) push from the group header
  const pushBtn = findAll(tree, byClass('dsh-tools-scIconBtn')).find((b) => b.props.title === '推送');
  check('push button present', pushBtn !== undefined);
  pushBtn.props.onClick();
  await settle(); await settle();
  check('push called', calls.some((c) => c.method === 'sc.push'));

  // 7) quick phrases: overlay bar registered, chips render, click inserts at caret
  const phraseReg = registrations.find((r) => r.slot === 'conversation.input.overlay' && r.id === 'dsh-tools-phrases');
  check('phrase bar slot registered', phraseReg !== undefined);
  const phraseTree = materialize(react, react.createElement(phraseReg.render, {}), 'ph', []);
  const chips = findAll(phraseTree, byClass('dsh-tools-phrase'));
  check('two phrase chips render', chips.length === 2 && chips[0].children[0] === '使用 skill 优化');
  execCommands.length = 0;
  const fakeEditor = { focus() {} };
  const fakeCard = { querySelector: () => fakeEditor };
  chips[0].props.onClick({ currentTarget: { closest: (sel) => (sel === '[data-composer-card]' ? fakeCard : null) } });
  check('chip click inserts text at caret (no selectAll)',
    execCommands.length === 1 && execCommands[0][0] === 'insertText' && execCommands[0][2] === '使用 skill 优化');

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
