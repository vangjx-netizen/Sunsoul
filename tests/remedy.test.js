// Return cases: the customer chooses refund or exchange; the team decides; the shop sees the case and what to do.
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
    ST.shops.push({ id: 's1', name: 'Shop A', prov: 'ຫຼວງພະບາງ', pickup: 'shop', map: '19.88560, 102.13480' }, { id: 's2', name: 'City Shop', prov: 'ນະຄອນຫຼວງວຽງຈັນ', pickup: 'team', map: '17.97000, 102.61000' });
    const base = { pid: 'p1', pname: 'ເສື້ອ', vlabel: 'ດຳ · M', qty: 1, price: 100000, shopId: 's1', shopName: 'Shop A', kind: 'local', status: 'delivered', cust: { name: 'Noy', phone: '020 7777 8888' }, acct: '020 7777 8888', createdAt: Date.now() - 2 * 86400000, deliveredAt: Date.now() - 3600000, history: [] };
    ST.orders.push({ ...base, id: 'o1', no: 'SS-1', kind: 'carrier' }, { ...base, id: 'o2', no: 'SS-2', kind: 'carrier' }, { ...base, id: 'o3', no: 'SS-3', shopId: 's2', shopName: 'City Shop' });
  });
  const custForm = async (oid, want) => {
    await p.evaluate(o => { S.shopId = null; S.oid = o; S.rt = { reason: '', note: '', imgs: [], video: null }; S.tab = 'home'; S.screen = 'return'; render(); }, oid);
    await p.click('[data-x="rtreason"][data-k="wrong"]'); await p.click('[data-x="rtvid"][data-k="1"]');
    await p.click(`[data-x="rtwant"][data-k="${want}"]`); await p.waitForTimeout(50);
  };
  const caseOfO = oid => p.evaluate(o => { const c = ST.cases.find(x => x.oid === o); return c ? JSON.parse(JSON.stringify(c)) : null; }, oid);
  const shopView = async () => { await p.evaluate(() => { S.shopId = 's1'; S.tab = 'store'; S.ss = 'orders'; S.screen = 'home'; render(); }); await p.waitForTimeout(80); return p.textContent('main'); };
  const decide = async (cid, remedy) => {
    await p.evaluate(id => { S.tab = 'team'; S.sub = 'cases'; S.cid = id; S.screen = 'home'; render(); }, cid);
    await p.check('[data-xc="cowner"][data-k="store"]'); await p.waitForTimeout(50);
    if (remedy) { await p.click(`[data-x="cremedy"][data-k="${remedy}"]`); await p.waitForTimeout(50); }
    await p.fill(`[data-cnote="${cid}"]`, 'ຮ້ານສົ່ງສີຜິດ'); await p.click(`[data-x="cdecide"][data-id="${cid}"]`); await p.waitForTimeout(120);
  };

  // ---- home delivery in the city: refund only ----
  await p.evaluate(() => { S.oid = 'o3'; S.rt = { reason: '', note: '', imgs: [], video: null }; S.tab = 'home'; S.screen = 'return'; render(); });
  await p.click('[data-x="rtreason"][data-k="wrong"]'); await p.click('[data-x="rtvid"][data-k="1"]'); await p.waitForTimeout(50);
  ok(await p.evaluate(() => dMode(byId(ST.orders, 'o3')) === 'door') && !(await p.$('[data-x="rtwant"]')) && !!(await p.$('[data-rt="racct"]')), 'home-delivery order: no exchange option, refund account asked');

  // ---- exchange (order went by carrier) ----
  await custForm('o1', 'exchange');
  ok(!(await p.$('[data-rt="racct"]')) && (await p.textContent('main')).includes(await p.evaluate(() => T.wnExS)), 'exchange chosen: no bank fields, explains what happens');
  await p.evaluate(() => { S.rt.imgs = ['u:a', 'u:b']; rr(); }); await p.click('[data-x="rtsend"]'); await p.waitForTimeout(150);
  let c = await caseOfO('o1');
  ok(!!c && c.want === 'exchange' && c.status === 'open', 'case sent with “exchange” and without a bank account');
  let t = await shopView();
  ok(t.includes(await p.evaluate(() => T.scT)) && t.includes(c.no) && t.includes(await p.evaluate(() => T.scChip.open)), 'shop: sees the complaint while the team checks it');
  await decide(c.id, null);
  c = await caseOfO('o1');
  ok(c.status === 'closed' && c.owner === 'store' && c.remedy === 'exchange' && c.refund === 0, 'team: shop responsible, exchange (customer’s choice preselected), no refund');
  ok(await p.evaluate(() => caseHold(byId(ST.orders, 'o1')) && !forfeit(byId(ST.orders, 'o1'))), 'shop payout for that order is held until the exchange is done (not lost)');
  t = await shopView();
  ok(t.includes(await p.evaluate(() => T.scChip.ex)) && !!(await p.$(`[data-x="scready"][data-id="${c.id}"]`)), 'shop: told to prepare the correct item, with a “ready” button');
  await p.click(`[data-x="scready"][data-id="${c.id}"]`); await p.waitForTimeout(100);
  ok(!!(await caseOfO('o1')).shopReadyAt && (await p.textContent('main')).includes(await p.evaluate(() => T.scReady)), 'shop: “ready” recorded');
  await p.evaluate(id => { S.tab = 'team'; S.sub = 'cases'; S.cid = id; render(); }, c.id);
  ok((await p.textContent('main')).includes(await p.evaluate(() => T.rmShopReady('').trim())), 'team: sees the shop is ready');
  await p.click(`[data-x="cexdone"][data-id="${c.id}"]`); await p.waitForTimeout(100);
  ok(await p.evaluate(() => !caseHold(byId(ST.orders, 'o1')) && !forfeit(byId(ST.orders, 'o1'))) && !!(await caseOfO('o1')).exDoneAt, 'exchange done → shop gets paid for the order');
  t = await shopView();
  ok(!t.includes(c.no), 'shop: finished exchange leaves the list');
  await p.evaluate(() => { S.shopId = null; S.tab = 'orders'; S.oid = 'o1'; S.screen = 'home'; render(); });
  ok((await p.textContent('main')).includes(await p.evaluate(() => T.cuExDone)), 'customer: sees the item was exchanged');

  // ---- refund ----
  await custForm('o2', 'refund');
  ok(!!(await p.$('[data-rt="racct"]')), 'refund chosen: bank fields asked');
  await p.fill('[data-rt="rbank"]', 'BCEL'); await p.fill('[data-rt="racct"]', '0101'); await p.fill('[data-rt="rname"]', 'NOY');
  await p.evaluate(() => { S.rt.imgs = ['u:a', 'u:b']; rr(); }); await p.click('[data-x="rtsend"]'); await p.waitForTimeout(150);
  let c2 = await caseOfO('o2');
  await decide(c2.id, null);
  c2 = await caseOfO('o2');
  ok(c2.remedy === 'refund' && c2.refund > 0 && await p.evaluate(() => forfeit(byId(ST.orders, 'o2'))), 'refund: customer refunded, shop not paid for that order');
  t = await shopView();
  ok(t.includes(await p.evaluate(() => T.scChip.refund)) && t.includes('ຮ້ານສົ່ງສີຜິດ'), 'shop: told it is responsible, with the team’s message');
  ok(t.includes(await p.evaluate(() => T.cmpOrd)) && t.includes('ດຳ · M × 1') && t.includes(await p.evaluate(() => T.cmpGot)) && (await p.$$(`.cmpc [data-zoom="u:a"]`)).length === 1 && t.includes(await p.evaluate(() => T.cmpWhere)), 'shop: sees what was ordered next to what the customer got, and where it went wrong');
  await p.click(`[data-x="scmore"][data-id="${c2.id}"]`); await p.waitForTimeout(80);
  t = await p.textContent('main');
  ok(t.includes(await p.evaluate(() => T.scRulesT)) && t.includes('ຮ້ານຝາກຂົນສົ່ງເອງ'), 'shop: “details” shows the rules for when the shop is responsible');
  await p.evaluate(() => { ST.contact = { wa: '8562055556666' }; window.__wa = []; window.open = u => window.__wa.push(u); });
  await p.click(`[data-x="scask"][data-id="${c2.id}"]`); await p.waitForTimeout(120);
  const wa = await p.evaluate(() => decodeURIComponent(window.__wa[0] || ''));
  ok(wa.includes('wa.me/8562055556666') && wa.includes(c2.no) && wa.includes('Shop A'), 'shop: “disagree · contact Sunsoul” opens WhatsApp with shop, case and order');
  ok(!!(await caseOfO('o2')).shopAskAt, 'case notes that the shop contacted the team');
  await p.evaluate(id => { S.tab = 'team'; S.sub = 'cases'; S.cid = id; render(); }, c2.id);
  ok((await p.textContent('main')).includes('ຮ້ານຕິດຕໍ່ທີມ'), 'team: case page shows the shop got in touch');
  await shopView();
  await p.click(`[data-x="scseen"][data-id="${c2.id}"]`); await p.waitForTimeout(100);
  ok(!(await shopView()).includes(c2.no), 'shop: “got it” clears the notice');
  await b.close(); console.log(fails ? fails + ' FAILED' : 'ALL PASSED'); process.exit(fails ? 1 : 0);
})();
