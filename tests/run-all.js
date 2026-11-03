// Runs every test suite one after another and prints a summary.
// Usage: npm test            (all suites)
//        npm test -- sell    (only suites whose name contains "sell")
const { spawnSync } = require('child_process');
const fs = require('fs');
const path = require('path');

fs.mkdirSync(path.join(__dirname, 'out'), { recursive: true });
const only = process.argv[2] || '';
const suites = fs.readdirSync(__dirname).filter(f => f.endsWith('.test.js') && f.includes(only)).sort();
let failed = [];
for (const f of suites) {
  const r = spawnSync(process.execPath, [path.join(__dirname, f)], { encoding: 'utf8' });
  const out = (r.stdout || '') + (r.stderr || '');
  const ok = r.status === 0;
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${f}`);
  if (!ok) { failed.push(f); console.log(out.split('\n').filter(l => /FAIL|ERR|Error/.test(l)).slice(0, 10).map(l => '      ' + l).join('\n')); }
}
console.log(`\n${suites.length - failed.length}/${suites.length} suites passed`);
process.exit(failed.length ? 1 : 0);
