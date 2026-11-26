#!/usr/bin/env node
// Drives the dsh-tools client half (client.js) against a fake
// ctx.sidebarRight / ctx.sessions and checks the "open the right sidebar on
// new sessions" switch: which Sessions count as new, once per Session, the
// store adoption race, the focus hand-back and teardown.
// Run with any Node 18+:  node scripts/test-sidebar-auto-open.cjs
'use strict';

const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const ROOT = path.resolve(__dirname, '..');
const SOURCE = fs.readFileSync(path.join(ROOT, 'client.js'), 'utf8');
const realSetTimeout = globalThis.setTimeout;
const SIDEBAR_REGION = '[data-sidebar-right-session]';
const COMPOSER = '[data-composer-card] [contenteditable="true"]';

// ------------------------------------------------------------ fake DOM
function fakeElement(tag) {
  return {
    tagName: String(tag).toUpperCase(),
    isConnected: true,
    listeners: {},
    className: '',
    dataset: {},
    children: [],
    insideSidebar: false,
    closest(selector) { return this.insideSidebar && selector === SIDEBAR_REGION ? {} : null; },
    focus() { this.owner.activeElement = this; },
    addEventListener() {},
    removeEventListener() {},
    setAttribute() {},
    removeAttribute() {},
    querySelector() { return null; },
    querySelectorAll() { return []; },
    getBoundingClientRect() { return { top: 0, left: 0, width: 0, height: 0 }; },
    contains() { return false; },
  };
}

