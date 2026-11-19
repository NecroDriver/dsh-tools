// E2E test of the v0.2.3 two-stage launch, exercising the exported production
// function launchRestartHelper() under the Electron exe as node (the same
// runtime the Web Host uses). Passes when the helper (spawned via WMI under
// WmiPrvSE) stops both dummy processes, waits, and relaunches — evidenced by
// its own log lines.
const { spawn } = require('node:child_process');
const { writeFileSync, readFileSync, existsSync } = require('node:fs');
const { tmpdir } = require('node:os');
const path = require('node:path');
const { pathToFileURL } = require('node:url');

const PS = 'C:\\Windows\\System32\\WindowsPowerShell\\v1.0\\powershell.exe';
const HELPER = path.join(tmpdir(), 'dsh-tools-restart.ps1');
const LOG = path.join(tmpdir(), 'dsh-tools-restart.log');
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function main() {
  const mod = await import(pathToFileURL(path.join(__dirname, '..', 'index.js')).href);
  writeFileSync(HELPER, mod.RESTART_HELPER_SOURCE, 'utf8');
  const before = existsSync(LOG) ? readFileSync(LOG, 'utf8') : '';

  const dummyApp = spawn(PS, ['-NoProfile', '-Command', 'Start-Sleep -Seconds 120'], { stdio: 'ignore' });
  const dummyHost = spawn(PS, ['-NoProfile', '-Command', 'Start-Sleep -Seconds 120'], { stdio: 'ignore' });
  await sleep(700);
  console.log(`dummyApp pid=${dummyApp.pid} dummyHost pid=${dummyHost.pid}`);

  const facts = { appExe: PS, appPid: dummyApp.pid, hostPid: dummyHost.pid };
  const launched = mod.launchRestartHelper(facts, { relaunchArgs: '' });
  if (launched.error) throw new Error(`launchRestartHelper refused: ${launched.error}`);
  console.log(`wrapper pid=${launched.child.pid}`);

  const need = [
    (s) => s.includes(`restart helper start`) && s.includes(`appPid=${dummyApp.pid}`),
    (s) => s.includes(`stopped app pid ${dummyApp.pid}`),
    (s) => s.includes(`stopped host pid ${dummyHost.pid}`),
    (s) => s.includes('exit wait done'),
    (s) => s.includes('relaunched '),
    (s) => s.includes('restart helper done'),
  ];
  const names = ['start', 'stop-app', 'stop-host', 'wait-done', 'relaunch', 'done'];
  const seen = new Array(need.length).fill(false);
  for (let i = 0; i < 60; i++) {
    await sleep(500);
    const added = (existsSync(LOG) ? readFileSync(LOG, 'utf8') : '').slice(before.length);
    need.forEach((fn, j) => { if (!seen[j] && fn(added)) { seen[j] = true; console.log(`[${names[j]}] ok (+${(i + 1) * 0.5}s)`); } });
    if (seen.every(Boolean)) break;
  }
  const added = (existsSync(LOG) ? readFileSync(LOG, 'utf8') : '').slice(before.length);
  console.log('--- helper log additions ---');
  console.log(added.trim() || '(none)');

  // Kill the relaunched bare powershell (hidden console from Start-Process).
  try {
    const { execFileSync } = require('node:child_process');
    const out = execFileSync('powershell.exe', ['-NoProfile', '-Command',
      '[Console]::OutputEncoding=[System.Text.Encoding]::UTF8; Get-CimInstance Win32_Process -Filter "Name=\'powershell.exe\'" | Where-Object { $_.CommandLine -match \'^\"?C:\\\\Windows\\\\System32\\\\WindowsPowerShell\\\\v1\\.0\\\\powershell\\.exe\"? ?$\' } | ForEach-Object { Stop-Process -Id $_.ProcessId -Force; $_.ProcessId }'], { timeout: 15000 }).toString().trim();
    if (out) console.log(`cleaned relaunched stray: ${out.split(/\s+/).join(',')}`);
  } catch (e) { console.log(`stray cleanup note: ${e.message.split('\n')[0]}`); }

  const ok = seen.every(Boolean);
  console.log(ok ? 'TWO-STAGE TEST PASS' : 'TWO-STAGE TEST FAIL');
  process.exit(ok ? 0 : 1);
}
main().catch((e) => { console.error(e); process.exit(1); });
