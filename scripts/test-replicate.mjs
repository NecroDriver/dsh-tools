// Replicates the EXACT production helper spawn from index.js handleRestart():
//   spawn('powershell.exe', [...], { detached: true, stdio: 'ignore', windowsHide: true })
// but against dummy processes, run under the Electron exe as node when invoked via
// `ELECTRON_RUN_AS_NODE=1 "DeepSeek Harness.exe" test-replicate.mjs`.
// Passes when the helper's first log line ("restart helper start") appears.
import { spawn, execFileSync } from 'node:child_process';
import { writeFileSync, readFileSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const { RESTART_HELPER_SOURCE } = await import(pathToFileURL(join(here, '..', 'index.js')).href);

const PS = 'C:\\Windows\\System32\\WindowsPowerShell\\v1.0\\powershell.exe';
const HELPER_PATH = join(tmpdir(), 'dsh-tools-restart.ps1');
const LOG = join(tmpdir(), 'dsh-tools-restart.log');
const MARKER = join(tmpdir(), 'dsh-tools-replicate-marker.txt');

const logBefore = existsSync(LOG) ? readFileSync(LOG, 'utf8') : '';
try { writeFileSync(MARKER, ''); } catch {}

// Dummy "app" and "host": plain sleeping powershell processes.
const dummyApp = spawn(PS, ['-NoProfile', '-Command', 'Start-Sleep -Seconds 120'], { stdio: 'ignore' });
const dummyHost = spawn(PS, ['-NoProfile', '-Command', 'Start-Sleep -Seconds 120'], { stdio: 'ignore' });
await new Promise(r => setTimeout(r, 700));
console.log(`dummyApp pid=${dummyApp.pid} dummyHost pid=${dummyHost.pid}`);

writeFileSync(HELPER_PATH, RESTART_HELPER_SOURCE, 'utf8');
const before = existsSync(LOG) ? readFileSync(LOG, 'utf8') : '';

// ---- EXACT production spawn ----
const child = spawn('powershell.exe', [
  '-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', HELPER_PATH,
  '-ExePath', PS,
  '-AppPid', String(dummyApp.pid),
  '-HostPid', String(dummyHost.pid),
  '-RelaunchArgs', `-Command Set-Content -LiteralPath '${MARKER}' -Value relay`,
], { detached: true, stdio: 'ignore', windowsHide: true });
child.unref();
console.log(`helper spawned pid=${child.pid} options=detached,stdio:ignore,windowsHide`);

// Wait long enough for sleep(1800ms) + kill + wait loop + relaunch.
let sawStart = false, sawDone = false, relay = false;
for (let i = 0; i < 40; i++) {
  await new Promise(r => setTimeout(r, 500));
  const now = existsSync(LOG) ? readFileSync(LOG, 'utf8') : '';
  if (!sawStart && now.length > before.length && now.includes(`appPid=${dummyApp.pid}`)) sawStart = true;
  if (!sawDone) {
    const added = now.slice(before.length);
    const m = [...added.matchAll(/helper done/g)];
    if (m.some(mm => true) && added.includes(`appPid=${dummyApp.pid}`)) sawDone = true;
  }
  if (existsSync(MARKER) && readFileSync(MARKER, 'utf8').includes('relay')) relay = true;
  if (sawDone && relay) break;
}
console.log(`sawStart=${sawStart} sawDone=${sawDone} relay=${relay}`);
const added = (existsSync(LOG) ? readFileSync(LOG, 'utf8') : '').slice(before.length);
console.log('--- helper log additions ---');
console.log(added.trim() || '(none)');

// Cleanup stragglers.
for (const p of [dummyApp, dummyHost]) { try { p.kill(); } catch {} }
const ok = sawStart && sawDone && relay;
console.log(ok ? 'REPLICATE TEST PASS' : 'REPLICATE TEST FAIL');
process.exit(ok ? 0 : 1);
