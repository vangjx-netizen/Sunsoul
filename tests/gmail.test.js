// Team and shop owners by Gmail: access follows the Google account to any device and survives logging out.
const { chromium } = require('playwright'); const path = require('path');
let fails = 0; const ok = (c, m) => { console.log((c ? 'PASS ' : 'FAIL ') + m); if (!c) fails++; };
(async () => {
  const b = await chromium.launch(process.env.CHROME_PATH ? { executablePath: process.env.CHROME_PATH } : {});
  const p = await b.newPage({ viewport: { width: 430, height: 900 } });
  p.on('pageerror', e => { console.log('ERR', e.message); fails++; });
  await p.goto('file://' + path.join(__dirname, '..', 'public', 'index.html')); await p.waitForTimeout(300);
  await p.evaluate(() => {
    ST.shops.push({ id: 'm1', name: 'Mail Shop', phone: '020 1111 2222', ownerEmail: 'owner@gmail.com' }, { id: 'u1', name: 'Uid Shop', ownerUid: 'dev-1' });
    H.scoped = true; S.siteKnown = true; H.uid = 'phone-uid'; H.email = '';
  });
  ok(await p.evaluate(() => !ownShop(byId(ST.shops, 'm1'))), 'without the Gmail: not the owner');
  await p.evaluate(() => { H.email = 'owner@gmail.com'; });
  ok(await p.evaluate(() => ownShop(byId(ST.shops, 'm1')) && !ownShop(byId(ST.shops, 'u1'))), 'signed in with the shop’s Gmail: owner of that shop only');
  await p.evaluate(() => { H.uid = 'dev-1'; H.email = ''; });
  ok(await p.evaluate(() => ownShop(byId(ST.shops, 'u1'))), 'old ID linking still works');

  // shop owner signing in with the shop's number lands in the shop when the Gmail matches
  await p.evaluate(() => { H.uid = 'new-device'; H.email = 'owner@gmail.com'; S.lg = { step: 'phone', phone: '020 1111 2222', code: '', err: '' }; finishLogin('Owner'); });
  ok(await p.evaluate(() => S.tab === 'store' && S.shopId === 'm1'), 'owner by Gmail on a new device goes straight to the shop');

  // team list in settings
  await p.evaluate(() => {
    window.__w = []; const ref = k => ({ set: async d => { window.__w.push(['set', k]); }, delete: async () => { window.__w.push(['del', k]); } });
    H.db = { doc: ref, collection: c => ({ doc: id => ref(c + '/' + id), onSnapshot: () => () => {} }) };
    ST.teamEmails = [{ id: 'owner@gmail.com' }, { id: 'helper@gmail.com' }];
    S.canAdmin = true; S.tab = 'team'; S.sub = 'fees'; S.screen = 'home'; render();
  });
  let t = await p.textContent('main');
  ok(t.includes(await p.evaluate(() => T.tmT)) && t.includes('helper@gmail.com') && !(await p.$('[data-x="tmrm"][data-id="owner@gmail.com"]')), 'settings: team Gmail list (you cannot remove yourself)');
  await p.fill('[data-tm="1"]', 'not-an-email'); await p.click('[data-x="tmadd"]'); await p.waitForTimeout(80);
  ok(await p.evaluate(() => window.__w.length === 0), 'a wrong e-mail is refused');
  await p.fill('[data-tm="1"]', ' New@Gmail.com '); await p.click('[data-x="tmadd"]'); await p.waitForTimeout(80);
  ok(await p.evaluate(() => JSON.stringify(window.__w) === JSON.stringify([['set', 'teamEmails/new@gmail.com']])), 'adds a team member (trimmed, lower-case)');
  await p.click('[data-x="tmrm"][data-id="helper@gmail.com"]'); await p.waitForTimeout(50);
  await p.click('[data-x="tmrm"][data-id="helper@gmail.com"]'); await p.waitForTimeout(80);
  ok(await p.evaluate(() => window.__w.some(x => x[0] === 'del' && x[1] === 'teamEmails/helper@gmail.com')), 'removes a team member after confirming');

  // logging out as team: warned first
  await p.evaluate(() => { S.user = { phone: '020 1111 2222', name: 'Boss', email: 'owner@gmail.com' }; H.be = null; S.tab = 'account'; S.confirm = ''; render(); });
  await p.click('[data-x="logout"]'); await p.waitForTimeout(80);
  ok(await p.evaluate(() => !!S.user && S.confirm === 'logout') && (await p.textContent('[data-x="logout"]')).includes(await p.evaluate(() => T.loSure)), 'team logging out: warned, asked to confirm');
  await p.click('[data-x="logout"]'); await p.waitForTimeout(80);
  ok(await p.evaluate(() => !S.user), 'second tap logs out');
  await b.close(); console.log(fails ? fails + ' FAILED' : 'ALL PASSED'); process.exit(fails ? 1 : 0);
})();
