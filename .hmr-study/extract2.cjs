const asar = require('@electron/asar');
const path = require('path');
const fs = require('fs');
const os = require('os');

const ARCHIVE = 'D:/Program Files/deepseek/resources/app.asar';
const outRoot = path.join(os.tmpdir(), 'dsh-asar', 'pkg');
fs.mkdirSync(outRoot, { recursive: true });

const list = asar.listPackage(ARCHIVE);
const pkgs = ['dsh-session-title', 'dsh-session-persistence'];
const norm = s => s.replace(/\\/g, '/');

for (const pkg of pkgs) {
  const prefix = `/dsh/node_modules/@deepseek-ai/${pkg}/`;
  const files = list.filter(f => norm(f).startsWith(prefix));
  const dest = path.join(outRoot, pkg);
  fs.rmSync(dest, { recursive: true, force: true });
  fs.mkdirSync(dest, { recursive: true });
  for (const f of files) {
    const rel = norm(f).slice(prefix.length);
    if (!rel) continue;
    const target = path.join(dest, rel);
    fs.mkdirSync(path.dirname(target), { recursive: true });
    try {
      fs.writeFileSync(target, asar.extractFile(ARCHIVE, f.slice(1)));
    } catch (e) {
      if (/directory or link/.test(String(e.message))) continue;
      throw e;
    }
  }
  console.log(pkg, 'files:', files.length, '->', dest);
}
