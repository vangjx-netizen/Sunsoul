// Signing in with a shop's phone number opens the shop page — on Firebase only for the account linked to that shop.
const { chromium } = require('playwright'); const path = require('path'); const fs = require('fs');
let fails = 0; const ok = (c, m) => { console.log((c ? 'PASS ' : 'FAIL ') + m); if (!c) fails++; };
const PAGE = 'file://' + path.join(__dirname, '..', 'public', 'index.html');
const core = fs.readFileSync(path.join(__dirname, '..', 'public', 'backend-core.js'), 'utf8').replace(/^export /gm, '');
const fake = fs.readFileSync(path.join(__dirname, 'fake-firebase.js'), 'utf8');
const CONFIG = { projectId: 'sunsoul-01', storageBucket: 'x' };
const shop = (extra) => ({ name: 'ຮ້ານ1', phone: '020 0000 0001', prov: 'ນະຄອນຫຼວງວຽງຈັນ', pickup: 'team', ...extra });
const login = p => p.evaluate(() => { S.lg = { step: 'code', phone: '020 0000 0001', code: '123456', err: '' }; lgOk(); });

(async () => {
  const b = await chromium.launch(process.env.CHROME_PATH ? { executablePath: process.env.CHROME_PATH } : {});
  async function firebasePage(seed) {
    const p = await b.newPage({ viewport: { width: 430, height: 900 } });
    p.on('pageerror', e => { console.log('ERR', e.message); fails++; });
    await p.addInitScript(({ core, fake, seed, CONFIG }) => { eval(fake + '\n' + core + '\nwindow.__fb=makeFakeFirebase(seed);window.SUNSOUL_BACKEND=Promise.resolve(makeBackend(window.__fb,CONFIG));'); }, { core, fake, seed, CONFIG });
    await p.goto(PAGE); await p.waitForTimeout(600); return p;
  }

  // Firebase, account linked to the shop → straight to the shop page
  const linked = await firebasePage({ 'shops/s1': shop({ ownerUid: 'anon1' }) });
  await login(linked);
  ok(await linked.evaluate(() => S.tab === 'store' && S.shopId === 's1'), 'linked owner signs in with the shop number → shop page');

  // Firebase, same number but this device is not linked → stays out, told what to do
  const unlinked = await firebasePage({ 'shops/s1': shop({ ownerUid: 'someone-else' }), 'settings/contact': { wa: '020 5555 9999' } });
  await login(unlinked);
  ok(await unlinked.evaluate(() => S.tab === 'account'), 'unlinked device with the shop number → not the shop page');
  const t = await unlinked.textContent('main');
  ok(t.includes('ເບີນີ້ເປັນເບີຂອງ ຮ້ານ1'), 'tells them the number belongs to ຮ້ານ1');
  const send = await unlinked.$$eval('main a', as => as.map(a => a.getAttribute('href')).find(h => h && h.includes('wa.me')));
  ok(!!send && decodeURIComponent(send).includes('ຮ້ານ1') && decodeURIComponent(send).includes('ID: anon1'), 'one tap sends “link me to ຮ້ານ1 · ID” to the team');
  ok(!t.includes('ໜ້າຮ້ານຄ້າ (ຮ້ານຂອງຂ້ອຍ)'), 'and no shop button');

  // Firebase, a normal customer number → home as before
  const cust = await firebasePage({ 'shops/s1': shop({ ownerUid: 'anon1' }) });
  await cust.evaluate(() => { S.lg = { step: 'code', phone: '020 9879 8512', code: '123456', err: '' }; lgOk(); });
  ok(await cust.evaluate(() => S.tab === 'home'), 'customer number → home page as before');

  // Claude version (no account ids): the number is enough, as it always was there
  const claude = await b.newPage({ viewport: { width: 430, height: 900 } });
  await claude.goto(PAGE); await claude.waitForTimeout(300);
  await claude.evaluate(s => { ST.shops.push({ id: 's1', ...s }); }, shop({}));
  await login(claude);
  ok(await claude.evaluate(() => S.tab === 'store' && S.shopId === 's1'), 'Claude version: shop number → shop page');

  await b.close();
  console.log(fails ? fails + ' FAILED' : 'ALL PASSED'); process.exit(fails ? 1 : 0);
})();
