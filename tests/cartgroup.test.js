// Two items from the same shop ordered together are one order for the customer: one card, one QR, paid once.
const { chromium } = require('playwright'); const path = require('path');
let fails = 0; const ok = (c, m) => { console.log((c ? 'PASS ' : 'FAIL ') + m); if (!c) fails++; };
(async () => {
  const b = await chromium.launch(process.env.CHROME_PATH ? { executablePath: process.env.CHROME_PATH } : {});
  const p = await b.newPage({ viewport: { width: 430, height: 900 } });
  p.on('pageerror', e => { console.log('ERR', e.message); fails++; });
  await p.goto('file://' + path.join(__dirname, '..', 'public', 'index.html')); await p.waitForTimeout(300);
  await p.evaluate(async () => {
    S.user = { phone: '2098798512', name: 'Vang' };
    ST.shops.push({ id: 's3', name: 'ຮ້ານ 03', prov: 'ນະຄອນຫຼວງວຽງຈັນ', pickup: 'team', map: '17.9700, 102.6100' });
    const pr = (id, name, price) => ({ id, name, cat: 'home', shopId: 's3', shopName: 'ຮ້ານ 03', variants: [{ label: 'ສີຂາວ', price, stock: 5 }], imgs: [], active: true, createdAt: 1, stockAt: 1 });
    ST.tp.push(pr('fan', 'ພັດລົມຕັ້ງໂຕະ', 3000), pr('rice', 'ໝໍ້ຫຸງເຂົ້າໄຟຟ້າ 1.8 ລິດ', 550000)); mergeP();
    S.cart = [{ pid: 'fan', vlabel: 'ສີຂາວ', qty: 1 }, { pid: 'rice', vlabel: 'ສີຂາວ', qty: 1 }];
    S.addrs = [{ name: 'Vang', phone: '2098798512', addr: 'ບ້ານໜອງວຽງຄຳ', map: '17.97570, 102.63310' }];
    S.coCart = true; startOrder(); S.co.name = 'Vang'; S.co.phone = '2098798512'; await placeOrder();
  });
  const ids = await p.evaluate(() => ST.orders.map(o => o.id));
  ok(ids.length === 2 && await p.evaluate(() => !!ST.orders[0].gid && ST.orders[0].gid === ST.orders[1].gid), 'cart with 2 items from one shop → 2 lines with the same cart number');
  await p.evaluate(() => { S.tab = 'orders'; S.oid = null; S.screen = 'home'; render(); });
  ok((await p.$$('main .orow')).length === 1 && (await p.textContent('main')).includes('2 ລາຍການ'), 'my orders: ONE card “🛒 2 items”');

  // the shop confirms only the first item
  await p.evaluate(async id => { const o = byId(ST.orders, id); await setOrder(o, { status: 'await_pay', shopAt: Date.now(), payDeadline: Date.now() + 1800000 }, 'shop', 'await_shop'); }, ids[0]);
  await p.evaluate(id => { S.oid = id; render(); }, ids[0]);
  let t = await p.textContent('main');
  ok(t.includes(await p.evaluate(() => T.grpWait(1))) && !(await p.$('.qrbox')), 'one item confirmed: no QR yet, “waiting for the shop to confirm 1 more item”');
  ok(t.includes(await p.evaluate(() => T.grpCard(2))), 'order page lists both items of the cart order');

  // the shop confirms the second item → one QR for everything
  await p.evaluate(async id => { const o = byId(ST.orders, id); await setOrder(o, { status: 'await_pay', shopAt: Date.now(), payDeadline: Date.now() + 1800000 }, 'shop', 'await_shop'); render(); }, ids[1]);
  t = await p.textContent('main');
  const total = await p.evaluate(() => payGroup(ST.orders[0]).reduce((a, x) => a + owedOf(x), 0));
  ok((await p.$$('.qrbox')).length === 1 && total === 3000 + 550000 + 15000 && t.includes('568,000'), 'both confirmed: ONE QR for 568,000 (items + one delivery fee)');
  await p.evaluate(id => { S.oid = id; render(); }, ids[1]);
  ok((await p.textContent('main')).includes('568,000'), 'the same single payment from either item');
  ok(await p.evaluate(() => ordAlerts() === 1), 'the orders tab badge counts the cart order once');
  // auto-cancel waits while an item still waits for the shop
  ok(await p.evaluate(() => { const s = sibsOf(ST.orders[0]); return s.length === 2; }), 'items found as one cart order');
  await b.close(); console.log(fails ? fails + ' FAILED' : 'ALL PASSED'); process.exit(fails ? 1 : 0);
})();
