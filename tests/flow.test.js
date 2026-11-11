// After a decision nobody is left in the dark: customer, shop and team see the same steps, who acts next and by when.
// Scenario: home-delivery order, customer reports the wrong item, the team decides the shop is responsible, refund.
const { chromium } = require('playwright'); const path = require('path');
let fails = 0; const ok = (c, m) => { console.log((c ? 'PASS ' : 'FAIL ') + m); if (!c) fails++; };
(async () => {
  const b = await chromium.launch(process.env.CHROME_PATH ? { executablePath: process.env.CHROME_PATH } : {});
  const p = await b.newPage({ viewport: { width: 430, height: 900 } });
  p.on('pageerror', e => { console.log('ERR', e.message); fails++; });
  await p.addInitScript(() => { window.claude = { use: async n => n === 'user' ? { canEdit: async () => true } : null }; });
  await p.goto('file://' + path.join(__dirname, '..', 'public', 'index.html')); await p.waitForTimeout(400);
  await p.evaluate(() => {
    S.user = { phone: '020 7777 8888', name: 'Noy' };
    ST.shops.push({ id: 'city', name: 'ຮ້ານ 03', prov: 'ນະຄອນຫຼວງວຽງຈັນ', pickup: 'team', map: '17.97000, 102.61000' });
    ST.orders.push({ id: 'o1', no: 'SS-1', pid: 'p', pname: 'ພັດລົມ', vlabel: 'ຂາວ', qty: 1, price: 100000, shopId: 'city', shopName: 'ຮ້ານ 03', kind: 'local', status: 'delivered', doorChecked: false,
      deliveredAt: Date.now() - 3600000, cust: { name: 'Noy', phone: '020 7777 8888' }, acct: '020 7777 8888', addr: 'ບ້ານໂພນທັນ', createdAt: 1, history: [] });
    ST.locks.o1 = { price: 100000, qty: 1, fee: 15000, total: 115000, pay: 'qr', verifiedAt: 1 };
    ST.kyc.k1 = { rbank: 'BCEL', racct: '0101', rname: 'NOY' };
    ST.cases.push({ id: 'c1', no: 'R-1', uid: '', oid: 'o1', ono: 'SS-1', pname: 'ພັດລົມ', shopId: 'city', shopName: 'ຮ້ານ 03', cust: { name: 'Noy', phone: '020 7777 8888' }, reason: 'wrong', video: true, want: 'refund', kycId: 'k1', imgs: [], shipper: 'team', status: 'open', createdAt: Date.now() });
  });
  const T_ = k => p.evaluate(k2 => { const v = k2.split('.').reduce((o, x) => o[x], T); return typeof v === 'function' ? v('') : v; }, k);
  const cust = async () => { await p.evaluate(() => { S.shopId = null; S.tab = 'orders'; S.oid = 'o1'; S.screen = 'home'; render(); }); return p.textContent('main'); };
  const shop = async () => { await p.evaluate(() => { S.shopId = 'city'; S.tab = 'store'; S.ss = 'orders'; S.screen = 'home'; render(); }); return p.textContent('main'); };
  const team = async () => { await p.evaluate(() => { S.shopId = null; S.tab = 'team'; S.sub = 'overview'; S.cid = null; S.screen = 'home'; render(); }); return p.textContent('main'); };
  const tcase = () => p.evaluate(() => { S.tab = 'team'; S.sub = 'cases'; S.cid = 'c1'; render(); });
  const cs = () => p.evaluate(() => JSON.parse(JSON.stringify(ST.cases.find(x => x.id === 'c1'))));

  // team decides: shop responsible, refund
  await tcase(); await p.check('[data-xc="cowner"][data-k="store"]'); await p.fill('[data-cnote="c1"]', 'ຮ້ານແພັກສີຜິດ');
  await p.click('[data-x="cdecide"][data-id="c1"]'); await p.waitForTimeout(120);
  let c = await cs();
  ok(c.status === 'closed' && c.retMode === 'pickup' && c.retNeeded, 'home delivery: the team will collect the item from the customer');

  let t = await cust();
  ok(t.includes(await T_('puT')) && t.includes(await T_('stpPickup')), 'customer: told the team will come to collect it');
  ok(!!(await p.$('.cstp li.now')) && (await p.textContent('.cstp li.now')).includes(await T_('stpPickup')), 'customer: steps show the current step (team collects)');
  t = await shop();
  ok(t.includes('R-1') && t.includes(await T_('stpToShop')), 'shop: sees the steps, including the item coming back to the shop');
  t = await team();
  ok(t.includes(await T_('tdT')) && t.includes('ໄປຮັບເຄື່ອງຄືນຈາກລູກຄ້າ: 1'), 'team overview: “collect the item from the customer: 1”');

  // team collects the item
  await tcase();
  ok((await p.textContent('main')).includes('ບ້ານໂພນທັນ') && !(await p.$('[data-rg="c1:fee"]')), 'team case page: customer address to collect from, no return-shipping field');
  await p.click('[data-x="retgot"][data-id="c1"]'); await p.waitForTimeout(100);
  c = await cs();
  ok(!!c.retGotAt && c.refund === 115000, 'collected: full refund 115,000 (no shipping to deduct)');
  const due = await p.evaluate(() => dm(refundBy(ST.cases.find(x => x.id === 'c1'))));
  t = await cust();
  ok(t.includes(due) && t.includes('115,000'), 'customer: told the refund amount and the date it will arrive by (' + due + ')');
  t = await team();
  ok(t.includes('ຕ້ອງໂອນເງິນຄືນລູກຄ້າ: 1'), 'team overview: “refund the customer: 1”');

  // team refunds from the case page
  await tcase(); await p.evaluate(() => { S.rfProof.cc1 = 'u:rf'; rr(); }); await p.click('[data-x="rfdone"][data-id="c1"]'); await p.waitForTimeout(100);
  ok(!!(await cs()).refundedAt, 'team: refund marked from the case page');
  t = await team();
  ok(t.includes('ຕ້ອງສົ່ງເຄື່ອງຄືນຮ້ານ: 1') && !t.includes('ຕ້ອງໂອນເງິນຄືນລູກຄ້າ'), 'team overview: now “return the item to the shop: 1”');
  t = await cust();
  ok((await p.$$('.cstp li.ok')).length === 3 && (await p.textContent('.cstp li.ok:nth-child(3)')).includes('115,000'), 'customer: steps show the refund as done (decided, collected, refunded)');

  // item back to the shop → finished everywhere
  await tcase(); await p.click('[data-x="retshop"][data-id="c1"]'); await p.waitForTimeout(100);
  ok(await p.evaluate(() => caseDone(ST.cases.find(x => x.id === 'c1'))), 'all steps done');
  t = await team();
  ok(!t.includes(await T_('tdT')), 'team overview: nothing left to do');
  await p.evaluate(() => { S.tab = 'team'; S.sub = 'cases'; S.cid = null; render(); });
  ok((await p.textContent('main')).includes(await T_('stpAll')), 'team case list: “case finished”');
  t = await shop();
  ok(t.includes('R-1') && !!(await p.$('[data-x="scseen"][data-id="c1"]')), 'shop: finished case stays until the shop reads it');
  await p.click('[data-x="scseen"][data-id="c1"]'); await p.waitForTimeout(80);
  ok(!(await shop()).includes('R-1'), 'shop: read → leaves the list');
  await b.close(); console.log(fails ? fails + ' FAILED' : 'ALL PASSED'); process.exit(fails ? 1 : 0);
})();
