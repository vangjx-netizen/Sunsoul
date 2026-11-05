// The team sets its WhatsApp number; everyone sees "contact the team", and on Firebase
// a shop owner can copy their account id or send it to the team in one tap.
const { chromium } = require('playwright'); const path = require('path'); const fs = require('fs');
let fails = 0; const ok = (c, m) => { console.log((c ? 'PASS ' : 'FAIL ') + m); if (!c) fails++; };
const corePath = path.join(__dirname, '..', 'public', 'backend-core.js');
const CONFIG = { projectId: 'sunsoul-01', storageBucket: 'sunsoul-01.firebasestorage.app' };

(async () => {
  const b = await chromium.launch(process.env.CHROME_PATH ? { executablePath: process.env.CHROME_PATH } : {});
  const core = fs.readFileSync(corePath, 'utf8').replace(/^export /gm, '');
  const fake = fs.readFileSync(path.join(__dirname, 'fake-firebase.js'), 'utf8');
  async function open(seed) {
    const p = await b.newPage({ viewport: { width: 430, height: 900 } });
    p.on('pageerror', e => { console.log('ERR', e.message); fails++; });
    await p.addInitScript(({ core, fake, seed, CONFIG }) => {
      eval(fake + '\n' + core + '\nwindow.__fb=makeFakeFirebase(seed);window.SUNSOUL_BACKEND=Promise.resolve(makeBackend(window.__fb,CONFIG));');
    }, { core, fake, seed, CONFIG });
    await p.goto('file://' + path.join(__dirname, '..', 'public', 'index.html')); await p.waitForTimeout(600);
    return p;
  }

  // team sets the number
  const team = await open({ 'admins/anon1': { name: 'Vang' } });
  await team.evaluate(() => { S.tab = 'team'; S.sub = 'fees'; render(); });
  ok((await team.textContent('main')).includes('ຊ່ອງທາງຕິດຕໍ່ທີມ'), 'team settings: contact section');
  await team.fill('[data-ctf="wa"]', '020 5555 9999');
  await team.click('[data-x="ctsave"]'); await team.waitForTimeout(150);
  const saved = await team.evaluate(() => window.__fb._docs.get('settings/contact'));
  ok(saved && saved.wa === '020 5555 9999', 'number saved in settings/contact');

  // a visitor (new page, same data)
  const seed = { 'settings/contact': saved };
  const visitor = await open(seed);
  await visitor.evaluate(() => { S.tab = 'account'; render(); });
  const t = await visitor.textContent('main');
  ok(t.includes('ຕິດຕໍ່ທີມ Sunsoul'), 'visitor: “contact the team” card on the account page');
  const links = await visitor.$$eval('main a', as => as.map(a => a.getAttribute('href')));
  ok(links.some(h => h && h.startsWith('https://wa.me/8562055559999')), 'visitor: WhatsApp button opens the team number');
  const send = links.find(h => h && h.includes('ID%3A'));
  const uid = await visitor.evaluate(() => H.uid);
  ok(!!send && send.includes(encodeURIComponent(uid)), '“send ID to team” carries this account id');
  ok(!!(await visitor.$('[data-x="copyid"]')), '“copy ID” button');
  await visitor.evaluate(() => { window.__opened = null; window.open = u => { window.__opened = u; }; });
  await visitor.evaluate(() => { document.body.insertAdjacentHTML('beforeend', '<button id="hb" data-x="help">h</button>'); });
  await visitor.evaluate(() => { const bt = document.getElementById('hb'); document.querySelector('#app').appendChild(bt); bt.click(); });
  ok(await visitor.evaluate(() => (window.__opened || '').startsWith('https://wa.me/8562055559999')), '“problem? contact Sunsoul” opens WhatsApp to the team');

  // no number yet → no dead buttons
  const bare = await open({});
  await bare.evaluate(() => { S.tab = 'account'; render(); });
  ok(!(await bare.textContent('main')).includes('ຕິດຕໍ່ທີມ Sunsoul') && !(await bare.$$eval('main a', as => as.some(a => (a.getAttribute('href') || '').includes('wa.me')))), 'no number set: no contact buttons that lead nowhere');
  await b.close();
  console.log(fails ? fails + ' FAILED' : 'ALL PASSED'); process.exit(fails ? 1 : 0);
})();
