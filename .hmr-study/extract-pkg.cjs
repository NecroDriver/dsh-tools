// Extract selected @deepseek-ai packages from the DSH app.asar to %TEMP%\dsh-asar\pkg
const path = require('path');
const os = require('os');
const fs = require('fs');

async function main() {
  const asarPath = 'D:\\Program Files\\deepseek\\resources\\app.asar';
  const pkgs = process.argv.slice(2);
  if (pkgs.length === 0) { console.error('no packages requested'); process.exit(1); }
  let asar;
  try { asar = require('@electron/asar'); }
  catch {
    // npx env may not expose it; try the npx cache
    const { execSync } = require('child_process');
    const root = execSync('npm root -g', { encoding: 'utf8' }).trim();
    asar = require(path.join(root, '@electron', 'asar'));
  }
  const outRoot = path.join(os.tmpdir(), 'dsh-asar', 'pkg');
  fs.mkdirSync(outRoot, { recursive: true });
  for (const pkg of pkgs) {
    const entry = path.join('dsh', 'node_modules', '@deepseek-ai', pkg);
    const dest = path.join(outRoot, pkg);
    fs.rmSync(dest, { recursive: true, force: true });
    await asar.extractFile(asarPath, entry); // extractFile writes basename into cwd when archive root differs
    console.log('extracted', pkg, '->', dest);
  }
}
main().catch(e => { console.error(e); process.exit(1); });