// One isolated client instance: its own sandbox, ctx, services and settings.
// `mounted` = the Session on screen when the plugin starts (NOTHING = no
// Session on screen yet, as on a page load).
const NOTHING = Symbol('nothing on screen');
function boot({ openSidebar = true, mounted = 'boot' } = {}) {
  const found = { [COMPOSER]: null };
  const document = {
    activeElement: null,
    body: null,
    documentElement: { lang: 'zh' },
    getElementById: () => null,
    createElement: fakeElement,
    head: null,
    addEventListener() {},
    removeEventListener() {},
    querySelector: (selector) => found[selector] ?? null,
    execCommand: () => true,
  };
  const sandbox = {
    console,
    // Fast clock: every scheduled step runs on the next millisecond.
    setTimeout: (fn, ms) => realSetTimeout(fn, Math.min(ms, 1)),
    clearTimeout: (id) => clearTimeout(id),
    queueMicrotask,
    window: null,
    document,
    MutationObserver: class { observe() {} disconnect() {} },
    Node: { TEXT_NODE: 3, ELEMENT_NODE: 1 },
    InputEvent: class {},
    getSelection: () => null,
  };
  for (const tag of ['body', 'head']) {
    document[tag] = fakeElement(tag);
    document[tag].owner = document;
  }
  document.activeElement = document.body;
  sandbox.window = {
    innerWidth: 1200,
    innerHeight: 800,
    addEventListener() {},
    removeEventListener() {},
  };
  const pane = fakeElement('div');
  pane.owner = document;
  pane.insideSidebar = true;

  // ctx.sidebarRight: the app's controller. toggleExpanded mirrors the real
  // one — it throws until the Session store is adopted and otherwise moves
  // DOM focus into the pane.
  const sidebar = {
    mountedId: mounted === NOTHING ? undefined : mounted,
    mountedListeners: new Set(),
    expanded: false,
    toggles: 0,
    failTimes: 0,
    mounted: {
      getSnapshot: () => sidebar.mountedId,
      subscribe: (fn) => { sidebar.mountedListeners.add(fn); return () => { sidebar.mountedListeners.delete(fn); }; },
    },
    isExpanded: () => sidebar.expanded,
    toggleExpanded() {
      sidebar.toggles += 1;
      if (sidebar.failTimes > 0) {
        sidebar.failTimes -= 1;
        throw new Error('sidebarRight: no session surface is mounted');
      }
      sidebar.expanded = !sidebar.expanded;
      document.activeElement = pane;
    },
  };
  // The app keeps the layout per Session and every new Session starts
  // collapsed; the fake has one flag, so switching Sessions resets it.
  const setMounted = (id) => {
    if (id !== sidebar.mountedId) sidebar.expanded = false;
    sidebar.mountedId = id;
    for (const fn of [...sidebar.mountedListeners]) fn(id);
  };

  // ctx.sessions.list: one snapshot object, replaced on every change.
  const HOUR = 3600_000;
  const rows = {
    boot: { id: 'boot', blank: true, updatedAt: Date.now() - HOUR },
    old: { id: 'old', blank: false, updatedAt: Date.now() - 2 * HOUR },
  };
  const list = {
    phase: 'ready',
    ids: Object.keys(rows),
    byId: rows,
    listeners: new Set(),
  };
  const addSession = (row) => {
    list.byId[row.id] = row;
    list.ids = Object.keys(list.byId);
    for (const fn of [...list.listeners]) fn();
  };
  const sessions = {
    list: {
      getSnapshot: () => list,
      subscribe: (fn) => { list.listeners.add(fn); return () => { list.listeners.delete(fn); }; },
    },
  };

  const calls = [];
  const stubs = {
    'settings.get': () => ({ ok: true, value: { settings: {
      features: { moreMenu: true, generate: true, optimize: true, history: true, sc: true, phrases: true, usage: true, openSidebar },
      model: { provider: '', model: '' },
      sc: { roots: [] },
      phrases: [],
    } } }),
    'debug.beacon': () => ({ ok: true, value: {} }),
  };
  const fibers = [];
  const ctx = {
    get: () => undefined,
    connection: { rpc: { call: (channel, key, envelope) => {
      calls.push(envelope.method);
      return Promise.resolve((stubs[envelope.method] ?? (() => ({ ok: false, error: { code: 'unknown', message: envelope.method, details: {} } })))(envelope.payload));
    } } },
    inject: (names, cb) => {
      const fiber = { disposed: false, dispose() { this.disposed = true; } };
      fibers.push({ names, cb, fiber });
      return fiber;
    },
    slots: { register: () => () => {}, inject: (_name, setup) => setup() },
  };

  const captured = [];
  sandbox.window.__ModuleLoader__ = { load: (definition) => { captured.push(definition); } };
  vm.createContext(sandbox);
  vm.runInContext(SOURCE, sandbox, { filename: 'client.js' });
  if (captured.length !== 1) throw new Error(`loader captured ${captured.length} definitions`);
  const mod = captured[0].factory((name) => { throw new Error(`unexpected require: ${name}`); });
  const dispose = mod.apply(ctx);
  const fiber = fibers.find((f) => f.names.includes('sidebarRight'));
  if (fiber === undefined) throw new Error('no sidebarRight fiber requested');
  fiber.cb({ sidebarRight: sidebar, sessions });

  const wait = async (ms) => new Promise((resolve) => realSetTimeout(resolve, ms));
  return { sidebar, setMounted, addSession, document, found, dispose, fiber, wait, calls };
}

const check = (label, condition, detail = '') => {
  if (!condition) { console.error(`FAIL: ${label}${detail ? ` (${detail})` : ''}`); process.exitCode = 1; }
  else console.log(`ok - ${label}`);
};

