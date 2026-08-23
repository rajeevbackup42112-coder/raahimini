const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '../..');
const src = path.join(root, 'src');
const mockFile = path.normalize(path.join(src, 'lib/mockData.ts'));
const violations = [];

function walk(dir) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(full);
    else if (/\.(ts|tsx|js|jsx)$/.test(entry.name) && path.normalize(full) !== mockFile) {
      const text = fs.readFileSync(full, 'utf8');
      if (/from\s+['"][^'"]*mockData['"]|require\(\s*['"][^'"]*mockData['"]\s*\)/.test(text)) {
        violations.push(path.relative(root, full));
      }
    }
  }
}

walk(src);
if (violations.length) {
  throw new Error(`Prototype mockData must not feed live source paths:\n${violations.join('\n')}`);
}

console.log('No mock production imports contract: PASS');
