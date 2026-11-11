// A wrong tap on "delivered" can be taken back (12 hours, nothing happened since); the order goes back to "on the way".
const { chromium } = require('playwright'); const path = require('path');
let fails = 0; const ok = (c, m) => { console.log((c ? 'PASS ' : 'FAIL ') + m); if (!c) fails++; };
(async () => {
  const b = await chromium.launch(process.env.CHROME_PATH ? { executablePath: process.env.CHROME_PATH } : {});
  const p = await b.newPage({ viewport: { width: 430, height: 900 } });
  p.on('pageerror', e => { console.log('ERR', e.message); fails++; });
  await p.addInitScript(() => { window.claude = { use: async n => n === 'user' ? { canEdit: async () => true } : null }; });
  await p.goto('file://' + path.join(__dirname, '..', 'public', 'index.html')); await p.waitForTimeout(400);
  await p.evaluate(() => {
    ST.shops.push({ id: 'city', name: 'City', prov: 'ນະຄອນຫຼວງວຽງຈັນ', pickup: 'team', map: '17.97, 102.61' }, { id: 'lp', name: 'LP', prov: 'ຫຼວງພະບາງ', pickup: 'team', map: '19.88, 102.13' });
    const base = { pid: 'p', pname: 'ພັດລົມ', vlabel: 'ຂາວ', qty: 1, price: 100000, shopId: 'city', shopName: 'City', kind: 'local', status: 'shipping', cust: { name: 'Noy', phone: '020 7777 8888' }, acct: '020 7777 8888', addr: 'x', createdAt: 1, history: [] };
    ST.orders.push({ ...base, id: 'a', no: 'SS-a' }, { ...base, id: 'k', no: 'SS-k', kind: 'carrier', handedAt: Date.now(), receiptNo: '323' }, { ...base, id: 'r', no: 'SS-r' },
      { ...base, id: 'old', no: 'SS-old', status: 'delivered', deliveredAt: Date.now() - 3600000, receivedAt: Date.now(), receivedBy: 'customer' });
    for (const id of ['a', 'k', 'r', 'old']) ST.locks[id] = { price: 100000, qty: 1, fee: 15000, total: 115000, pay: 'qr', verifiedAt: 1 };
    S.tab = 'team'; S.sub = 'run'; render();
  });
  const st = id => p.evaluate(i => byId(ST.orders, i).status, id);
  ok(!(await p.$('[data-x="undodel"][data-id="old"]')), 'customer already confirmed receipt → cannot be undone');

  // accepted at the door, then undone
  await p.click('[data-x="dok"][data-id="a"]'); await p.waitForTimeout(100);
  ok(await st('a') === 'delivered' && !!(await p.$('[data-x="undodel"][data-id="a"]')), 'delivered order shows in “delivered recently” with an undo button');
  await p.click('[data-x="undodel"][data-id="a"]'); await p.waitForTimeout(60);
  ok(await st('a') === 'delivered', 'first tap only asks to confirm');
  await p.click('[data-x="undodel"][data-id="a"]'); await p.waitForTimeout(100);
  ok(await p.evaluate(() => { const o = byId(ST.orders, 'a'); return o.status === 'shipping' && !o.deliveredAt && !o.receivedAt && !('doorChecked' in o); }), 'second tap: back to “on the way”, delivery marks cleared');
  ok(!!(await p.$('[data-x="dok"][data-id="a"]')), 'the order is back in the delivery list');

  // carrier order marked delivered by mistake
  await p.click('[data-x="dok"][data-id="k"]'); await p.waitForTimeout(100);
  await p.click('[data-x="undodel"][data-id="k"]'); await p.click('[data-x="undodel"][data-id="k"]'); await p.waitForTimeout(100);
  ok(await st('k') === 'shipping' && await p.evaluate(() => byId(ST.orders, 'k').receiptNo === '323'), 'carrier order: undone, the carrier receipt is kept');

  // refused at the door by mistake: the case it opened is removed too
  await p.click('[data-x="drefuse"][data-id="r"]'); await p.click('[data-x="drwhy"][data-id="r"][data-k="wrong"]');
  await p.evaluate(() => { S.hd.dr.test = true; }); await p.click('[data-x="drefok"][data-id="r"]'); await p.waitForTimeout(120);
  ok(await p.evaluate(() => ST.cases.some(c => c.oid === 'r')), 'refusal opened a case');
  await p.click('[data-x="undodel"][data-id="r"]'); await p.click('[data-x="undodel"][data-id="r"]'); await p.waitForTimeout(120);
  ok(await st('r') === 'shipping' && await p.evaluate(() => !ST.cases.some(c => c.oid === 'r') && !byId(ST.orders, 'r').caseId && !byId(ST.orders, 'r').refusedAt), 'refusal undone: back to “on the way”, the case is removed');
  ok(await p.evaluate(() => byId(ST.orders, 'r').history.some(h => h.undo)), 'the undo is kept in the order history');
  await b.close(); console.log(fails ? fails + ' FAILED' : 'ALL PASSED'); process.exit(fails ? 1 : 0);
})();
