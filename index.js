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
import { appendFileSync, existsSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);

export const name = 'dsh-tools';

// Services this Host half touches. Cordis refuses undeclared ctx member reads
// (the exact failure was: cannot get property "connection" without inject) and
// only calls apply() once every listed service is live, so both legs below can
// access ctx.webServer / ctx.connection directly.
export const inject = ['webServer', 'connection'];

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
  suggest: handleSuggest,
};

// ---- suggest: draft the user's next reply from the last AI reply ----
//
// The llm / agentDefaultModel services are captured through runtime child
// fibers (ctx.inject inside apply) instead of the static export: if this Host
// (e.g. the Web Host) does not provide them, the main fiber still boots and
// every other tool keeps working — suggest just reports llm-unavailable.
let llmService = null;
let modelSelector = null;

const SUGGEST_MAX_INPUT = 24000;   // chars of AI reply context sent to the model
const SUGGEST_MAX_TOKENS = 220;
const SUGGEST_TIMEOUT_MS = 60000;

const SUGGEST_SYSTEMS = {
  zh: '你在帮用户给 AI 编程助手写回复。下面给出 AI 助手最近一轮的回复内容。请站在用户角度起草一条简短的「意向回复」：用户看完这轮回复后最可能想说的话，例如确认方案、追问细节、要求修改、表达感谢或给出下一步指令。直接输出回复正文本身：1~3 句、口语自然、与输入语言一致，不要任何解释、引号、标题或多余格式。',
  en: 'You draft the user\'s next reply to an AI coding assistant. The latest assistant reply is provided below. Write the short "intent reply" the user most likely wants to send after reading it — e.g. confirm the plan, ask a follow-up, request a change, thank, or give the next instruction. Output only the reply text itself: 1-3 sentences, natural tone, same language as the input, no explanations, quotes, headings or extra formatting.',
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

async function handleSuggest(payload) {
  if (!isRecord(payload) || typeof payload.lastReply !== 'string'
    || prepareSuggestInput(payload.lastReply) === '') {
    return failure('empty-context', 'No assistant reply text was provided to draft from.');
  }
  const lang = payload.lang === 'en' ? 'en' : 'zh';
  const input = prepareSuggestInput(payload.lastReply);
  if (llmService === null || typeof llmService.prepareCall !== 'function') {
    return failure('llm-unavailable',
      'The llm service is not available in this Host; the draft button needs it.');
  }
  let route = {};
  try {
    const selection = modelSelector !== null && typeof modelSelector.currentSelection === 'function'
      ? modelSelector.currentSelection() : null;
    if (selection !== null && typeof selection?.provider === 'string') route = selection;
  } catch (error) {
    debugLog(`suggest model selection failed: ${String(error?.message ?? error)}`);
  }
  if (typeof route.provider !== 'string' || route.provider === '') {
    return failure('no-model', 'No default model selection is available for drafting.');
  }
  const started = Date.now();
  const signal = AbortSignal.timeout(SUGGEST_TIMEOUT_MS);
  let call;
  try {
    call = await llmService.prepareCall({ provider: route.provider, model: route.model, maxTokens: SUGGEST_MAX_TOKENS }, signal);
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
    system: SUGGEST_SYSTEMS[lang],
    purpose: 'dsh-tools-suggest',
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
    return failure('empty-draft', 'The model returned no usable draft text.');
  }
  debugLog(`suggest ok in=${input.length}ch out=${draft.length}ch ${Date.now() - started}ms`);
  return { ok: true, value: { draft, lang } };
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
    unregister = webServer.register({
      kind: 'exact',
      path: `/api/${RPC_KEY}`,
      handler: (request, response) => { void handleNodeRequest(request, response, log); },
    });
  } catch (error) {
    log(`[dsh-tools] webServer route mount failed: ${error?.message ?? error}`, 'warn');
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
  log('[dsh-tools] host module loaded (v0.3.0)');
  debugLog('host module loaded (v0.3.0)');
  const stopRoute = installWebServerRoute(ctx, log);
  const stopFetch = installConnectionFetch(ctx, log);
  // Runtime child fibers: capture optional services when this Host provides
  // them. Pending forever is fine — suggest degrades to a clear error.
  const stopLlm = captureService(ctx, 'llm', (service) => { llmService = service; }, () => { llmService = null; }, log);
  const stopSelector = captureService(ctx, 'agentDefaultModel', (service) => { modelSelector = service; }, () => { modelSelector = null; }, log);
  return () => {
    stopSelector();
    stopLlm();
    stopFetch();
    stopRoute();
  };
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
