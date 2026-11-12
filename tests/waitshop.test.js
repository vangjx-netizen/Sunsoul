// Team overview: orders waiting for a shop are not listed one by one; the tile opens a list, oldest first,
// and cancelling for the shop is tucked away behind "⋯" with a confirmation.
const { chromium } = require('playwright'); const path = require('path');
let fails = 0; const ok = (c, m) => { console.log((c ? 'PASS ' : 'FAIL ') + m); if (!c) fails++; };
(async () => {
  const b = await chromium.launch(process.env.CHROME_PATH ? { executablePath: process.env.CHROME_PATH } : {});
  const p = await b.newPage({ viewport: { width: 430, height: 900 } });
  p.on('pageerror', e => { console.log('ERR', e.message); fails++; });
  await p.addInitScript(() => { window.claude = { use: async n => n === 'user' ? { canEdit: async () => true } : null }; });
  await p.goto('file://' + path.join(__dirname, '..', 'public', 'index.html')); await p.waitForTimeout(400);
  await p.evaluate(() => {
    ST.shops.push({ id: 's3', name: 'ຮ້ານ 03', phone: '020 5555 7777', pickup: 'team' });
    const now = Date.now(), base = { pid: 'p', pname: 'ພັດລົມ', vlabel: 'ຂາວ', qty: 1, price: 1000, shopId: 's3', shopName: 'ຮ້ານ 03', status: 'await_shop', cust: { name: 'N', phone: '020' }, history: [] };
    ST.orders.push({ ...base, id: 'n2', no: 'SS-NEW', createdAt: now - 60000, shopDeadline: now + 7000000 },
                   { ...base, id: 'n1', no: 'SS-OLD', createdAt: now - 6000000, shopDeadline: now + 600000 });
    S.tab = 'team'; S.sub = 'overview'; render();
  });
  let t = await p.textContent('main');
  ok(!t.includes('SS-OLD') && !t.includes('SS-NEW') && !(await p.$('[data-x="tcancel"]')), 'overview: no per-order cards and no cancel buttons');
  ok(t.includes(await p.evaluate(() => T.wsLate(1))), 'overview: one alert for the order whose shop is running out of time');
  await p.click('[data-x="tsub"][data-id="waitshop"]'); await p.waitForTimeout(80);
  t = await p.textContent('body');
  ok(t.includes('2 ອໍເດີ') && t.indexOf('SS-OLD') < t.indexOf('SS-NEW') && t.includes('1. #SS-OLD'), 'the tile opens the list: count, oldest first, numbered');
  ok(!(await p.$('[data-x="tcancel"]')) && !!(await p.$('[data-x="callshop"][data-id="n1"]')), 'contact buttons shown; cancel hidden');
  await p.click('[data-x="wsmore"][data-id="n1"]'); await p.waitForTimeout(50);
  await p.click('[data-x="tcancel"][data-id="n1"]'); await p.waitForTimeout(80);
  ok(await p.evaluate(() => byId(ST.orders, 'n1').status === 'await_shop'), '“⋯” shows cancel; first tap only asks to confirm');
  await p.click('[data-x="tcancel"][data-id="n1"]'); await p.waitForTimeout(120);
  ok(await p.evaluate(() => { const o = byId(ST.orders, 'n1'); return o.status === 'cancelled' && o.cancelWhy === 'team'; }), 'second tap cancels for the shop');
  ok(!(await p.textContent('main')).includes('SS-OLD') && (await p.textContent('body')).includes('1 ອໍເດີ'), 'list updates');
  await b.close(); console.log(fails ? fails + ' FAILED' : 'ALL PASSED'); process.exit(fails ? 1 : 0);
})();
