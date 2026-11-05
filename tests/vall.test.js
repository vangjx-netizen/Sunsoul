// Slip check: one button ticks all four checks; approving still takes its own tap.
const { chromium } = require('playwright'); const path = require('path');
let fails = 0; const ok = (c, m) => { console.log((c ? 'PASS ' : 'FAIL ') + m); if (!c) fails++; };
(async () => {
  const b = await chromium.launch(process.env.CHROME_PATH ? { executablePath: process.env.CHROME_PATH } : {});
  const p = await b.newPage({ viewport: { width: 430, height: 900 } });
  p.on('pageerror', e => { console.log('ERR', e.message); fails++; });
  await p.goto('file://' + path.join(__dirname, '..', 'public', 'index.html')); await p.waitForTimeout(300);
  await p.evaluate(() => {
    S.canAdmin = true; ST.shops.push({ id: 's1', name: 'tt' });
    ST.locks.A = { price: 185000, qty: 1, fee: 15000, total: 200000, pay: 'qr' };
    ST.orders.push({ id: 'A', no: 'SS-A', pid: 'p1', pname: 'x', vlabel: 'M', qty: 1, price: 185000, shopId: 's1', shopName: 'tt', status: 'await_verify', slipId: 'u:s', paidAt: Date.now(), cust: { name: 'ທອງ', phone: '2098798512' }, createdAt: Date.now(), history: [] });
    S.tab = 'team'; S.sub = 'verify'; render();
  });
  ok(await p.$eval('[data-x="vok"]', e => e.disabled), 'approve is locked before checking');
  await p.click('[data-x="vall"]'); await p.waitForTimeout(80);
  ok(await p.$$eval('[data-xc="vchk"]', l => l.every(c => c.checked)), 'one tap ticks all 4 checks');
  ok(!(await p.$eval('[data-x="vok"]', e => e.disabled)), 'approve becomes available');
  ok(await p.evaluate(() => byId(ST.orders, 'A').status === 'await_verify'), 'but nothing is approved until “approve” is pressed');
  await p.click('[data-x="vall"]'); await p.waitForTimeout(80);
  ok(await p.$$eval('[data-xc="vchk"]', l => l.every(c => !c.checked)) && await p.$eval('[data-x="vok"]', e => e.disabled), 'second tap clears them');
  await p.click('[data-x="vall"]'); await p.click('[data-x="vok"]'); await p.waitForTimeout(150);
  ok(await p.evaluate(() => byId(ST.orders, 'A').status === 'await_pickup'), 'tick all + approve → order paid');
  await b.close(); console.log(fails ? fails + ' FAILED' : 'ALL PASSED'); process.exit(fails ? 1 : 0);
})();
