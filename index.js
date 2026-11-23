// dsh-tools — desktop utilities for DeepSeek Harness (Host half).
//
// v0.1 capability: restart the desktop app. The Client half adds a "更多/More"
// button to the Windows caption menubar (the strip that renders 应用/编辑);
// its dropdown calls POST /api/dsh-tools { method:'restart' } on the route
// registered here. The handler verifies the desktop context (parent process is
// the DeepSeek Harness executable recorded in DSH_NODE_EXECUTABLE), then spawns
// a detached PowerShell helper that stops the app and this Host, waits for both
// to exit, and relaunches the executable. The helper logs to
// %TEMP%/dsh-tools-restart.log.
//
// Route shape mirrors dsh-im-notify's settings-rpc (production-proven in this
// profile): webServer `exact` registration as leg 1, connection.fetch as the
// hot-reload fallback leg, loopback-only admission, plus a same-origin
// Sec-Fetch-Site check so other local browser pages cannot trigger a restart.
//
// apply() returns immediately; the only async work rides per-request.

import { execFile, spawn } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { appendFileSync, existsSync, mkdirSync, readdirSync, readFileSync, renameSync, statSync, writeFileSync } from 'node:fs';
import { homedir, tmpdir } from 'node:os';
import { basename, isAbsolute, join, resolve } from 'node:path';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);

export const name = 'dsh-tools';

// Services this Host half touches. Cordis refuses undeclared ctx member reads
// (the exact failure was: cannot get property "connection" without inject) and
// only calls apply() once every listed service is live, so both legs below can
// access ctx.webServer / ctx.connection directly.
export const inject = ['webServer', 'connection'];

// Single source of truth for the running generation; dev.ping reports it so the
// Client can confirm a hot reload actually swapped this module.
const MODULE_VERSION = 'v0.6.4';

const RPC_KEY = 'dsh-tools';
const HELPER_PATH = join(tmpdir(), 'dsh-tools-restart.ps1');
const HELPER_LOG = join(tmpdir(), 'dsh-tools-restart.log');
// Host stdout only reaches an in-memory tail inside the desktop app, so every
// request/decision also lands here for post-mortem diagnosis.
const DEBUG_LOG = join(tmpdir(), 'dsh-tools-debug.log');

function debugLog(line) {
  try {
    appendFileSync(DEBUG_LOG, `${new Date().toISOString()} [pid ${process.pid}] ${line}\n`, 'utf8');
  } catch { /* diagnostics must never break a request */ }
}

// No template interpolation on purpose: the script body must stay literal.
// PowerShell format strings ("-f") avoid any "${" sequence.
const RESTART_HELPER_PS1 = [
  'param(',
  '  [Parameter(Mandatory=$true)][string]$ExePath,',
  '  [Parameter(Mandatory=$true)][int]$AppPid,',
  '  [Parameter(Mandatory=$true)][int]$HostPid,',
  '  [string]$RelaunchArgs = \'\'',
  ')',
  '$ErrorActionPreference = \'Continue\'',
  '$log = Join-Path ([System.IO.Path]::GetTempPath()) \'dsh-tools-restart.log\'',
  'function Write-Log([string]$message) {',
  '  try { Add-Content -LiteralPath $log -Value ("{0} {1}" -f (Get-Date -Format o), $message) } catch {}',
  '}',
  '$parentPid = 0',
  'try { $parentPid = [int](Get-CimInstance Win32_Process -Filter "ProcessId=$PID").ParentProcessId } catch {}',
  'Write-Log ("restart helper start exe={0} appPid={1} hostPid={2} parentPid={3}" -f $ExePath, $AppPid, $HostPid, $parentPid)',
  '# Let the RPC response flush back to the browser before tearing anything down.',
  'Start-Sleep -Milliseconds 1800',
  '# Snapshot the Host\'s children (session hosts, node helpers) BEFORE the kill:',
  '# on Windows they would otherwise orphan and leak across restarts.',
  '$childPids = @()',
  'try { $childPids = @(Get-CimInstance Win32_Process -Filter "ParentProcessId=$HostPid" -ErrorAction SilentlyContinue | ForEach-Object { [int]$_.ProcessId }) } catch {}',
  '$app = Get-Process -Id $AppPid -ErrorAction SilentlyContinue',
  'if ($null -eq $app) {',
  '  Write-Log ("app pid {0} already gone; relaunching only" -f $AppPid)',
  '} else {',
  '  $appPath = \'\'',
  '  try { $appPath = $app.Path } catch {}',
  '  if ($appPath -and ([string]::Compare($appPath, $ExePath, $true) -ne 0)) {',
  '    Write-Log ("ABORT: pid {0} runs {1}, expected {2}" -f $AppPid, $appPath, $ExePath)',
  '    exit 3',
  '  }',
  '  try { Stop-Process -Id $AppPid -Force -ErrorAction Stop; Write-Log ("stopped app pid {0}" -f $AppPid) } catch { Write-Log ("stop app failed: {0}" -f $_.Exception.Message) }',
  '}',
  '# The Host (this script\'s grandparent) can outlive a force-stopped app; stop it explicitly.',
  'try {',
  '  if (Get-Process -Id $HostPid -ErrorAction SilentlyContinue) {',
  '    Stop-Process -Id $HostPid -Force -ErrorAction Stop',
  '    Write-Log ("stopped host pid {0}" -f $HostPid)',
  '  }',
  '} catch { Write-Log ("stop host failed: {0}" -f $_.Exception.Message) }',
  '# Stop the Host\'s children (snapshot + late spawns) so nothing leaks.',
  '$targets = @($childPids)',
  'try { $targets += @(Get-CimInstance Win32_Process -Filter "ParentProcessId=$HostPid" -ErrorAction SilentlyContinue | ForEach-Object { [int]$_.ProcessId }) } catch {}',
  '$targets = @($targets | Sort-Object -Unique)',
  'foreach ($cpid in $targets) {',
  '  try { Stop-Process -Id $cpid -Force -ErrorAction Stop; Write-Log ("stopped host child pid {0}" -f $cpid) } catch { }',
  '}',
  '$deadline = (Get-Date).AddSeconds(20)',
  '$appAlive = $false',
  '$hostAlive = $false',
  '$childrenAlive = 0',
  'do {',
  '  Start-Sleep -Milliseconds 250',
  '  $appAlive = [bool](Get-Process -Id $AppPid -ErrorAction SilentlyContinue)',
  '  $hostAlive = [bool](Get-Process -Id $HostPid -ErrorAction SilentlyContinue)',
  '  $childrenAlive = 0',
  '  foreach ($cpid in $targets) { if (Get-Process -Id $cpid -ErrorAction SilentlyContinue) { $childrenAlive++ } }',
  '} while (($appAlive -or $hostAlive -or $childrenAlive -gt 0) -and ((Get-Date) -lt $deadline))',
  'Write-Log ("exit wait done appAlive={0} hostAlive={1} childrenAlive={2}" -f $appAlive, $hostAlive, $childrenAlive)',
  'try {',
  '  $relaunchAt = Get-Date',
  '  if ($RelaunchArgs) {',
  '    Start-Process -FilePath $ExePath -WorkingDirectory (Split-Path -Parent $ExePath) -ArgumentList $RelaunchArgs',
  '  } else {',
  '    Start-Process -FilePath $ExePath -WorkingDirectory (Split-Path -Parent $ExePath)',
  '  }',
  '  Write-Log ("relaunched {0}" -f $ExePath)',
  '  # Observe the fresh process so "it did not come back" reports have evidence.',
  '  $exeName = [System.IO.Path]::GetFileName($ExePath)',
  '  $observed = 0',
  '  foreach ($i in 1..20) {',
  '    Start-Sleep -Milliseconds 500',
  '    $cand = @(Get-CimInstance Win32_Process -Filter ("Name=\'{0}\'" -f $exeName) -ErrorAction SilentlyContinue | Where-Object { $_.CreationDate -and $_.CreationDate -gt $relaunchAt.AddSeconds(-1) })',
  '    if ($cand.Count -gt 0) { $observed = [int]$cand[0].ProcessId; break }',
  '  }',
  '  if ($observed -gt 0) {',
  '    Write-Log ("relaunch observed pid={0}" -f $observed)',
  '  } else {',
  '    Write-Log \'relaunch NOT observed within 10s\'',
  '  }',
  '} catch {',
  '  Write-Log ("relaunch failed: {0}" -f $_.Exception.Message)',
  '}',
  'Write-Log \'restart helper done\'',
].join('\n');

