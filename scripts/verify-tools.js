const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const root = path.resolve(__dirname, '..');
const toolsRoot = path.join(root, 'assets', 'ToolsSection', 'aemona-tools');
const entries = [
  'Drift/index.html',
  'Pop away/index.html',
  'Inner hear/index.html',
  'Echo Canvas/index.html',
  'Pull the thread/dist/index.html'
];
const sourceNativeEntries = new Set([
  'Drift/index.html',
  'Pop away/index.html'
]);

const failures = [];
const scripts = new Set();

for (const entry of entries) {
  const file = path.join(toolsRoot, entry);
  if (!fs.existsSync(file)) {
    failures.push(`Missing tool entry: ${entry}`);
    continue;
  }

  const html = fs.readFileSync(file, 'utf8');
  const directory = path.dirname(file);
  const referencePattern = /(?:src|href)=["']([^"']+)["']/g;
  let match;

  if (!sourceNativeEntries.has(entry) && !/aemona-embedded\.css/.test(html)) {
    failures.push(`${entry} does not load the shared Aemona tool styles`);
  }
  if (!/<body[^>]*class=["'][^"']*\btool-[^"']*["']/i.test(html)) {
    failures.push(`${entry} does not declare an Aemona tool body class`);
  }
  if (/<iframe\b/i.test(html)) {
    failures.push(`${entry} embeds an iframe instead of a native Aemona interaction`);
  }

  while ((match = referencePattern.exec(html))) {
    const reference = match[1].split(/[?#]/)[0];
    if (!reference || /^(?:https?:|#|mailto:|tel:)/i.test(reference)) continue;
    if (reference === '../index.html') continue;

    const target = path.resolve(directory, decodeURIComponent(reference));
    if (!fs.existsSync(target)) {
      failures.push(`${entry} references missing file: ${reference}`);
      continue;
    }
    if (path.extname(target).toLowerCase() === '.js') scripts.add(target);
  }
}

scripts.add(path.join(root, 'app.js'));
for (const script of scripts) {
  const result = spawnSync(process.execPath, ['--check', script], { encoding: 'utf8' });
  if (result.status !== 0) {
    failures.push(`Invalid JavaScript: ${path.relative(root, script)}\n${result.stderr.trim()}`);
  }
}

if (failures.length) {
  console.error(`Tools verification failed (${failures.length}):`);
  failures.forEach(failure => console.error(`- ${failure}`));
  process.exit(1);
}

console.log(`Tools verification passed: ${entries.length} entries and ${scripts.size} scripts checked.`);
