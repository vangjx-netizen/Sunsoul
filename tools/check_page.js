// Syntax check run before every deploy: if an edit broke the JavaScript in index.html (or the backend files),
// the deploy stops and the live site keeps the last working version.
// Usage: node tools/check_page.js
const fs = require('fs'); const path = require('path'); const vm = require('vm');
const root = path.join(__dirname, '..', 'public');
let bad = 0;
const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const scripts = [...html.matchAll(/<script>([\s\S]*?)<\/script>/g)].map(m => m[1]);
if (!scripts.length) { console.error('index.html: no <script> found'); bad++; }
scripts.forEach((code, i) => {
  try { new vm.Script(code, { filename: `index.html <script> #${i + 1}` }); }
  catch (e) {
    bad++;
    console.error(`index.html <script> #${i + 1}: ${e.message}`);
    const m = /index\.html <script> #\d+:(\d+)/.exec(e.stack || '');
    if (m) console.error('  near: ' + code.split('\n')[+m[1] - 1].slice(0, 200));
  }
});
for (const f of ['backend-core.js', 'backend-firebase.js', 'firebase-config.js']) {
  // ES modules: check them as module code by turning imports/exports into plain statements
  const src = fs.readFileSync(path.join(root, f), 'utf8').replace(/^\s*import[^;]*;/gm, '').replace(/^export /gm, '');
  try { new vm.Script(src, { filename: f }); } catch (e) { bad++; console.error(`${f}: ${e.message}`); }
}
if (!html.includes('const T={')) { bad++; console.error('index.html: the Lao text block (const T={) is missing'); }
console.log(bad ? `✗ ${bad} problem(s) — not deploying` : '✓ page code is valid');
process.exit(bad ? 1 : 0);
