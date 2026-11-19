// Isolates which spawn option kills the helper under the Electron-as-node runtime.
const { spawn } = require('node:child_process');
const { writeFileSync, readFileSync, existsSync, openSync } = require('node:fs');
const { tmpdir } = require('node:os');
const path = require('node:path');
const { pathToFileURL } = require('node:url');

const PS = 'C:\\Windows\\System32\\WindowsPowerShell\\v1.0\\powershell.exe';
const HELPER = path.join(tmpdir(), 'dsh-tools-restart.ps1');
const LOG = path.join(tmpdir(), 'dsh-tools-restart.log');
const ERRF = path.join(tmpdir(), 'dsh-tools-matrix-stderr.txt');

async function main() {
  const { RESTART_HELPER_SOURCE } = await import(pathToFileURL(path.join(__dirname, '..', 'index.js')).href);
  writeFileSync(HELPER, RESTART_HELPER_SOURCE, 'utf8');
  writeFileSync(ERRF, '');

  const modes = [
    ['prod    (detached+ignore+hide)', { detached: true, stdio: 'ignore', windowsHide: true }],
    ['noHide  (detached+ignore)     ', { detached: true, stdio: 'ignore', windowsHide: false }],
    ['noDetach(ignore+hide)         ', { detached: false, stdio: 'ignore', windowsHide: true }],
    ['pipe    (detached+hide)       ', { detached: true, stdio: ['ignore', 'ignore', 'ignore'], windowsHide: true }],
    ['errfile (detached+hide)       ', { detached: true, stdio: ['ignore', 'ignore', 'pipe'], windowsHide: true }],
  ];

  for (const [label, opts] of modes) {
    const before = existsSync(LOG) ? readFileSync(LOG, 'utf8') : '';
    const dummyApp = spawn(PS, ['-NoProfile', '-Command', 'Start-Sleep -Seconds 90'], { stdio: 'ignore' });
    const dummyHost = spawn(PS, ['-NoProfile', '-Command', 'Start-Sleep -Seconds 90'], { stdio: 'ignore' });
    await new Promise(r => setTimeout(r, 600));
    const errMark = `=== mode ${label.trim()} ===`;
    let child;
    try {
      child = spawn('powershell.exe', [
        '-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', HELPER,
        '-ExePath', PS, '-AppPid', String(dummyApp.pid), '-HostPid', String(dummyHost.pid),
      ], opts);
    } catch (e) {
      console.log(`${label} spawn threw: ${e.message}`);
      try { dummyApp.kill(); dummyHost.kill(); } catch {}
      continue;
    }
    let spawnErr = '';
    child.on('error', (e) => { spawnErr = `error:${e.message}`; });
    if (child.stderr) child.stderr.on('data', (d) => { try { require('node:fs').appendFileSync(ERRF, errMark + '\n' + d); } catch {} });
    try { child.unref(); } catch {}

    let started = false;
    for (let i = 0; i < 24 && !started; i++) {
      await new Promise(r => setTimeout(r, 500));
      const now = existsSync(LOG) ? readFileSync(LOG, 'utf8') : '';
      started = now.length > before.length && now.slice(before.length).includes(`appPid=${dummyApp.pid}`);
    }
    console.log(`${label} pid=${child.pid} started=${started} ${spawnErr}`);
    // give the helper a chance to finish its kill pass, then clean up
    await new Promise(r => setTimeout(r, 3500));
    try { dummyApp.kill(); } catch {}
    try { dummyHost.kill(); } catch {}
    await new Promise(r => setTimeout(r, 400));
  }
  console.log('--- stderr captures ---');
  console.log(existsSync(ERRF) ? readFileSync(ERRF, 'utf8') : '(none)');
}
main().catch(e => { console.error(e); process.exit(1); });
