// dsh-tools — restart-helper integration test against dummy processes.
// Exercises the exact shipped script (RESTART_HELPER_SOURCE): path validation,
// kill order (app then host), exit wait, and relaunch (marker file, hidden
// window, no quotes anywhere). Nothing touches the real DSH app.
import { spawn, execFile } from 'node:child_process';
import { existsSync, readFileSync, rmSync, truncateSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { promisify } from 'node:util';
import { RESTART_HELPER_SOURCE } from '../index.js';

const execFileAsync = promisify(execFile);

const PS = join(process.env.SystemRoot ?? 'C:\\Windows', 'System32', 'WindowsPowerShell', 'v1.0', 'powershell.exe');
const helperPath = join(tmpdir(), 'dsh-tools-restart.ps1');
const helperLog = join(tmpdir(), 'dsh-tools-restart.log');
const marker = join(tmpdir(), 'dsh-tools-marker.txt');
if (tmpdir().includes(' ')) {
  console.error('SKIP: temp dir contains spaces; marker quoting not exercised here.');
  process.exit(0);
}
if (existsSync(marker)) rmSync(marker);
writeFileSync(helperPath, RESTART_HELPER_SOURCE, 'utf8');
try { truncateSync(helperLog); } catch { /* fresh */ }

const results = [];
const check = (name, ok, detail = '') => {
  results.push({ name, ok });
  console.log(`${ok ? 'PASS' : 'FAIL'} ${name}${detail ? ` — ${detail}` : ''}`);
};

const alive = async (pid) => {
  try {
    await execFileAsync(PS, ['-NoProfile', '-NonInteractive', '-Command',
      `if (Get-Process -Id ${pid} -ErrorAction SilentlyContinue) { exit 0 } else { exit 1 }`]);
    return true;
  } catch {
    return false;
  }
};

const startDummy = (args) => new Promise((resolve, reject) => {
  const child = spawn(PS, ['-NoProfile', ...args], { stdio: 'ignore' });
  child.once('spawn', () => resolve(child));
  child.once('error', reject);
});

// dummy "app" (long sleep) and dummy "host" (long sleep), both powershell
const app = await startDummy(['-Command', 'Start-Sleep -Seconds 90']);
const host = await startDummy(['-Command', 'Start-Sleep -Seconds 90']);
check('dummy app and host running', await alive(app.pid) && await alive(host.pid), `app=${app.pid} host=${host.pid}`);

const relaunchArgs = `-NoProfile -WindowStyle Hidden -Command Set-Content -LiteralPath ${marker} -Value ok`;
const helper = spawn(PS, [
  '-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', helperPath,
  '-ExePath', PS, '-AppPid', String(app.pid), '-HostPid', String(host.pid),
  '-RelaunchArgs', relaunchArgs,
], { stdio: 'ignore' });
const helperExit = new Promise((resolve) => helper.once('exit', (code) => resolve(code)));
const code = await helperExit;
await new Promise((resolve) => setTimeout(resolve, 600));

check('helper exited 0', code === 0, `exit=${code}`);
check('dummy app stopped', !(await alive(app.pid)));
check('dummy host stopped', !(await alive(host.pid)));
check('relaunch marker written', existsSync(marker) && readFileSync(marker, 'utf8').trim() === 'ok');

let log = '';
try { log = readFileSync(helperLog, 'utf8'); } catch { /* missing */ }
const logLower = log.toLowerCase();
check('helper log tells the story',
  logLower.includes(`stopped app pid ${app.pid}`) && logLower.includes(`stopped host pid ${host.pid}`)
  && logLower.includes(`relaunched ${PS.toLowerCase()}`),
  log.split('\n').filter((line) => line.trim() !== '').slice(-3).join(' | '));

if (existsSync(marker)) rmSync(marker);
const failed = results.filter((entry) => !entry.ok);
console.log(failed.length === 0 ? 'ALL CHECKS PASSED' : `${failed.length} CHECK(S) FAILED`);
process.exit(failed.length === 0 ? 0 : 1);