(async () => {
  // ---- switch on -------------------------------------------------------
  const app = boot();
  await app.wait(60);
  check('requests sidebarRight + sessions together', app.fiber.names.includes('sessions'));
  check('a Session already on screen when the plugin starts is left alone (even blank)',
    app.sidebar.toggles === 0 && app.sidebar.mountedListeners.size === 1);

  app.setMounted('old');
  await app.wait(60);
  check('existing Session with history: nothing', app.sidebar.toggles === 0);

  app.addSession({ id: 'n1', blank: true, updatedAt: Date.now() });
  await app.wait(60);
  check('a listed new Session that is not on screen yet: nothing', app.sidebar.toggles === 0);
  app.setMounted('n1');
  await app.wait(60);
  check('new blank Session on screen expands the sidebar once',
    app.sidebar.toggles === 1 && app.sidebar.expanded === true);

  // The user collapses it, leaves and comes back: it stays collapsed.
  app.sidebar.expanded = false;
  app.setMounted('old');
  await app.wait(60);
  app.setMounted('n1');
  await app.wait(60);
  check('collapsing sticks on revisit', app.sidebar.toggles === 1 && app.sidebar.expanded === false);

  app.setMounted('boot');
  await app.wait(60);
  check('a blank Session reached later counts as new', app.sidebar.toggles === 2 && app.sidebar.expanded === true);

  app.addSession({ id: 'c1', blank: true, updatedAt: Date.now(), origin: 'subagent', parentId: 'old' });
  app.setMounted('c1');
  await app.wait(60);
  check('subagent children never count', app.sidebar.toggles === 2);

  // First prompt already sent (hero composer → Session): still new.
  app.addSession({ id: 'n2', blank: false, updatedAt: Date.now() });
  await app.wait(40);
  app.setMounted('n2');
  await app.wait(60);
  check('a Session created after startup expands once its first prompt is in',
    app.sidebar.toggles === 3);

  // Selection before the list hears of it: classified when the row lands.
  app.setMounted('n2b');
  await app.wait(60);
  const beforeLate = app.sidebar.toggles;
  app.addSession({ id: 'n2b', blank: true, updatedAt: Date.now() });
  await app.wait(60);
  check('a Session on screen before it is listed expands once the row lands',
    beforeLate === 3 && app.sidebar.toggles === 4);

  // Listed later, but created long before this run: not new.
  app.addSession({ id: 'old2', blank: false, updatedAt: Date.now() - 3 * 3600_000 });
  await app.wait(40);
  app.setMounted('old2');
  await app.wait(60);
  check('a Session listed later but created earlier stays as it is', app.sidebar.toggles === 4);

  // ---- focus hand-back -------------------------------------------------
  const composer = fakeElement('div');
  composer.owner = app.document;
  app.found[COMPOSER] = composer;
  app.sidebar.expanded = false;
  app.document.activeElement = composer;
  app.addSession({ id: 'n3', blank: true, updatedAt: Date.now() });
  app.setMounted('n3');
  await app.wait(60);
  check('focus goes back to the element that had it (composer)',
    app.sidebar.toggles === 5 && app.document.activeElement === composer);

  const button = fakeElement('button');
  button.owner = app.document;
  app.document.activeElement = composer;
  app.sidebar.expanded = false;
  app.addSession({ id: 'n4', blank: true, updatedAt: Date.now() });
  app.setMounted('n4');
  await app.wait(60);
  check('focus goes back to the composer when nothing had it',
    app.sidebar.toggles === 6 && app.document.activeElement === composer);

  app.found[COMPOSER] = null;
  app.document.activeElement = button;
  app.sidebar.expanded = false;
  app.addSession({ id: 'n4b', blank: true, updatedAt: Date.now() });
  app.setMounted('n4b');
  await app.wait(60);
  check('focus goes back to the previously focused element without a composer',
    app.sidebar.toggles === 7 && app.document.activeElement === button);

  // Already expanded (layout restored): nothing to do, and never again.
  app.addSession({ id: 'n4c', blank: true, updatedAt: Date.now() });
  app.setMounted('n4c');
  app.sidebar.expanded = true;   // restored before the expand step runs
  await app.wait(60);
  app.sidebar.expanded = false;
  app.setMounted('old');
  await app.wait(40);
  app.setMounted('n4c');
  await app.wait(60);
  check('an already expanded Session is left alone and not re-opened later',
    app.sidebar.toggles === 7 && app.sidebar.expanded === false);

  // ---- store adoption race ---------------------------------------------
  app.sidebar.failTimes = 2;
  app.addSession({ id: 'n5', blank: true, updatedAt: Date.now() });
  app.setMounted('n5');
  await app.wait(150);
  check('retries while the Session store is not adopted yet',
    app.sidebar.toggles === 10 && app.sidebar.expanded === true, `toggles=${app.sidebar.toggles}`);

  // Leaving before it could open keeps the Session eligible.
  app.sidebar.expanded = false;
  app.sidebar.failTimes = 1e9;
  app.addSession({ id: 'n6', blank: true, updatedAt: Date.now() });
  app.setMounted('n6');
  await app.wait(40);
  app.setMounted('old');
  const afterLeave = app.sidebar.toggles;
  await app.wait(80);
  check('leaving mid-retry stops the attempts', app.sidebar.toggles === afterLeave, `toggles=${app.sidebar.toggles}`);
  app.setMounted('n6');
  await app.wait(600);
  check('coming back to it tries again', app.sidebar.toggles > afterLeave, `toggles=${app.sidebar.toggles}`);

  // Never adopted: the retry budget is bounded and the Session is dropped.
  const beforeBudget = app.sidebar.toggles;
  app.addSession({ id: 'n7', blank: true, updatedAt: Date.now() });
  app.setMounted('n7');
  // 25 retries: Windows timers fire no faster than every ~15 ms.
  await app.wait(600);
  const afterBudget = app.sidebar.toggles;
  check('gives up after the retry budget', afterBudget - beforeBudget === 25, `toggles=${afterBudget - beforeBudget}`);
  app.setMounted('old');
  await app.wait(40);
  app.setMounted('n7');
  await app.wait(150);
  check('a given-up Session is not retried on revisit', app.sidebar.toggles === afterBudget);

  // ---- teardown --------------------------------------------------------
  app.dispose();
  check('dispose releases the controller subscription', app.sidebar.mountedListeners.size === 0);
  app.setMounted('old');
  app.addSession({ id: 'n8', blank: true, updatedAt: Date.now() });
  app.setMounted('n8');
  await app.wait(60);
  check('nothing happens after unload', app.sidebar.toggles === afterBudget);

  // ---- DSH's boot selection: nothing on screen when the plugin starts ----
  const startup = boot({ mounted: NOTHING });
  await startup.wait(60);
  startup.setMounted('old');
  await startup.wait(60);
  check('booting into a Session with history keeps its layout', startup.sidebar.toggles === 0);
  startup.setMounted('boot');
  await startup.wait(60);
  check('a blank Session selected afterwards opens',
    startup.sidebar.toggles === 1 && startup.sidebar.expanded === true);
  startup.dispose();

  const fresh = boot({ mounted: NOTHING });
  await fresh.wait(60);
  fresh.setMounted('boot');
  await fresh.wait(60);
  check('booting into a blank Session opens the sidebar',
    fresh.sidebar.toggles === 1 && fresh.sidebar.expanded === true);
  fresh.sidebar.expanded = false;
  fresh.setMounted('old');
  await fresh.wait(60);
  fresh.setMounted('boot');
  await fresh.wait(60);
  check('collapsing it sticks there too', fresh.sidebar.toggles === 1 && fresh.sidebar.expanded === false);
  fresh.dispose();

  // The hero surface (no Session) when the plugin starts: same rule.
  const hero = boot({ mounted: NOTHING });
  await hero.wait(60);
  hero.setMounted(undefined);
  await hero.wait(60);
  hero.setMounted('boot');
  await hero.wait(60);
  check('nothing on screen, then a blank Session: opens',
    hero.sidebar.toggles === 1 && hero.sidebar.expanded === true);
  hero.dispose();

  // ---- switch off ------------------------------------------------------
  const off = boot({ openSidebar: false });
  await off.wait(60);
  off.addSession({ id: 'n1', blank: true, updatedAt: Date.now() });
  off.setMounted('n1');
  await off.wait(60);
  check('switch off: a new Session stays collapsed', off.sidebar.toggles === 0);
  off.dispose();

  const offBoot = boot({ openSidebar: false, mounted: NOTHING });
  await offBoot.wait(60);
  offBoot.setMounted('boot');
  await offBoot.wait(60);
  check('switch off: booting into a blank Session stays collapsed', offBoot.sidebar.toggles === 0);
  offBoot.dispose();

  console.log(process.exitCode === 1 ? 'SIDEBAR AUTO-OPEN TEST FAILED' : 'SIDEBAR AUTO-OPEN TEST PASS');
})().catch((error) => { console.error('FAIL exception:', error); process.exit(1); });