/** The exact helper script shipped to %TEMP% and spawned by a restart (exported for tests). */
export const RESTART_HELPER_SOURCE = RESTART_HELPER_PS1;

function isRecord(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

// The real client validator (dsh-client-connection lib/types/client/rpc.js
// parseConnectionResponse) rejects failure results whose error lacks a record
// `details` — that exact bug surfaced as "connection: invalid server-response
// failure" in the UI. Every failure therefore carries a record `details`.
function failure(code, message, details = {}) {
  return { ok: false, error: { code, message, details: isRecord(details) ? details : {} } };
}

// ---- admission (mirror dsh-im-notify: loopback only, plus same-origin) ----

function isLoopbackAuthority(authority) {
  if (!authority) return false;
  try {
    const url = new URL(`http://${authority}`);
    if (url.username || url.password || url.pathname !== '/' || url.search || url.hash) return false;
    const hostname = url.hostname.replace(/\.$/, '');
    return hostname === 'localhost' || hostname === '[::1]'
      || /^127\.\d+\.\d+\.\d+$/.test(hostname);
  } catch {
    return false;
  }
}

function isLoopbackOrigin(origin) {
  if (origin === null || origin === undefined) return true; // non-browser client
  try {
    const url = new URL(origin);
    return (url.protocol === 'http:' || url.protocol === 'https:') && isLoopbackAuthority(url.host);
  } catch {
    return false;
  }
}

/** Reject cross-site browser requests (Sec-Fetch-Site); non-browser clients pass. */
function passesFetchSite(site) {
  if (typeof site !== 'string' || site === '') return true;
  return site === 'same-origin';
}

// ---- desktop context + restart ----

// Desktop install image name (e.g. "DeepSeek Harness.exe"), used to bootstrap
// the executable path when the Host process env lacks DSH_NODE_EXECUTABLE.
const HARNESS_EXE_PATTERN = /deepseek[^\\/]*\.exe$/i;

function desktopFacts() {
  const envExe = typeof process.env.DSH_NODE_EXECUTABLE === 'string'
    && process.env.DSH_NODE_EXECUTABLE.trim() !== '' ? process.env.DSH_NODE_EXECUTABLE : '';
  const appPid = typeof process.ppid === 'number' && process.ppid > 4 ? process.ppid : null;
  return {
    desktop: envExe !== '' && appPid !== null,
    appExe: envExe,
    envExe,
    appPid,
    hostPid: process.pid,
    helperLog: HELPER_LOG,
    debugLog: DEBUG_LOG,
  };
}

/** Read another process' image path via PowerShell (read-only probe). */
async function processImagePath(pid) {
  try {
    const command = '[Console]::OutputEncoding=[System.Text.Encoding]::UTF8; (Get-Process -Id '
      + `${pid}).Path`;
    const { stdout } = await execFileAsync('powershell.exe',
      ['-NoProfile', '-NonInteractive', '-Command', command],
      { timeout: 8000, windowsHide: true });
    return stdout.trim() || null;
  } catch {
    return null;
  }
}

/**
 * Resolve the desktop context, probing the parent's image when needed.
 * `probe` runs the PowerShell read; keep it off read-only `restart.plan` so the
 * menu stays snappy — plan reports env facts only, restart verifies for real.
 */
async function resolveDesktop(probe) {
  const facts = { ...desktopFacts(), parentPath: null };
  if (probe === true && facts.appPid !== null) {
    facts.parentPath = await processImagePath(facts.appPid);
    // Bootstrap the exe from the parent's own image when the env var is absent
    // (Host children may not inherit DSH_NODE_EXECUTABLE) and it is
    // recognizably the desktop harness binary.
    if (facts.appExe === '' && facts.parentPath !== null
      && HARNESS_EXE_PATTERN.test(facts.parentPath)) {
      facts.appExe = facts.parentPath;
    }
    facts.desktop = facts.appExe !== '' && facts.appPid !== null && facts.parentPath !== null;
  }
  return facts;
}

function samePath(a, b) {
  return typeof a === 'string' && typeof b === 'string'
    && a.trim().toLowerCase() === b.trim().toLowerCase();
}

let restartScheduled = false;

async function handleRestart(payload) {
  const facts = await resolveDesktop(true);
  const diag = {
    envExe: facts.envExe, appExe: facts.appExe, appPid: facts.appPid,
    parentPath: facts.parentPath, hostPid: facts.hostPid,
  };
  debugLog(`restart decision env=${facts.envExe ? 'set' : 'absent'} parent=${facts.parentPath ?? 'none'}`);
  if (!facts.desktop || facts.parentPath === null) {
    return failure('not-desktop',
      'Restart is only available when DeepSeek Harness runs as the desktop app '
      + '(no recognizable desktop parent process was found for this Host).', diag);
  }
  if (!existsSync(facts.appExe)) {
    return failure('app-missing', `Application executable not found: ${facts.appExe}`, diag);
  }
  if (!samePath(facts.parentPath, facts.appExe)) {
    return failure('parent-mismatch',
      `Refusing to restart: parent process ${facts.appPid} runs '${facts.parentPath}', `
      + `expected '${facts.appExe}'.`, diag);
  }
  if (restartScheduled) {
    return { ok: true, value: { status: 'already-scheduled', ...facts, ...diag } };
  }
  if (isRecord(payload) && payload.dryRun === true) {
    return { ok: true, value: { status: 'dry-run', ...facts, ...diag } };
  }
  writeFileSync(HELPER_PATH, RESTART_HELPER_PS1, 'utf8');
  const launched = launchRestartHelper(facts, payload);
  if (launched.error !== undefined) {
    return failure('internal', launched.error, diag);
  }
  restartScheduled = true;
  debugLog(`restart scheduled (two-stage) appPid=${facts.appPid} hostPid=${facts.hostPid} exe=${facts.appExe}`);
  return { ok: true, value: { status: 'scheduled', ...facts, ...diag } };
}

/**
 * v0.2.4 launch strategy: a plain (NON-detached — `detached: true` children
 * die silently under the Electron runtime, proven by scripts/test-matrix.cjs)
 * short-lived PowerShell wrapper whose only job is to Invoke-CimMethod
 * Win32_Process.Create the real helper. The helper thereby runs under
 * WmiPrvSE, outside the app's process tree and any job object, exactly like
 * the manually-validated restart. The wrapper exits within ~1s; killing
 * starts only after the helper's own 1.8s grace sleep.
 * Exported so scripts/test-two-stage.cjs exercises the exact production path.
 */
export function launchRestartHelper(facts, payload) {
  const q = (s) => `"${s}"`;
  if (/[']/.test(facts.appExe) || /[']/.test(HELPER_PATH)) {
    return { error: 'restart paths contain unsupported quote characters' };
  }
  const innerArgs = [
    '-NoProfile', '-WindowStyle', 'Hidden', '-ExecutionPolicy', 'Bypass', '-File', q(HELPER_PATH),
    '-ExePath', q(facts.appExe),
    '-AppPid', String(facts.appPid),
    '-HostPid', String(facts.hostPid),
  ];
  if (isRecord(payload) && typeof payload.relaunchArgs === 'string' && payload.relaunchArgs !== '') {
    innerArgs.push('-RelaunchArgs', q(payload.relaunchArgs));
  }
  const wrapper = [
    "$ErrorActionPreference='Continue'",
    `$inner = '${innerArgs.join(' ')}'`,
    'Start-Sleep -Milliseconds 600',
    // ShowWindow=0 (SW_HIDE): WMI Create otherwise opens a VISIBLE console for
    // the helper — the "big black box" the user complained about.
    '$startup = New-CimInstance -CimClass (Get-CimClass -ClassName Win32_ProcessStartup) -Property @{ ShowWindow = 0 } -ClientOnly',
    "$created = Invoke-CimMethod -ClassName Win32_Process -MethodName Create -Arguments @{ CommandLine = ('powershell.exe ' + $inner); ProcessStartupInformation = $startup }",
    "if (-not $created -or -not $created.ProcessId) { Start-Process -FilePath 'powershell.exe' -ArgumentList $inner -WindowStyle Hidden }",
  ].join('; ');
  const child = spawn('powershell.exe',
    ['-NoProfile', '-NonInteractive', '-Command', wrapper],
    { stdio: 'ignore', windowsHide: true });
  child.on('error', (error) => debugLog(`wrapper spawn error: ${String(error?.message ?? error)}`));
  child.on('exit', (code, signal) => debugLog(`wrapper exited code=${code} signal=${signal ?? ''}`));
  child.unref();
  return { child };
}

const METHODS = {
  restart: handleRestart,
  'restart.plan': async () => ({ ok: true, value: { ...desktopFacts(), scheduled: restartScheduled } }),
  'dev.ping': async () => ({ ok: true, value: { version: MODULE_VERSION, pid: process.pid } }),
  'dev.reconcile': handleDevReconcile,
  suggest: handleSuggest,
  optimize: handleOptimize,
  'settings.get': async () => ({ ok: true, value: { settings: getSettings() } }),
  'settings.set': handleSettingsSet,
  'models.list': handleModelsList,
  'sc.repos': handleScRepos,
  'sc.status': handleScStatus,
  'sc.diff': handleScDiff,
  'sc.log': handleScLog,
  'sc.commitMessage': handleScCommitMessage,
  'sc.commit': handleScCommit,
  'sc.push': handleScPush,
};

// ---- settings: per-feature switches + assist model override ----
//
// Layout mirrors dsh-im-notify (all outside the package, survives reinstalls):
//   <dshHome>/integrations/dsh-tools/settings.json
// DSH_TOOLS_HOME overrides the directory wholesale (used by tests).

const DEFAULT_SETTINGS = Object.freeze({
  features: { moreMenu: true, generate: true, optimize: true, history: true, sc: true, phrases: true },
  model: { provider: '', model: '' },   // '' = follow the app's default model
  sc: { roots: [] },                    // extra source-control scan roots (absolute dirs)
  phrases: [],                          // quick phrases floating above the composer (max 5)
});

const PHRASES_MAX = 5;
const PHRASE_MAX_LEN = 200;

/** Strings only: trim, truncate, drop empties, dedupe, cap at PHRASES_MAX. */
function normalizePhrases(list) {
  if (!Array.isArray(list)) return [];
  const cleaned = [];
  for (const candidate of list) {
    if (typeof candidate !== 'string') continue;
    const text = candidate.trim().slice(0, PHRASE_MAX_LEN);
    if (text === '' || cleaned.includes(text) || cleaned.length >= PHRASES_MAX) continue;
    cleaned.push(text);
  }
  return cleaned;
}

function settingsDirectory() {
  // DSH_TOOLS_HOME replaces the state directory wholesale (tests); the real
  // layout mirrors dsh-im-notify: <dshHome>/integrations/dsh-tools.
  if (process.env.DSH_TOOLS_HOME) return resolve(process.env.DSH_TOOLS_HOME);
  const base = process.env.DSH_HOME ?? join(homedir(), '.dsh');
  return resolve(base, 'integrations', 'dsh-tools');
}

function settingsFile() {
  return join(settingsDirectory(), 'settings.json');
}

function mergeSettings(stored) {
  const merged = {
    features: { ...DEFAULT_SETTINGS.features },
    model: { ...DEFAULT_SETTINGS.model },
    sc: { roots: [] },
    phrases: [],
  };
  if (isRecord(stored?.features)) {
    for (const key of Object.keys(merged.features)) {
      if (typeof stored.features[key] === 'boolean') merged.features[key] = stored.features[key];
    }
  }
  if (isRecord(stored?.model)) {
    if (typeof stored.model.provider === 'string') merged.model.provider = stored.model.provider;
    if (typeof stored.model.model === 'string') merged.model.model = stored.model.model;
  }
  if (Array.isArray(stored?.sc?.roots)) {
    merged.sc.roots = stored.sc.roots
      .filter((root) => typeof root === 'string' && root.trim() !== '')
      .slice(0, 32);
  }
  if (Array.isArray(stored?.phrases)) {
    merged.phrases = normalizePhrases(stored.phrases);
  }
  return merged;
}

let cachedSettings = null;

/** Current settings (defaults merged with settings.json); never throws. */
export function getSettings() {
  if (cachedSettings !== null) return cachedSettings;
  let stored = null;
  try {
    stored = JSON.parse(readFileSync(settingsFile(), 'utf8'));
  } catch { /* absent or corrupt → defaults */ }
  cachedSettings = mergeSettings(stored);
  return cachedSettings;
}

function saveSettings(next) {
  cachedSettings = next;
  try {
    const file = settingsFile();
    mkdirSync(settingsDirectory(), { recursive: true });
    const tmp = `${file}.tmp`;
    writeFileSync(tmp, `${JSON.stringify(next, null, 2)}\n`, 'utf8');
    renameSync(tmp, file);
  } catch (error) {
    debugLog(`settings save failed: ${String(error?.message ?? error)}`);
  }
  return next;
}

async function handleSettingsSet(payload) {
  if (!isRecord(payload)) return failure('bad-request', 'settings.set needs an object payload.');
  const current = getSettings();
  const next = mergeSettings(current);
  let changed = false;
  if (isRecord(payload.features)) {
    for (const key of Object.keys(next.features)) {
      if (typeof payload.features[key] === 'boolean' && payload.features[key] !== next.features[key]) {
        next.features[key] = payload.features[key];
        changed = true;
      }
    }
  }
  if (isRecord(payload.model)) {
    const provider = typeof payload.model.provider === 'string' ? payload.model.provider.trim() : next.model.provider;
    const model = typeof payload.model.model === 'string' ? payload.model.model.trim() : next.model.model;
    if (provider !== next.model.provider || model !== next.model.model) {
      // A half-set override (provider without model) would surprise suggest;
      // require both or neither.
      const bothEmpty = provider === '' && model === '';
      const bothSet = provider !== '' && model !== '';
      if (!bothEmpty && !bothSet) {
        return failure('bad-request', 'Model override needs both provider and model, or neither (empty strings).');
      }
      next.model = { provider, model };
      changed = true;
    }
  }
  if (isRecord(payload.sc) && Array.isArray(payload.sc.roots)) {
    const cleaned = [];
    const seenRoots = new Set();
    for (const candidate of payload.sc.roots) {
      if (cleaned.length >= 32) break;
      if (typeof candidate !== 'string' || candidate.trim() === '') continue;
      const absolute = resolve(candidate.trim());
      const key = absolute.toLowerCase();
      if (seenRoots.has(key)) continue;
      seenRoots.add(key);
      cleaned.push(absolute);
    }
    if (cleaned.join('\n') !== next.sc.roots.join('\n')) {
      next.sc.roots = cleaned;
      changed = true;
    }
  }
  if (Array.isArray(payload.phrases)) {
    const cleanedPhrases = normalizePhrases(payload.phrases);
    if (cleanedPhrases.join('\u0001') !== next.phrases.join('\u0001')) {
      next.phrases = cleanedPhrases;
      changed = true;
    }
  }
  if (changed) {
    saveSettings(next);
    debugLog(`settings updated ${JSON.stringify(next)}`);
  }
  return { ok: true, value: { settings: next } };
}

async function handleModelsList() {
  if (llmService === null || typeof llmService.prepareCall !== 'function') {
    return failure('llm-unavailable', 'The llm service is not available in this Host; model listing needs it.');
  }
  let providers = [];
  try {
    providers = await llmService.listProviders();
    if (!Array.isArray(providers)) providers = [];
  } catch (error) {
    return failure('llm-call', `listProviders failed: ${String(error?.message ?? error)}`);
  }
  const groups = [];
  for (const info of providers.slice(0, 12)) {
    const provider = typeof info?.id === 'string' ? info.id : (typeof info?.name === 'string' ? info.name : null);
    if (provider === null) continue;
    let models = [];
    try {
      const list = await llmService.listModels(provider);
      if (Array.isArray(list)) {
        models = list.map((m) => {
          const id = typeof m?.id === 'string' ? m.id : (typeof m?.model === 'string' ? m.model : String(m ?? ''));
          const label = typeof m?.label === 'string' ? m.label : (typeof m?.displayName === 'string' ? m.displayName : id);
          return { id, label };
        }).filter((m) => m.id !== '');
      }
    } catch { /* provider without discovery still shows up */ }
    groups.push({
      provider,
      label: typeof info?.label === 'string' ? info.label : provider,
      models,
    });
  }
  let selection = null;
  try {
    const current = modelSelector !== null && typeof modelSelector.currentSelection === 'function'
      ? modelSelector.currentSelection() : null;
    if (current !== null && typeof current?.provider === 'string') {
      selection = { provider: current.provider, model: current.model ?? '' };
    }
  } catch { /* default selection is a bonus, not a requirement */ }
  const settings = getSettings();
  return {
    ok: true,
    value: {
      providers: groups,
      defaultSelection: selection,
      override: settings.model,
    },
  };
}

// ---- suggest / optimize: two assistants over one shared LLM pipeline ----
//
// The llm / agentDefaultModel services are captured through runtime child
// fibers (ctx.inject inside apply) instead of the static export: if this Host
// (e.g. the Web Host) does not provide them, the main fiber still boots and
// every other tool keeps working — suggest just reports llm-unavailable.
let llmService = null;
let modelSelector = null;

// ---- dev.reconcile: hot-reload installed plugin code without an app restart ----
//
// DSH ships an HMR service (bundle @deepseek-ai/dsh-hmr, present in Hosts that
// expose profileContext). Its reconcileProfile() recomposes the profile and
// replaces running plugins whose loaded files under the profile directory or
// its linked package targets changed on disk — including this plugin. That is
// the mechanism plugin installs flow through when the GUI applies them, and it
// is what makes "update code, reload, keep every session alive" possible.
let hmrService = null;

async function handleDevReconcile() {
  const hmr = hmrService;
  if (hmr === null || typeof hmr.reconcileProfile !== 'function' || typeof hmr.runExclusive !== 'function') {
    return failure('hmr-unavailable', 'This Host does not expose the hmr service; an app restart is required to pick up plugin changes.');
  }
  // Replacing this very module stops the fiber that is answering this RPC,
  // which would swallow the reply, so the reconciliation runs after the reply
  // is on the wire. Outcome lands in the debug log.
  setTimeout(() => {
    try {
      hmr.runExclusive(() => hmr.reconcileProfile())
        .then((result) => {
          debugLog(`dev.reconcile done: restartReason=${result?.restartReason ?? 'none'}`
            + ` pending=${(result?.pending ?? []).length} warnings=${(result?.warnings ?? []).length}`);
          for (const warning of result?.warnings ?? []) debugLog(`dev.reconcile warning: ${String(warning)}`);
        })
        .catch((error) => {
          debugLog(`dev.reconcile failed: ${String(error?.message ?? error)}`);
        });
    } catch (error) {
      debugLog(`dev.reconcile dispatch failed: ${String(error?.message ?? error)}`);
    }
  }, 0);
  return { ok: true, value: { scheduled: true } };
}

const SUGGEST_MAX_INPUT = 24000;   // chars of context sent to the model
const SUGGEST_MAX_TOKENS = 220;
const OPTIMIZE_MAX_INPUT = 24000;
const OPTIMIZE_MAX_TOKENS = 900;
const ASSIST_TIMEOUT_MS = 60000;

const SUGGEST_SYSTEMS = {
  zh: '你在帮用户给 AI 编程助手写回复。下面给出 AI 助手最近一轮的回复内容。请站在用户角度起草一条简短的「意向回复」：用户看完这轮回复后最可能想说的话，例如确认方案、追问细节、要求修改、表达感谢或给出下一步指令。直接输出回复正文本身：1~3 句、口语自然、与输入语言一致，不要任何解释、引号、标题或多余格式。',
  en: 'You draft the user\'s next reply to an AI coding assistant. The latest assistant reply is provided below. Write the short "intent reply" the user most likely wants to send after reading it — e.g. confirm the plan, ask a follow-up, request a change, thank, or give the next instruction. Output only the reply text itself: 1-3 sentences, natural tone, same language as the input, no explanations, quotes, headings or extra formatting.',
};

const OPTIMIZE_SYSTEMS = {
  zh: '你在帮用户优化写给 AI 编程助手的提示词。下面是用户草拟的提示词原文。请改写为对 AI 更易懂、更易执行的版本：明确目标、补齐缺失的上下文与约束、理顺结构（可分点），但不改变用户的意图、语言和技术选型。保留原文中的代码、路径、标识符与专有名词。直接输出优化后的提示词本身，不要任何解释、前后缀、引号或代码围栏。',
  en: 'You improve prompts written to an AI coding assistant. The user\'s draft prompt is provided below. Rewrite it into a version the AI can understand and execute more easily: make the goal explicit, fill in missing context and constraints, and organize the structure (bullet points are fine) — without changing the user\'s intent, language, or technology choices. Preserve any code, paths, identifiers, and proper nouns from the original. Output only the improved prompt itself: no explanations, wrappers, quotes, or code fences.',
};

const COMMIT_MAX_TOKENS = 200;

const COMMIT_SYSTEMS = {
  zh: '你在帮用户为一个 git 提交写 commit message。下面提供该仓库最近的提交标题（风格参考）和本次要提交的改动内容（diff）。请生成一条与仓库历史风格一致的 commit message：沿用历史的语言与格式（例如历史用 conventional commits 前缀「type(scope):」就照用），准确概括这些改动做了什么。只输出 commit message 本身：首行不超过 72 个字符，需要时可用一个空行接正文；不要任何解释、引号或代码围栏。',
  en: 'You write a commit message for one git commit. The repository\'s recent commit subjects (style reference) and the diff being committed are provided below. Produce a commit message consistent with the repository\'s history: same language and format as the history (e.g. keep conventional-commits "type(scope):" prefixes if the history uses them), accurately summarizing what these changes do. Output only the commit message itself: first line ≤72 characters, optionally a blank line then a body; no explanations, quotes, or code fences.',
};

/** Extract and normalize the text a suggest draft will be based on. */
export function prepareSuggestInput(rawReply) {
  const text = String(rawReply ?? '').replace(/\u00a0/g, ' ').trim();
  if (text === '') return '';
  return text.length > SUGGEST_MAX_INPUT
    ? `…${text.slice(text.length - SUGGEST_MAX_INPUT)}` : text;
}

/** Normalize the model output into a paste-ready draft. */
export function cleanSuggestDraft(raw) {
  let draft = String(raw ?? '').trim();
  const fenced = draft.match(/^```[a-z]*\n([\s\S]*?)\n```$/i);
  if (fenced !== null) draft = fenced[1].trim();
  draft = draft.replace(/^[「"“'‘]+/, '').replace(/[」"”'’]+$/, '').trim();
  if (draft.length > 2000) draft = draft.slice(0, 2000);
  return draft;
}

/** Resolve which model an assist call uses: user override → app default. */
function resolveAssistRoute() {
  const settings = getSettings();
  if (settings.model.provider !== '' && settings.model.model !== '') {
    return { route: { provider: settings.model.provider, model: settings.model.model }, source: 'override' };
  }
  try {
    const selection = modelSelector !== null && typeof modelSelector.currentSelection === 'function'
      ? modelSelector.currentSelection() : null;
    if (selection !== null && typeof selection?.provider === 'string') {
      return { route: selection, source: 'default' };
    }
  } catch (error) {
    debugLog(`assist model selection failed: ${String(error?.message ?? error)}`);
  }
  return { route: {}, source: 'none' };
}

/** Shared streaming pipeline for suggest/optimize; returns a dispatch result. */
async function runAssist(kind, payload) {
  const lang = payload.lang === 'en' ? 'en' : 'zh';
  const input = prepareSuggestInput(payload.source);
  if (input === '') {
    return failure('empty-context', kind === 'optimize'
      ? 'The composer is empty — write a draft prompt first.'
      : 'No assistant reply text was provided to draft from.');
  }
  if (llmService === null || typeof llmService.prepareCall !== 'function') {
    return failure('llm-unavailable',
      'The llm service is not available in this Host; this feature needs it.');
  }
  const { route } = resolveAssistRoute();
  if (typeof route.provider !== 'string' || route.provider === '') {
    return failure('no-model', 'No model is configured for this feature (see dsh-tools settings).');
  }
  const systems = kind === 'optimize' ? OPTIMIZE_SYSTEMS
    : kind === 'commit' ? COMMIT_SYSTEMS : SUGGEST_SYSTEMS;
  const maxTokens = kind === 'optimize' ? OPTIMIZE_MAX_TOKENS
    : kind === 'commit' ? COMMIT_MAX_TOKENS : SUGGEST_MAX_TOKENS;
  const started = Date.now();
  const signal = AbortSignal.timeout(ASSIST_TIMEOUT_MS);
  let call;
  try {
    call = await llmService.prepareCall({ provider: route.provider, model: route.model, maxTokens }, signal);
  } catch (error) {
    return failure('llm-call', String(error?.message ?? error), { provider: route.provider });
  }
  const message = {
    id: randomUUID(),
    role: 'user',
    content: [{ type: 'text', text: input }],
    source: { kind: 'dsh-tools' },
  };
  const options = {
    ...call.config,
    messages: [message],
    system: systems[lang],
    purpose: `dsh-tools-${kind}`,
    signal,
  };
  let raw = '';
  try {
    for await (const chunk of call.stream(options)) {
      if (chunk?.type === 'text-delta' && typeof chunk.text === 'string') raw += chunk.text;
    }
  } catch (error) {
    return failure('llm-stream', String(error?.message ?? error), { provider: route.provider });
  }
  const draft = cleanSuggestDraft(raw);
  if (draft === '') {
    return failure('empty-draft', 'The model returned no usable text.');
  }
  debugLog(`${kind} ok in=${input.length}ch out=${draft.length}ch ${Date.now() - started}ms`);
  return { ok: true, value: { draft, lang } };
}

async function handleSuggest(payload) {
  if (!isRecord(payload) || typeof payload.lastReply !== 'string') {
    return failure('empty-context', 'No assistant reply text was provided to draft from.');
  }
  return runAssist('suggest', { source: payload.lastReply, lang: payload.lang });
}

async function handleOptimize(payload) {
  if (!isRecord(payload) || typeof payload.prompt !== 'string') {
    return failure('empty-context', 'The composer is empty — write a draft prompt first.');
  }
  return runAssist('optimize', { source: payload.prompt, lang: payload.lang });
}

// ---- source control: grouped working-copy changes, partial commits ----
//
// v0.6 capability: the Client half renders a "资源控制" drawer next to the
// sidebar settings entry. This half owns every git invocation (execFile argv
// arrays, never a shell) plus the repository scan:
//   sc.repos         → repositories under workspace dirs + settings.sc.roots
//   sc.status        → `git status --porcelain=v1 -z` parsed into files[]
//   sc.diff          → `git diff HEAD -- <path>` (tracked) or a synthetic
//                      new-file diff (untracked), capped
//   sc.log           → recent commit subjects (style reference for the AI)
//   sc.commitMessage → runAssist('commit') over the selected diffs + history
//   sc.commit        → `git add -A -- <selected>` + `git commit -m msg -- <selected>`;
//                      the pathspec commit takes only those paths' worktree
//                      state, so unrelated staged changes stay staged
//   sc.push          → `git push` (never force; respects the branch upstream)

let workspaceRegistryService = null;

const SC_SCAN_DEPTH = 3;          // levels below each root
const SC_MAX_DIRS = 3000;         // directories visited per scan
const SC_MAX_REPOS = 60;
const SC_MAX_CLIENT_ROOTS = 4;    // live roots hinted by the client per request
const SC_MAX_FILES = 500;         // files reported per repository
const SC_DIFF_MAX_CHARS = 80000;  // diff text returned to the drawer
const SC_DIFF_FILE_MAX = 6000;    // per-file diff fed to the commit model
const SC_DIFF_TOTAL_MAX = 20000;  // total diff fed to the commit model
const SC_LOG_COUNT = 30;
const SC_MAX_SELECTED = 200;
const SC_SKIP_DIRS = new Set(['node_modules', 'dist', 'build', 'out', 'target', 'venv', '.venv', '__pycache__', 'coverage', '.cache']);

function runGit(repo, args, options = {}) {
  return execFileAsync('git', ['-C', repo, ...args], {
    timeout: options.timeout ?? 15000,
    maxBuffer: 16 * 1024 * 1024,
    windowsHide: true,
    encoding: 'utf8',
  });
}

function gitFailure(error, repo, label) {
  const stderr = String(error?.stderr ?? '').trim();
  const stdout = String(error?.stdout ?? '').trim();
  const tail = (stderr !== '' ? stderr : stdout).split('\n').slice(-8).join('\n').slice(0, 1500);
  return failure('git-error', `${label} failed in ${repo}: ${tail || String(error?.message ?? error)}`, {
    repo, label,
  });
}

/** Valid absolute directory that contains a .git entry (dir or worktree file). */
function requireScRepo(payload) {
  const candidate = isRecord(payload) && typeof payload.repo === 'string' ? payload.repo.trim() : '';
  if (candidate === '' || !isAbsolute(candidate)) return null;
  const repo = resolve(candidate);
  try {
    if (!statSync(repo).isDirectory()) return null;
    if (!existsSync(join(repo, '.git'))) return null;
  } catch { return null; }
  return repo;
}

/** A git pathspec: in-repo relative, forward slashes, no traversal tricks. */
function validateScFile(repo, filePath) {
  if (typeof filePath !== 'string' || filePath === '' || filePath.length > 512) return null;
  if (filePath.includes('\0') || filePath.startsWith('-')
    || /^[a-z]:/i.test(filePath) || filePath.startsWith('/') || filePath.startsWith('\\')) return null;
  const normalized = filePath.replace(/\\/g, '/');
  for (const part of normalized.split('/')) {
    if (part === '' || part === '.' || part === '..') return null;
  }
  const base = resolve(repo);
  const absolute = resolve(repo, normalized);
  if (absolute !== base && !absolute.startsWith(`${base}\\`) && !absolute.startsWith(`${base}/`)) return null;
  return normalized;
}

function collectScRoots(clientRoots = []) {
  const roots = new Map(); // lowercased absolute → original casing
  const add = (candidate) => {
    if (typeof candidate !== 'string' || candidate.trim() === '') return;
    if (!isAbsolute(candidate)) return; // hints must be absolute; registry/settings paths are too
    const absolute = resolve(candidate.trim());
    const key = absolute.toLowerCase();
    if (roots.has(key)) return;
    try {
      if (!statSync(absolute).isDirectory()) return;
    } catch { return; }
    roots.set(key, absolute);
  };
  // 1) live client hints (the workspace the user is actually looking at).
  //    v0.6.5: hints are now EXCLUSIVE of the durable registry. The registry
  //    lists EVERY workspace on this machine — other sessions' directories —
  //    so merging it while the user sits in one workspace showed that
  //    workspace's parent and siblings (m03593: reader workspace listed ai/,
  //    dsh-tools/, AICX-V3…). Consult it only when the client could not hint
  //    a root at all (host-only callers, headless probes).
  for (const hint of clientRoots.slice(0, SC_MAX_CLIENT_ROOTS)) add(hint);
  if (roots.size === 0) {
    try {
      const workspaces = workspaceRegistryService !== null
        && typeof workspaceRegistryService.list === 'function'
        ? workspaceRegistryService.list() : [];
      for (const workspace of Array.isArray(workspaces) ? workspaces : []) add(workspace?.path);
    } catch (error) {
      debugLog(`workspace registry unavailable: ${String(error?.message ?? error)}`);
    }
  }
  // 2) explicit settings roots (user-opted extras, always honored)
  for (const root of getSettings().sc.roots) add(root);
  return [...roots.values()];
}

async function handleScRepos(payload) {
  const clientRoots = Array.isArray(payload?.roots)
    ? payload.roots.filter((item) => typeof item === 'string' && item.trim() !== '').slice(0, SC_MAX_CLIENT_ROOTS)
    : [];
  const roots = collectScRoots(clientRoots);
  const repos = scanForRepos(roots);
  debugLog(`sc.repos roots=${roots.length} (${roots.join(' | ') || 'none'}) repos=${repos.length}`);
  return { ok: true, value: { roots, repos, truncated: repos.length >= SC_MAX_REPOS } };
}

function scanForRepos(roots) {
  const repos = [];
  const seen = new Set();
  const queue = roots.map((dir) => ({ dir, depth: 0 }));
  let visited = 0;
  while (queue.length > 0 && visited < SC_MAX_DIRS && repos.length < SC_MAX_REPOS) {
    const { dir, depth } = queue.shift();
    const key = dir.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    visited += 1;
    let entries = [];
    try {
      entries = readdirSync(dir, { withFileTypes: true });
    } catch { continue; }
    let isRepo = false;
    const descend = [];
    for (const entry of entries) {
      if (entry.name === '.git') isRepo = true;
      else if (entry.isDirectory() && !entry.name.startsWith('.') && !SC_SKIP_DIRS.has(entry.name)) {
        descend.push(entry.name);
      }
    }
    if (isRepo) { repos.push(dir); continue; } // never descend into a repository
    if (depth >= SC_SCAN_DEPTH) continue;
    for (const name of descend) queue.push({ dir: join(dir, name), depth: depth + 1 });
  }
  repos.sort((a, b) => a.localeCompare(b, 'en', { sensitivity: 'base' }));
  return repos.map((path) => ({ id: path, name: basename(path), path }));
}

/** Parse `git status --porcelain=v1 -z` output. */
export function parsePorcelain(raw) {
  const records = String(raw ?? '').split('\0');
  const files = [];
  for (let i = 0; i < records.length; i += 1) {
    const record = records[i];
    if (record.length < 4) continue;
    const xy = record.slice(0, 2);
    const path = record.slice(3);
    if (path === '') continue;
    if (xy === '!!') continue; // ignored entries (only with --ignored) — not working-copy changes
    let orig = null;
    if (xy[0] === 'R' || xy[0] === 'C') {
      orig = typeof records[i + 1] === 'string' && records[i + 1] !== '' ? records[i + 1] : null;
      i += 1; // the original path follows as its own NUL-terminated record
    }
    let status = 'M';
    if (xy === '??') status = 'A';
    else if (xy[0] === 'A' || xy[1] === 'A') status = 'A';
    else if (xy[0] === 'D' || xy[1] === 'D') status = 'D';
    else if (xy[0] === 'R' || xy[1] === 'R') status = 'R';
    files.push({ path, status, staged: xy[0] !== ' ' && xy !== '??' && xy !== '!!', orig });
  }
  files.sort((a, b) => a.path.localeCompare(b.path, 'en'));
  return files;
}

async function currentChanges(repo) {
  const result = await runGit(repo, ['status', '--porcelain=v1', '-z']);
  return parsePorcelain(result.stdout);
}

async function handleScStatus(payload) {
  const repo = requireScRepo(payload);
  if (repo === null) return failure('bad-request', 'A valid absolute repository path is required.');
  let files;
  try {
    files = await currentChanges(repo);
  } catch (error) {
    return gitFailure(error, repo, 'git status');
  }
  const truncated = files.length > SC_MAX_FILES;
  let branch = '';
  try {
    branch = (await runGit(repo, ['rev-parse', '--abbrev-ref', 'HEAD'])).stdout.trim();
  } catch { /* unborn HEAD or similar */ }
  return { ok: true, value: { repo, branch, files: files.slice(0, SC_MAX_FILES), truncated } };
}

/** Untracked files have no HEAD diff — render a "+ every line" diff instead. */
export function syntheticNewFileDiff(repo, file) {
  try {
    const content = readFileSync(resolve(repo, file), 'utf8');
    if (content.includes('\u0000')) {
      return `diff --git a/${file} b/${file}\nnew file mode 100644\nBinary file\n`;
    }
    const lines = content.split('\n');
    if (lines.length > 0 && lines[lines.length - 1] === '') lines.pop();
    const body = lines.map((line) => `+${line}`).join('\n');
    return `diff --git a/${file} b/${file}\nnew file mode 100644\n--- /dev/null\n+++ b/${file}\n${body}\n`;
  } catch {
    return `diff --git a/${file} b/${file}\nnew file mode 100644\n(file no longer exists)\n`;
  }
}

async function diffOneFile(repo, entry) {
  // Untracked paths have no HEAD diff — detect via the index, not status
  // flags, so stale callers still render a proper new-file diff.
  const tracked = (await runGit(repo, ['ls-files', '--', entry.path])).stdout.trim() !== '';
  if (!tracked) return syntheticNewFileDiff(repo, entry.path);
  const result = await runGit(repo, ['diff', 'HEAD', '--', entry.path], { timeout: 20000 });
  if (result.stdout.trim() === '' && entry.orig !== null) {
    const renamed = await runGit(repo, ['diff', 'HEAD', '--', entry.orig], { timeout: 20000 });
    return renamed.stdout;
  }
  return result.stdout;
}

async function handleScDiff(payload) {
  const repo = requireScRepo(payload);
  if (repo === null) return failure('bad-request', 'A valid absolute repository path is required.');
  const file = validateScFile(repo, isRecord(payload) ? payload.file : null);
  if (file === null) return failure('bad-request', 'A valid in-repository file path is required.');
  const untracked = isRecord(payload) && payload.untracked === true;
  let text = '';
  if (untracked) {
    text = syntheticNewFileDiff(repo, file);
  } else {
    try {
      text = await diffOneFile(repo, { path: file, status: 'M', staged: false, orig: null });
    } catch (error) {
      return gitFailure(error, repo, 'git diff');
    }
  }
  if (text.length > SC_DIFF_MAX_CHARS) {
    text = `${text.slice(0, SC_DIFF_MAX_CHARS)}\n… (diff truncated)`;
  }
  return { ok: true, value: { repo, file, diff: text } };
}

async function handleScLog(payload) {
  const repo = requireScRepo(payload);
  if (repo === null) return failure('bad-request', 'A valid absolute repository path is required.');
  try {
    const result = await runGit(repo, ['log', '-n', String(SC_LOG_COUNT), '--pretty=format:%s']);
    const subjects = result.stdout.split('\n').map((line) => line.trim()).filter((line) => line !== '');
    return { ok: true, value: { repo, subjects } };
  } catch (error) {
    const message = String(error?.stderr ?? error?.message ?? error);
    if (message.includes('does not have any commits yet')) {
      return { ok: true, value: { repo, subjects: [] } };
    }
    return gitFailure(error, repo, 'git log');
  }
}

/** Resolve the requested files against a fresh status snapshot. */
async function resolveSelection(repo, requested) {
  if (!Array.isArray(requested) || requested.length === 0) {
    return { error: failure('bad-request', 'Select at least one file first.') };
  }
  if (requested.length > SC_MAX_SELECTED) {
    return { error: failure('bad-request', `Too many files selected (max ${SC_MAX_SELECTED}).`) };
  }
  let changes;
  try {
    changes = await currentChanges(repo);
  } catch (error) {
    return { error: gitFailure(error, repo, 'git status') };
  }
  const byPath = new Map(changes.map((entry) => [entry.path, entry]));
  const selected = [];
  for (const candidate of requested) {
    const file = validateScFile(repo, candidate);
    if (file === null) return { error: failure('bad-request', `Invalid file path: ${String(candidate)}`) };
    const entry = byPath.get(file);
    if (entry === undefined) {
      return { error: failure('bad-request', `Not a current working-copy change: ${file}`) };
    }
    selected.push(entry);
  }
  return { selected };
}

async function handleScCommitMessage(payload) {
  const repo = requireScRepo(payload);
  if (repo === null) return failure('bad-request', 'A valid absolute repository path is required.');
  const selection = await resolveSelection(repo, payload?.files);
  if (selection.error !== undefined) return selection.error;
  let subjects = [];
  try {
    const log = await runGit(repo, ['log', '-n', '20', '--pretty=format:%s']);
    subjects = log.stdout.split('\n').map((line) => line.trim()).filter((line) => line !== '');
  } catch { /* empty repo → no style reference */ }
  const sections = [];
  if (subjects.length > 0) {
    sections.push(`## Recent commit subjects (style reference)\n${subjects.join('\n')}`);
  }
  const chunks = [];
  let budget = SC_DIFF_TOTAL_MAX;
  for (const entry of selection.selected) {
    if (budget <= 0) break;
    let diff = '';
    try {
      diff = await diffOneFile(repo, entry);
    } catch { diff = '(diff unavailable)'; }
    if (diff.length > SC_DIFF_FILE_MAX) diff = `${diff.slice(0, SC_DIFF_FILE_MAX)}\n… (truncated)`;
    const chunk = `### ${entry.path} (${entry.status})\n${diff}`.slice(0, SC_DIFF_FILE_MAX + 128);
    chunks.push(chunk);
    budget -= chunk.length;
  }
  sections.push(`## Changes to commit\n${chunks.join('\n\n')}`);
  return runAssist('commit', { source: sections.join('\n\n'), lang: payload?.lang });
}

async function handleScCommit(payload) {
  const repo = requireScRepo(payload);
  if (repo === null) return failure('bad-request', 'A valid absolute repository path is required.');
  const message = typeof payload?.message === 'string' ? payload.message.trim() : '';
  if (message === '' || message.length > 500 || /[\u0000-\u0008\u000b-\u001f]/.test(message)) {
    return failure('bad-request', 'Commit message must be 1-500 characters (no control characters).');
  }
  const selection = await resolveSelection(repo, payload?.files);
  if (selection.error !== undefined) return selection.error;
  const pathspecs = new Set();
  for (const entry of selection.selected) {
    pathspecs.add(entry.path);
    if (entry.orig !== null) pathspecs.add(entry.orig); // renames commit both sides
  }
  const paths = [...pathspecs];
  try {
    // Stage exactly the selected paths (covers additions, edits, deletions);
    // the pathspec commit below then takes just these paths' worktree state,
    // leaving anything else the user had staged still staged.
    await runGit(repo, ['add', '-A', '--', ...paths]);
    await runGit(repo, ['commit', '-m', message, '--', ...paths], { timeout: 30000 });
  } catch (error) {
    return gitFailure(error, repo, 'git commit');
  }
  let hash = '';
  try {
    hash = (await runGit(repo, ['rev-parse', '--short', 'HEAD'])).stdout.trim();
  } catch { /* hash is informational */ }
  debugLog(`sc.commit repo=${repo} files=${selection.selected.length} → ${hash}`);
  return { ok: true, value: { commit: hash, count: selection.selected.length } };
}

async function handleScPush(payload) {
  const repo = requireScRepo(payload);
  if (repo === null) return failure('bad-request', 'A valid absolute repository path is required.');
  try {
    const result = await runGit(repo, ['push'], { timeout: 120000 });
    const output = `${String(result.stdout ?? '')}\n${String(result.stderr ?? '')}`.trim();
    return { ok: true, value: { repo, output: output.split('\n').slice(-6).join('\n').slice(0, 1200) } };
  } catch (error) {
    return gitFailure(error, repo, 'git push');
  }
}

async function dispatch(method, payload) {
  const handler = Object.hasOwn(METHODS, method) ? METHODS[method] : undefined;
  if (handler === undefined) {
    return failure('bad-request', `Unknown method: ${String(method)}`);
  }
  try {
    const result = (await handler(payload)) ?? { ok: true, value: null };
    debugLog(`method=${method} → ${result?.ok === true ? 'ok' : `error:${result?.error?.code}`}`);
    return result;
  } catch (error) {
    debugLog(`method=${method} → threw ${String(error?.message ?? error)}`);
    return failure('internal', String(error?.message ?? error), { method });
  }
}

// ---- leg 1: bare webServer `exact` route (Node-style request/response) ----

function nodeReply(response, status, body, contentType = 'application/json') {
  const payload = typeof body === 'string' ? body : JSON.stringify(body);
  response.writeHead(status, {
    'content-type': `${contentType}; charset=utf-8`,
    'content-length': Buffer.byteLength(payload),
  });
  response.end(payload);
}

async function handleNodeRequest(request, response, log) {
  try {
    const headers = request.headers ?? {};
    if (!isLoopbackAuthority(headers.host) || !isLoopbackOrigin(headers.origin)) {
      return nodeReply(response, 403, 'forbidden', 'text/plain');
    }
    if (!passesFetchSite(headers['sec-fetch-site'])) {
      return nodeReply(response, 403, 'forbidden', 'text/plain');
    }
    if (request.method !== 'POST') return nodeReply(response, 405, 'method not allowed', 'text/plain');
    const contentType = String(headers['content-type'] ?? '').split(';', 1)[0].trim().toLowerCase();
    if (contentType !== 'application/json') {
      return nodeReply(response, 415, 'content type must be application/json', 'text/plain');
    }
    const chunks = [];
    for await (const chunk of request) chunks.push(chunk);
    let message;
    try {
      message = JSON.parse(Buffer.concat(chunks).toString('utf8'));
    } catch {
      return nodeReply(response, 400, 'body is not JSON', 'text/plain');
    }
    const rpcId = typeof message?.rpcId === 'string' ? message.rpcId : 'invalid-request';
    const call = message?.payload;
    if (!isRecord(message) || message.type !== 'client-request'
      || message.method !== RPC_KEY || !isRecord(call) || typeof call.method !== 'string'
      || !Object.hasOwn(call, 'payload')) {
      return nodeReply(response, 200, {
        type: 'server-response', rpcId,
        result: failure('bad-request', 'Invalid dsh-tools request.'),
      });
    }
    log(`[dsh-tools] ${call.method} invoked`);
    const result = await dispatch(call.method, call.payload);
    log(`[dsh-tools] ${call.method} → ${result?.ok ? 'ok' : `error:${result?.error?.code}`}`);
    return nodeReply(response, 200, { type: 'server-response', rpcId, result });
  } catch (error) {
    try { nodeReply(response, 500, 'dsh-tools handler failed', 'text/plain'); } catch { /* gone */ }
    const logTarget = console;
    (logTarget.warn ?? logTarget.log).call(logTarget, `[dsh-tools] route error: ${error?.message ?? error}`);
  }
}

function installWebServerRoute(ctx, log) {
  const webServer = typeof ctx?.webServer?.register === 'function' ? ctx.webServer : null;
  if (webServer === null) {
    log('[dsh-tools] webServer service unavailable; exact route skipped', 'warn');
    return () => {};
  }
  let unregister = null;
  try {
    log('[dsh-tools] route mounted on webServer (exact)');
    debugLog('webServer route mounted');
    unregister = webServer.register({
      kind: 'exact',
      path: `/api/${RPC_KEY}`,
      handler: (request, response) => { void handleNodeRequest(request, response, log); },
    });
  } catch (error) {
    log(`[dsh-tools] webServer route mount failed: ${error?.message ?? error}`, 'warn');
    debugLog(`webServer route mount FAILED: ${String(error?.message ?? error)}`);
  }
  return () => {
    try { unregister?.(); } catch { /* already gone */ }
  };
}

// ---- leg 2: connection.fetch bus (hot-reload fallback) ----

function installConnectionFetch(ctx, log) {
  const connection = typeof ctx?.connection?.fetch?.register === 'function' ? ctx.connection : null;
  if (connection === null) {
    log('[dsh-tools] connection.fetch unavailable; fallback leg skipped', 'warn');
    return () => {};
  }
  let unregister = null;
  try {
    unregister = connection.fetch.register({
    path: `/api/${RPC_KEY}`,
    methods: ['POST'],
    requestBody: 'buffered',
    async fetch(request) {
      const headers = request.headers;
      if (!isLoopbackAuthority(headers.get('host')) || !isLoopbackOrigin(headers.get('origin'))) {
        return new Response('forbidden', { status: 403 });
      }
      if (!passesFetchSite(headers.get('sec-fetch-site'))) {
        return new Response('forbidden', { status: 403 });
      }
      if (request.method !== 'POST') return new Response('method not allowed', { status: 405 });
      if (headers.get('content-type')?.split(';', 1)[0].trim().toLowerCase() !== 'application/json') {
        return new Response('content type must be application/json', { status: 415 });
      }
      let message;
      try {
        message = await request.json();
      } catch {
        return new Response('body is not JSON', { status: 400 });
      }
      const rpcId = typeof message?.rpcId === 'string' ? message.rpcId : 'invalid-request';
      const call = message?.payload;
      if (!isRecord(message) || message.type !== 'client-request'
        || message.method !== RPC_KEY || !isRecord(call) || typeof call.method !== 'string'
        || !Object.hasOwn(call, 'payload')) {
        return Response.json({
          type: 'server-response', rpcId,
          result: failure('bad-request', 'Invalid dsh-tools request.'),
        });
      }
      log(`[dsh-tools] ${call.method} invoked (fetch leg)`);
      const result = await dispatch(call.method, call.payload);
      return Response.json({ type: 'server-response', rpcId, result: result ?? { ok: true, value: null } });
    },
  });
  } catch (error) {
    log(`[dsh-tools] connection.fetch mount failed: ${error?.message ?? error}`, 'warn');
    debugLog(`connection.fetch mount FAILED: ${String(error?.message ?? error)}`);
  }
  return () => { try { unregister?.(); } catch { /* already gone */ } };
}

export function apply(ctx) {
  const log = (message, level = 'info') => {
    const target = ctx?.logger ?? console;
    try {
      (target[level] ?? target.log).call(target, message);
    } catch {
      console.log(message);
    }
  };
  log(`[dsh-tools] host module loaded (${MODULE_VERSION})`);
  debugLog(`host module loaded (${MODULE_VERSION})`);
  const stopRoute = installWebServerRoute(ctx, log);
  const stopFetch = installConnectionFetch(ctx, log);
  // Runtime child fibers: capture optional services when this Host provides
  // them. Pending forever is fine — suggest degrades to a clear error.
  const stopLlm = captureService(ctx, 'llm', (service) => { llmService = service; }, () => { llmService = null; }, log);
  const stopSelector = captureService(ctx, 'agentDefaultModel', (service) => { modelSelector = service; }, () => { modelSelector = null; }, log);
  const stopRegistry = captureService(ctx, 'workspaceRegistry', (service) => { workspaceRegistryService = service; }, () => { workspaceRegistryService = null; }, log);
  const stopHmr = captureService(ctx, 'hmr', (service) => { hmrService = service; }, () => { hmrService = null; }, log);
  // Teardown: Cordis only honors ctx.effect() disposers on plugin stop — a
  // plain return value is IGNORED, which left routes owned by dead fibers
  // serving stale code after HMR swaps (found 2026-11-23: /api/dsh-tools was
  // still answered by the v0.6.0 fiber across three "hot" updates). Register
  // the real hook when present; keep the return value for bare test stubs.
  let tornDown = false;
  const stops = [stopHmr, stopRegistry, stopSelector, stopLlm, stopFetch, stopRoute];
  const teardown = () => {
    if (tornDown) return;
    tornDown = true;
    for (const stop of stops) {
      try { stop(); } catch { /* already gone */ }
    }
  };
  if (typeof ctx?.effect === 'function') {
    try {
      ctx.effect(() => teardown);
    } catch (error) {
      log(`[dsh-tools] ctx.effect registration failed: ${error?.message ?? error}`, 'warn');
    }
  }
  return teardown;
}

/** Attach a runtime child fiber for one optional service; returns a stop(). */
function captureService(ctx, serviceName, onReady, onLost, log) {
  try {
    if (typeof ctx?.inject !== 'function') return () => {};
    // Named function (fn.name = serviceName) so the child fiber gets a unique
    // plugin name inside the group.
    const applyService = { [serviceName]: (serviceCtx) => {
      const service = serviceCtx?.[serviceName];
      if (service !== undefined && service !== null) {
        onReady(service);
        log(`[dsh-tools] ${serviceName} service captured`);
        debugLog(`${serviceName} service captured`);
      }
      return () => onLost();
    } }[serviceName];
    const fiber = ctx.inject([serviceName], applyService);
    return () => {
      try { fiber?.dispose?.(); } catch { /* already gone */ }
      onLost();
    };
  } catch (error) {
    log(`[dsh-tools] ${serviceName} capture failed: ${error?.message ?? error}`, 'warn');
    return () => {};
  }
}
