// "Did you receive it?": door deliveries count as received after 12 hours without an answer, carrier orders after the
// return window; reporting a problem stays open for the whole return window either way.
const { chromium } = require('playwright'); const path = require('path');
let fails = 0; const ok = (c, m) => { console.log((c ? 'PASS ' : 'FAIL ') + m); if (!c) fails++; };
(async () => {
  const b = await chromium.launch(process.env.CHROME_PATH ? { executablePath: process.env.CHROME_PATH } : {});
  const p = await b.newPage({ viewport: { width: 430, height: 900 } });
  p.on('pageerror', e => { console.log('ERR', e.message); fails++; });
  await p.goto('file://' + path.join(__dirname, '..', 'public', 'index.html')); await p.waitForTimeout(300);
  await p.evaluate(() => {
    S.user = { phone: '020 7777 8888', name: 'Noy' };
    ST.shops.push({ id: 'city', name: 'City', prov: 'ນະຄອນຫຼວງວຽງຈັນ', pickup: 'team', map: '17.97, 102.61' }, { id: 'lp', name: 'LP', prov: 'ຫຼວງພະບາງ', pickup: 'shop' });
    const H = 3600000, base = { pid: 'p', pname: 'x', vlabel: 'M', qty: 1, price: 1000, status: 'delivered', cust: { name: 'Noy', phone: '020 7777 8888' }, acct: '020 7777 8888', createdAt: 1, history: [] };
    ST.orders.push(
      { ...base, id: 'd1', no: 'SS-1', shopId: 'city', shopName: 'City', kind: 'local', deliveredAt: Date.now() - 2 * H },
      { ...base, id: 'd2', no: 'SS-2', shopId: 'city', shopName: 'City', kind: 'local', deliveredAt: Date.now() - 13 * H },
      { ...base, id: 'c1', no: 'SS-3', shopId: 'lp', shopName: 'LP', kind: 'carrier', deliveredAt: Date.now() - 13 * H });
  });
  const view = async id => { await p.evaluate(i => { S.tab = 'orders'; S.oid = i; S.screen = 'home'; render(); }, id); return p.textContent('main'); };
  let t = await view('d1');
  ok(!!(await p.$('[data-x="received"]')) && t.includes('10 ຊົ່ວໂມງ'), 'door delivery 2 h ago: asks, “counts as received in 10 hours”');
  t = await view('d2');
  ok(await p.evaluate(() => rcvd(byId(ST.orders, 'd2'))) && !(await p.$('[data-x="received"]')), 'door delivery 13 h ago: counts as received');
  ok(!!(await p.$('[data-x="report"]')), '…but a problem can still be reported (3-day return window)');
  t = await view('c1');
  ok(await p.evaluate(() => !rcvd(byId(ST.orders, 'c1'))) && !!(await p.$('[data-x="received"]')) && t.includes('3 ມື້'), 'carrier order 13 h ago: still asked, up to 3 days');
  await b.close(); console.log(fails ? fails + ' FAILED' : 'ALL PASSED'); process.exit(fails ? 1 : 0);
})();
