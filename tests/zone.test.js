// Delivery points (like food apps) and the door-delivery zone; page zoom is off.
const { chromium } = require('playwright'); const path = require('path');
let fails = 0; const ok = (c, m) => { console.log((c ? 'PASS ' : 'FAIL ') + m); if (!c) fails++; };
(async () => {
  const b = await chromium.launch(process.env.CHROME_PATH ? { executablePath: process.env.CHROME_PATH } : {});
  // the phone's GPS says: Phonthan, Vientiane
  const ctx = await b.newContext({ viewport: { width: 430, height: 900 }, geolocation: { latitude: 17.9757, longitude: 102.6331 }, permissions: ['geolocation'] });
  const p = await ctx.newPage();
  p.on('pageerror', e => { console.log('ERR', e.message); fails++; });
  await p.goto('file://' + path.join(__dirname, '..', 'public', 'index.html')); await p.waitForTimeout(300);

  { const vp = await p.getAttribute('meta[name="viewport"]', 'content'); ok(!/user-scalable=no/.test(vp) && /initial-scale=1/.test(vp) && await p.evaluate(() => document.documentElement.innerHTML.includes('people may pinch-zoom freely')), 'pinch zoom allowed like big shopping sites'); }

  await p.evaluate(() => {
    S.user = { phone: '020 7777 8888', name: 'Noy' }; S.addrs = [];
    ST.shops.push({ id: 's1', name: 'Shop A', prov: 'ນະຄອນຫຼວງວຽງຈັນ', pickup: 'team', map: '17.97000, 102.61000' });
    ST.tp.push({ id: 'p1', name: 'Bag', cat: 'bags', shopId: 's1', shopName: 'Shop A', variants: [{ label: '—', price: 100000, stock: 9 }], imgs: [], active: true, createdAt: 1, stockAt: 1 });
    mergeP(); S.tab = 'home'; S.screen = 'home'; render();
  });
  let t = await p.textContent('main');
  ok(t.includes('ສົ່ງໄປທີ່') && t.includes('ຍັງບໍ່ໄດ້ຕັ້ງຈຸດສົ່ງ'), 'home shows “deliver to: not set yet”');

  // use current location → form filled with the GPS point → add details → saved and selected
  await p.click('[data-x="apick"]'); await p.waitForTimeout(80);
  ok(await p.evaluate(() => S.screen === 'addr') && (await p.textContent('main')).includes('ໃຊ້ຕຳແໜ່ງປັດຈຸບັນ'), 'delivery-point screen with “use my current location”');
  await p.click('[data-x="ageonew"]'); await p.waitForTimeout(500);
  ok((await p.inputValue('[data-af="map"]')).startsWith('17.9757'), 'current location read from the phone GPS');
  ok((await p.textContent('main')).includes('ສົ່ງຮອດເຮືອນ'), 'point inside the zone → “door delivery” badge');
  await p.click('[data-x="asave"]'); await p.waitForTimeout(50);
  ok(await p.evaluate(() => S.addrs.length === 0), 'address details are required');
  await p.fill('[data-af="addr"]', 'ບ້ານໂພນທັນ ເຮືອນສີຂາວ');
  await p.click('[data-x="asave"]'); await p.waitForTimeout(100);
  ok(await p.evaluate(() => S.addrs.length === 1 && S.addrs[0].map.startsWith('17.9757') && S.screen === 'home'), 'saved with its location, back to home');
  t = await p.textContent('main');
  ok(t.includes('ບ້ານໂພນທັນ ເຮືອນສີຂາວ') && t.includes('🚚'), 'home bar shows the point and door delivery; product shows 🚚');

  // a second point in Luang Prabang: outside the zone
  await p.click('[data-x="apick"]'); await p.waitForTimeout(80);
  await p.click('[data-x="anew"]'); await p.waitForTimeout(50);
  await p.fill('[data-af="map"]', 'https://www.google.com/maps?q=19.88560,102.13480');
  await p.fill('[data-af="addr"]', 'ບ້ານວັດແສນ ຫຼວງພະບາງ');
  await p.click('[data-x="asave"]'); await p.waitForTimeout(100);
  t = await p.textContent('main');
  ok(t.includes('ນອກເຂດ') && t.includes('ບ້ານວັດແສນ'), 'Luang Prabang point → “outside the zone · carrier”');
  ok(await p.evaluate(() => pMode(byId(ST.products, 'p1')) === 'shop') && !(await p.textContent('#feed')).includes('🚚'), 'with that point selected, products no longer say “door delivery”');

  // checkout follows the selected point
  await p.evaluate(() => { S.co = {}; S.pid = 'p1'; S.vi = 0; S.screen = 'product'; render(); });
  await p.click('[data-act="order"]'); await p.waitForTimeout(120);
  ok(!!(await p.$('[data-co="branch"]')) && (await p.textContent('main')).includes('ບ້ານວັດແສນ'), 'checkout: Luang Prabang point → carrier branch form');
  await p.click('[data-x="apick"][data-id="checkout"]'); await p.waitForTimeout(80);
  const rows = await p.$$eval('[data-x="asel"]', l => l.map(x => x.textContent));
  const iPhon = rows.findIndex(r => r.includes('ໂພນທັນ'));
  await p.click(`[data-x="asel"][data-i="${iPhon}"]`); await p.waitForTimeout(120);
  ok(await p.evaluate(() => S.screen === 'checkout') && !(await p.$('[data-co="branch"]')) && (await p.textContent('#cosum')).includes('15,000'), 'switch to the Phonthan point → back in checkout, door delivery, fee 15,000');
  await p.evaluate(async () => { S.co.name = 'Noy'; S.co.phone = '020 7777 8888'; await placeOrder(); await new Promise(r => setTimeout(r, 30)); });
  ok(await p.evaluate(() => { const o = ST.orders[ST.orders.length - 1]; return !!o && o.kind === 'local' && !!o.ll && dMode(o) === 'door'; }), 'order placed as door delivery with the customer location');

  // without a location the order cannot be sent
  await p.evaluate(async () => { S.addrs = []; S.co = { name: 'Noy', phone: '020 7777 8888', addr: 'x', map: '' }; S.pid = 'p1'; S.tab = 'orders'; S.screen = 'checkout'; render(); const n = ST.orders.length; await placeOrder(); window.__n = n; });
  ok(await p.evaluate(() => ST.orders.length === window.__n && S.screen === 'addr' && S.tab === 'home' && !!document.querySelector('[data-x="ageonew"]')), 'no location → not sent, taken to pick a delivery point');

  // a product the shop ships itself by carrier: no delivery point asked, order goes through without a location
  await p.evaluate(async () => {
    ST.shops.push({ id: 's2', name: 'Shop LP', prov: 'ຫຼວງພະບາງ', pickup: 'shop', map: '19.88560, 102.13480' });
    ST.tp.push({ id: 'p2', name: 'Shirt', cat: 'clothes', shopId: 's2', shopName: 'Shop LP', variants: [{ label: 'M', price: 50000, stock: 9 }], imgs: [], active: true, createdAt: 2, stockAt: 1 });
    mergeP(); S.addrs = []; S.co = {}; S.pid = 'p2'; S.vi = 0; S.tab = 'home'; S.screen = 'product'; render();
  });
  await p.click('[data-act="order"]'); await p.waitForTimeout(120);
  ok(await p.evaluate(() => pMode(byId(ST.products, 'p2')) === 'shop') && !(await p.$('[data-x="apick"][data-id="checkout"]')) && !!(await p.$('[data-co="branch"]')), 'carrier-only product: checkout asks for the branch, not a delivery point');
  await p.evaluate(async () => { Object.assign(S.co, { name: 'Noy', phone: '020 7777 8888', branch: 'ອານຸສິດ ສາຂາໂພນທັນ', brPhone: '020 5555 6666', district: 'ໄຊເສດຖາ', prov: 'ນະຄອນຫຼວງວຽງຈັນ' }); window.__n = ST.orders.length; await placeOrder(); await new Promise(r => setTimeout(r, 30)); });
  ok(await p.evaluate(() => { const o = ST.orders[ST.orders.length - 1]; return ST.orders.length === window.__n + 1 && o.pid === 'p2' && !o.map && !!o.branch && S.addrs.length === 0; }), 'carrier-only order is sent without a location (and no empty address saved)');

  // a customer inside the capital who prefers carrier: first choice on checkout, no location needed
  await p.evaluate(() => { S.addrs = [{ name: 'Noy', phone: '020 7777 8888', addr: 'ບ້ານໂພນທັນ', map: '17.97570, 102.63310' }]; S.co = {}; S.pid = 'p1'; S.vi = 0; S.tab = 'home'; S.screen = 'product'; render(); });
  await p.click('[data-act="order"]'); await p.waitForTimeout(120);
  ok(!!(await p.$('[data-x="cohow"][data-k="door"][aria-pressed="true"]')) && !!(await p.$('[data-x="apick"][data-id="checkout"]')) && !(await p.$('[data-co="branch"]')), 'checkout starts with the choice: door delivery selected, delivery point shown');
  await p.click('[data-x="cohow"][data-k="carrier"]'); await p.waitForTimeout(80);
  ok(!(await p.$('[data-x="apick"][data-id="checkout"]')) && !!(await p.$('[data-co="branch"]')) && (await p.textContent('#cosum')).includes(await p.evaluate(() => T.atBranch)), 'choosing carrier: no delivery point, branch form shown instead');
  await p.evaluate(async () => { Object.assign(S.co, { map: '', name: 'Noy', phone: '020 7777 8888', branch: 'ອານຸສິດ ສາຂາໂພນທັນ', brPhone: '020 5555 6666', district: 'ໄຊເສດຖາ', prov: 'ນະຄອນຫຼວງວຽງຈັນ' }); window.__n = ST.orders.length; await placeOrder(); await new Promise(r => setTimeout(r, 30)); });
  ok(await p.evaluate(() => { const o = ST.orders[ST.orders.length - 1]; return ST.orders.length === window.__n + 1 && o.pid === 'p1' && o.kind === 'carrier' && dMode(o) === 'team' && !o.map && !!o.branch; }), 'order sent without a location; team ships it by carrier to the branch');

  // edit and delete a point
  await p.evaluate(() => { S.addrs = [{ name: 'Noy', phone: '020 7777 8888', addr: 'old', map: '17.97570, 102.63310' }]; S.af = null; S.tab = 'home'; S.screen = 'addr'; render(); });
  await p.click('[data-x="aedit"][data-i="0"]'); await p.waitForTimeout(50);
  await p.fill('[data-af="addr"]', 'ບ້ານໃໝ່'); await p.click('[data-x="asave"]'); await p.waitForTimeout(80);
  ok(await p.evaluate(() => S.addrs.length === 1 && S.addrs[0].addr === 'ບ້ານໃໝ່'), 'edit updates the point (no duplicate)');
  await p.evaluate(() => { S.screen = 'addr'; render(); }); await p.click('[data-x="aedit"][data-i="0"]'); await p.click('[data-x="adel"]'); await p.waitForTimeout(50);
  ok(await p.evaluate(() => S.addrs.length === 0), 'delete removes it');

  // the team sets the zone radius
  await p.evaluate(() => { S.canAdmin = true; S.tab = 'team'; S.sub = 'fees'; render(); });
  ok((await p.textContent('main')).includes('ເຂດສົ່ງຮອດເຮືອນ'), 'team fees page: delivery zone setting');
  await p.fill('[data-fzonekm]', '1'); await p.click('[data-act="savef"]'); await p.waitForTimeout(100);
  ok(await p.evaluate(() => DEL().zoneKm === 1 && inZone({ lat: 17.9757, lng: 102.6331 }) === false && inZone({ lat: 17.9710, lng: 102.6190 }) === true), 'radius 1 km: Phonthan now outside, Patuxai inside');
  await b.close(); console.log(fails ? fails + ' FAILED' : 'ALL PASSED'); process.exit(fails ? 1 : 0);
})();
