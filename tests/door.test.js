// Door delivery, like food apps: the customer checks the item in front of the team.
// Accepted → received on the spot. Refused → team takes it back, a case opens, full refund (no return shipping).
// Not home → a 12-hour window to report a problem. The customer sees the handover photo.
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
    ST.up.ph = { data: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8DwHwAFBQIAX8jx0gAAAABJRU5ErkJggg==' };
    ST.shops.push({ id: 'city', name: 'City Shop', prov: 'ນະຄອນຫຼວງວຽງຈັນ', pickup: 'team', map: '17.97000, 102.61000' });
    const base = { pid: 'p', pname: 'ພັດລົມ', vlabel: 'ຂາວ', qty: 1, price: 100000, shopId: 'city', shopName: 'City Shop', kind: 'local', status: 'shipping', cust: { name: 'Noy', phone: '020 7777 8888' }, acct: '020 7777 8888', addr: 'ບ້ານໂພນທັນ', createdAt: 1, history: [] };
    for (const id of ['a', 'b', 'c']) { ST.orders.push({ ...base, id, no: 'SS-' + id }); ST.locks[id] = { price: 100000, qty: 1, fee: 15000, total: 115000, pay: 'qr', verifiedAt: 1 }; }
  });
  const custView = async id => { await p.evaluate(i => { S.tab = 'orders'; S.oid = i; S.screen = 'home'; render(); }, id); return p.textContent('main'); };
  const run = () => p.evaluate(() => { S.tab = 'team'; S.sub = 'run'; S.screen = 'home'; render(); });

  let t = await custView('a');
  ok(t.includes(await p.evaluate(() => T.doorT)) && !t.includes(await p.evaluate(() => T.ubT)), 'on the way: customer told to check it in front of the team (no unboxing-video notice)');
  await run();
  ok(!!(await p.$('[data-x="dok"][data-id="a"]')) && !!(await p.$('[data-x="dabsent"][data-id="a"]')) && !!(await p.$('[data-x="drefuse"][data-id="a"]')), 'team at the door: checked & accepted / not home / refused');

  // a: checked and accepted at the door
  await p.evaluate(() => { S.hd.da.photos = ['u:ph']; }); await p.click('[data-x="dok"][data-id="a"]'); await p.waitForTimeout(100);
  ok(await p.evaluate(() => { const o = byId(ST.orders, 'a'); return o.status === 'delivered' && o.doorChecked === true && o.receivedBy === 'door' && rcvd(o); }), 'accepted at the door: received on the spot');
  t = await custView('a');
  ok(t.includes(await p.evaluate(() => T.doorPh)) && !!(await p.$('[data-zoom="u:ph"]')) && !(await p.$('[data-x="received"]')), 'customer sees the handover photo; no “did you receive it?” question');
  ok(t.includes('ຊົ່ວໂມງ') && !!(await p.$('[data-x="report"]')), 'a problem can still be reported, counted in hours (12-hour window)');

  // b: not home
  await run(); await p.click('[data-x="dabsent"][data-id="b"]'); await p.waitForTimeout(100);
  ok(await p.evaluate(() => { const o = byId(ST.orders, 'b'); return o.status === 'delivered' && o.doorChecked === false && !o.receivedAt; }), 'not home: delivered, not checked');
  await p.evaluate(() => { byId(ST.orders, 'b').deliveredAt = Date.now() - 13 * 3600000; });
  await custView('b');
  ok(!(await p.$('[data-x="report"]')), 'not home, 13 hours later: the 12-hour report window has closed');

  // c: refused at the door
  await run(); await p.click('[data-x="drefuse"][data-id="c"]'); await p.waitForTimeout(60);
  await p.click('[data-x="drefok"][data-id="c"]'); await p.waitForTimeout(80);
  ok(await p.evaluate(() => byId(ST.orders, 'c').status === 'shipping'), 'refusal needs a reason and a photo');
  await p.click('[data-x="drwhy"][data-id="c"][data-k="wrong"]'); await p.fill('[data-hd="dc:note"]', 'ສັ່ງສີຂາວ ແຕ່ເປັນສີດຳ');
  await p.evaluate(() => { S.hd.dc.photos = ['u:ph']; rr(); });
  await p.click('[data-x="drefok"][data-id="c"]'); await p.waitForTimeout(120);
  const c = await p.evaluate(() => { const x = ST.cases.find(k => k.oid === 'c'); return x ? JSON.parse(JSON.stringify(x)) : null; });
  ok(!!c && c.atDoor && c.reason === 'wrong' && c.status === 'open' && c.want === 'refund' && await p.evaluate(() => !!byId(ST.orders, 'c').refusedAt), 'refused: item taken back, case opened by the team');
  t = await custView('c');
  ok(t.includes(await p.evaluate(() => T.daT)) && !!(await p.$(`[data-x="dracct"][data-id="${c.id}"]`)), 'customer: asked for a refund account (full refund, no return shipping)');
  await p.click(`[data-x="bankpick"][data-v="BCEL"]`); await p.fill(`[data-rtn="a${c.id}:acct"]`, '0101222'); await p.fill(`[data-rtn="a${c.id}:name"]`, 'NOY');
  await p.click(`[data-x="dracct"][data-id="${c.id}"]`); await p.waitForTimeout(120);
  ok(await p.evaluate(id => !!ST.cases.find(x => x.id === id).kycId, c.id), 'refund account saved to the case');
  await p.evaluate(id => { S.tab = 'team'; S.sub = 'cases'; S.cid = id; render(); }, c.id);
  ok((await p.textContent('main')).includes(await p.evaluate(() => T.csAtDoor)), 'team case page: “refused at the door”');
  await p.check('[data-xc="cowner"][data-k="store"]'); await p.fill(`[data-cnote="${c.id}"]`, 'ຮ້ານແພັກສີຜິດ');
  await p.click(`[data-x="cdecide"][data-id="${c.id}"]`); await p.waitForTimeout(120);
  ok(await p.evaluate(id => { const x = ST.cases.find(k => k.id === id); return x.status === 'closed' && x.retMode === 'team' && !!x.retGotAt && x.refund === 115000 && refundCases().some(k => k.id === id); }, c.id), 'decided: item already back with the team → full refund 115,000 straight to the refund list');
  await b.close(); console.log(fails ? fails + ' FAILED' : 'ALL PASSED'); process.exit(fails ? 1 : 0);
})();
