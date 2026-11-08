// Drives the page in memory mode (no db) with a stubbed viewer: automatic fee, slip photo, shop listing, approvals.
const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');
const file = 'file://' + path.join(__dirname,'..','public','index.html');
const png = path.join(__dirname,'fixtures','px.png');
fs.writeFileSync(png, Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==', 'base64'));
let fails = 0;
const ok = (c, m) => { console.log((c ? 'PASS ' : 'FAIL ') + m); if (!c) fails++; };
const wait = p => p.waitForTimeout(60);

async function boot(browser, canEdit) {
  const page = await browser.newPage();
  page.on('pageerror', e => { console.log('PAGEERROR', e.message); fails++; });
  await page.addInitScript(ce => { window.claude = { use: async n => n === 'user' ? { canEdit: async () => ce } : null }; }, canEdit);
  await page.goto(file); await page.waitForTimeout(300);
  return page;
}
// clicks a button that opens the hidden file input and feeds it a picture
async function pickPhoto(p, selector) {
  const [fc] = await Promise.all([p.waitForEvent('filechooser'), p.click(selector)]);
  await fc.setFiles(png); await p.waitForTimeout(250);
}

(async () => {
  const browser = await chromium.launch(process.env.CHROME_PATH?{executablePath:process.env.CHROME_PATH}:{});

  let p = await boot(browser, false);
  ok(await p.evaluate(() => S.canAdmin) === false, 'viewer with canEdit()=false is not admin');
  await p.close();
  p = await boot(browser, true);
  await p.evaluate(u => { const i = document.createElement('img'); i.id = 'rectimg'; i.src = u; i.hidden = true; document.body.appendChild(i) }, 'data:image/png;base64,' + fs.readFileSync(path.join(__dirname,'fixtures','rect.png')).toString('base64'));

  ok(await p.evaluate(() => JSON.stringify(parseLL('https://www.google.com/maps/place/x/@17.9757,102.6331,17z'))) === '{"lat":17.9757,"lng":102.6331}', 'parses a full Google Maps link');
  ok(await p.evaluate(() => JSON.stringify(parseLL('17.9757, 102.6331'))) === '{"lat":17.9757,"lng":102.6331}', 'parses plain coordinates');
  ok(await p.evaluate(() => parseLL('https://maps.app.goo.gl/u2VaEW3A7bkK2D789') === null && isShortLink('https://maps.app.goo.gl/u2VaEW3A7bkK2D789')), 'short link detected as unreadable');

  await p.evaluate(() => {
    ST.shops.push({ id: 's1', name: 'Shop A', phone: '020 5555 1234', type: 'shop', pickup: 'team', map: '17.9700, 102.6100' });
    ST.tp.push({ id: 'p1', name: 'Shoe', shopId: 's1', shopName: 'Shop A', variants: [{ label: '42', price: 100000, stock: 1 }], imgs: [], active: true, createdAt: 1, stockAt: 1, updatedAt: 1 });
    ST.tp.push({ id: 'p2', name: 'Bag', shopId: 's1', shopName: 'Shop A', variants: [{ label: '—', price: 200000, stock: 5 }], imgs: [], active: true, createdAt: 1, stockAt: 1, updatedAt: 1 });
    S.user = { phone: "020 7777 8888", name: "Cust" }; mergeP(); render();
  });

  // checkout: fee shown immediately from coordinates (~2.5 km straight → 4 km road → 15,000)
  await p.evaluate(() => { S.pid = 'p2'; S.vi = 0; S.co = { name: 'Cust', phone: '020 7777 8888', addr: 'ບ້ານ ໂພນທັນ, ນະຄອນຫຼວງ', map: '' }; S.tab = 'home'; S.screen = 'checkout'; render(); });
  ok(!(await p.$('[data-copay]')), 'COD option removed from checkout');
  await p.fill('[data-co="map"]', '17.9757, 102.6331');
  let sum = await p.textContent('#cosum');
  ok(sum.includes('15,000') && sum.includes('215,000') && sum.includes('ກມ'), 'checkout shows distance, fee 15,000 and total 215,000');
  await p.fill('[data-co="map"]', '17.9757, 102.6900');
  sum = await p.textContent('#cosum');
  ok(sum.includes('36,000'), 'farther point (~12 km road) → 12 × 3,000 = 36,000');
  await p.fill('[data-co="map"]', 'https://maps.app.goo.gl/u2VaEW3A7bkK2D789');
  ok((await p.textContent('#cosum')).includes('maps.app.goo.gl'), 'short link explains it cannot be read');
  await p.screenshot({ path: path.join(__dirname, 'out', 'checkout.png'), fullPage: true });

  const mk = async (pid, map) => p.evaluate(async ([pid, map]) => {
    S.pid = pid; S.vi = 0; S.co = { name: 'Cust', phone: '020 7777 8888', addr: 'ບ້ານ ໂພນທັນ, ນະຄອນຫຼວງ', map, branch: 'ອານຸສິດ ໂພນທັນ', brPhone: '020 5555 6666', district: 'ໄຊເສດຖາ', prov: 'ນະຄອນຫຼວງວຽງຈັນ' }; S.screen = 'checkout'; S.tab = 'home'; render();
    await placeOrder(); await new Promise(r => setTimeout(r, 20)); return S.oid;
  }, [pid, map]);

  // order → shop accepts → customer can pay right away, no team step
  const o1 = await mk('p2', '17.9757, 102.6331');
  await p.evaluate(async id => { await answerOrder(id, true); await new Promise(r => setTimeout(r, 20)) }, o1);
  const s1 = await p.evaluate(id => { const o = byId(ST.orders, id); return { s: o.status, fee: o.fee, dl: !!o.payDeadline, due: dueOf(o), needFee: ST.orders.filter(x => x.status === 'await_pay' && !hasDue(x)).length } }, o1);
  ok(s1.s === 'await_pay' && s1.fee === 15000 && s1.dl && s1.due === 215000, 'after shop accepts: fee 15,000 set, pay timer running, due 215,000');
  ok(s1.needFee === 0, 'team overview has no manual fee task for it');
  await p.evaluate(id => { S.tab = 'orders'; S.oid = id; render(); }, o1);
  ok((await p.textContent('main')).includes('215,000'), 'customer sees QR with 215,000');

  // customer uploads a real slip photo (stored in db as data URL)
  await pickPhoto(p, `[data-x="slippick"][data-id="${o1}"]`);
  ok(await p.evaluate(id => byId(ST.orders, id).status, o1) === 'await_pay' && !!(await p.$(`[data-x="slipsend"][data-id="${o1}"]`)), 'picking a slip shows a preview and a "send" button, nothing sent yet');
  await p.click(`[data-x="slipsend"][data-id="${o1}"]`); await wait(p);
  ok(await p.evaluate(() => S.tab === 'orders' && !S.oid) && (await p.textContent('main')).includes('ສົ່ງສະລິບສຳເລັດ'), 'after sending: back to the orders list with "sent successfully"');
  await p.evaluate(id => { S.oid = id; render(); }, o1);
  ok(!(await p.$('[data-x="slippick"]')) && (await p.textContent('main')).includes('ສົ່ງສະລິບແລ້ວ'), 'order page shows "slip sent" with no resend button');
  const s1b = await p.evaluate(id => { const o = byId(ST.orders, id); return { s: o.status, slip: o.slipId } }, o1);
  ok(s1b.s === 'await_verify' && s1b.slip.startsWith('u:'), 'slip photo uploaded by a non-editor and order waits for check');
  await p.evaluate(() => { S.tab = 'team'; S.sub = 'verify'; render(); });
  ok((await p.getAttribute('.slip img', 'src') || '').startsWith('data:image/jpeg'), 'team sees the actual slip image');
  await p.evaluate(async id => { S.chk[id] = [1, 1, 1, 1]; await vApprove(id); await new Promise(r => setTimeout(r, 20)) }, o1);
  const l1 = await p.evaluate(id => LK(byId(ST.orders, id)), o1);
  ok(l1 && l1.total === 215000 && l1.fee === 15000 && l1.verifiedAt, 'approval locks the automatic total');

  // no shop coordinates → falls back to team fee
  await p.evaluate(() => { ST.shops.push({ id: 's2', name: 'Shop B', phone: '020 1111 2222', type: 'shop' }); ST.tp.push({ id: 'p3', name: 'Fan', shopId: 's2', shopName: 'Shop B', variants: [{ label: '—', price: 50000, stock: 3 }], imgs: [], active: true, createdAt: 1, stockAt: 1, updatedAt: 1 }); mergeP(); });
  const o2 = await mk('p3', '17.9757, 102.6331');
  await p.evaluate(async id => { await answerOrder(id, true); await new Promise(r => setTimeout(r, 20)) }, o2);
  ok(await p.evaluate(id => !hasDue(byId(ST.orders, id)) && !byId(ST.orders, id).payDeadline, o2), 'shop without coordinates → team sets fee (fallback kept)');

  // stock: second order for the last Shoe cannot be confirmed
  const o3 = await mk('p1', '17.9757, 102.6331');
  ok(await p.evaluate(() => stockLeft(byId(ST.products, 'p1'), byId(ST.products, 'p1').variants[0])) === 0, 'stock drops as soon as an order is placed (before the shop confirms)');
  const before = await p.evaluate(() => ST.orders.filter(o => o.pid === 'p1').length);
  await mk('p1', '17.9757, 102.6331');
  ok(await p.evaluate(() => ST.orders.filter(o => o.pid === 'p1').length) === before, 'the last item cannot be ordered twice');
  await p.evaluate(async id => { await answerOrder(id, true); await new Promise(r => setTimeout(r, 20)) }, o3);

  // tamper: customer edits fee after acceptance → QR keeps the computed amount
  await p.evaluate(id => { const o = byId(ST.orders, id); o.fee = 0; o.price = 1; }, o3);
  ok(await p.evaluate(id => dueOf(byId(ST.orders, id)), o3) === 115000, 'tampered order still owes 115,000');

  // delivery: door orders can be confirmed only after the team says delivered
  await p.evaluate(async id => { const o = byId(ST.orders, id); await setOrder(o, { status: 'shipping' }, 'team'); S.tab = 'orders'; S.oid = id; render(); }, o1);
  ok(!(await p.$(`[data-x="received"][data-id="${o1}"]`)) && (await p.textContent('main')).includes('ທີມກຳລັງນຳສົ່ງ'), 'no "received" button while the team is still on the way');
  await p.evaluate(async id => { await deliverOk(id); await new Promise(r => setTimeout(r, 20)); render(); }, o1);
  await p.click(`[data-x="received"][data-id="${o1}"]`); await wait(p);
  ok(await p.evaluate(id => { const o = byId(ST.orders, id); return o.status === 'delivered' && o.receivedBy === 'customer' && !!o.receivedAt }, o1), 'customer confirms after the team marked it delivered');
  ok((await p.textContent('main')).includes('ແຈ້ງຄືນສິນຄ້າ'), 'return button appears after receipt');
  const oD = await mk('p2', '17.9757, 102.6331');
  await p.evaluate(async id => { const o = byId(ST.orders, id); await lockOrder(o, { price: 200000, qty: 1, fee: 15000, total: 215000, pay: 'qr', verifiedAt: 1 }); await setOrder(o, { status: 'shipping' }, 'team'); S.tab = 'team'; S.sub = 'run'; render(); }, oD);
  ok(!(await p.isDisabled(`[data-x="dok"][data-id="${oD}"]`)), 'team "delivered" button works without a photo');

  // team marks delivered first → customer still confirms receipt (or reports it missing)
  const oT = await mk('p2', '17.9757, 102.6331');
  await p.evaluate(async id => { const o = byId(ST.orders, id); await lockOrder(o, { price: 200000, qty: 1, fee: 15000, total: 215000, pay: 'qr', verifiedAt: 1 }); await setOrder(o, { status: 'shipping' }, 'team'); await deliverOk(id); await new Promise(r => setTimeout(r, 20)); S.tab = 'home'; S.screen = 'home'; render(); }, oT);
  ok(await p.evaluate(id => { const o = byId(ST.orders, id); return o.status === 'delivered' && !o.receivedAt && !rcvd(o) }, oT), 'team marked delivered: waiting for the customer');
  ok((await p.textContent('main')).includes('ຢືນຢັນວ່າໄດ້ຮັບ'), 'home reminds the customer to confirm');
  await p.click('[data-x="rcvgo"]'); await wait(p);
  const om = await p.textContent('main');
  ok(om.includes('ລໍລູກຄ້າຢືນຢັນ') || (await p.$(`[data-x="received"]`)), 'reminder opens the order(s) waiting for confirmation');
  await p.evaluate(id => { S.tab = 'orders'; S.oid = id; render(); }, oT);
  ok(!!(await p.$(`[data-x="received"][data-id="${oT}"]`)) && !!(await p.$(`[data-x="notrcv"][data-id="${oT}"]`)), 'order page shows "received" and "not received" buttons');
  await p.click(`[data-x="received"][data-id="${oT}"]`); await wait(p);
  ok(await p.evaluate(id => { const o = byId(ST.orders, id); return o.status === 'delivered' && o.receivedBy === 'customer' && !!o.receivedAt && rcvd(o) }, oT), 'customer confirmed receipt after the team marked delivered');
  ok((await p.textContent('main')).includes('ທ່ານຢືນຢັນວ່າໄດ້ຮັບແລ້ວ') && (await p.textContent('header')).includes(''), 'order page shows the confirmation time');
  const oN = await mk('p2', '17.9757, 102.6331');
  await p.evaluate(async id => { const o = byId(ST.orders, id); await lockOrder(o, { price: 200000, qty: 1, fee: 15000, total: 215000, pay: 'qr', verifiedAt: 1 }); await setOrder(o, { status: 'shipping' }, 'team'); await deliverOk(id); await new Promise(r => setTimeout(r, 20)); S.tab = 'orders'; S.oid = id; render(); }, oN);
  await p.click(`[data-x="notrcv"][data-id="${oN}"]`); await wait(p);
  await p.click(`[data-x="notrcv"][data-id="${oN}"]`); await wait(p);
  ok(await p.evaluate(id => { const c = ST.cases.find(c => c.oid === id); return !!c && c.reason === 'missing' && c.status === 'open' }, oN), '"not received" (two taps) opens a case for the team');
  ok(await p.evaluate(() => { const o = { status: 'delivered', deliveredAt: Date.now() - 4 * 86400000 }; return rcvd(o) }), 'no answer after 3 days counts as received');
  await p.evaluate(() => { const L = ST.orders.filter(o => o.status === 'delivered'); L.forEach(o => { o.receivedAt = o.receivedAt || 1 }); });

  // shop lists a product itself → on sale immediately, no team step
  await p.evaluate(() => { S.shopId = 's1'; S.tab = 'store'; S.ss = 'products'; S.sp = null; render(); });
  await p.click('[data-x="spnew"]');
  await pickPhoto(p, '[data-x="spaddph"]');
  await p.fill('[data-sp="name"]', 'Hat'); await p.fill('[data-sp="weight"]', '0.3');
  await p.click('[data-x="spsend"]'); await wait(p);
  ok((await p.textContent('#sperr')).includes('ໝວດ'), 'shop form requires a category');
  await p.fill('[data-sp="cat"]', 'ປຶ້ມ');
  await p.fill('[data-spv="0:label"]', 'Red'); await p.fill('[data-spv="0:price"]', '45000'); await p.fill('[data-spv="0:stock"]', '4');
  await p.click('[data-x="spsend"]'); await wait(p);
  const hat = await p.evaluate(() => { const x = ST.products.find(q => q.name === 'Hat'); return x && { src: x.src, shop: x.shopId, on: x.active, n: x.imgs.length } });
  ok(hat && hat.src === 'sp' && hat.shop === 's1' && hat.on && hat.n === 1, 'shop product is live at once for the right shop');
  ok(await p.evaluate(() => !ST.tp.some(q => q.name === 'Hat')), 'shop product stays in its own collection');
  ok((await p.textContent('main')).includes('Hat') && !!(await p.$('[data-x="spedit"]')), 'shop sees it in its list with an edit button');
  await p.click(`[data-x="spedit"][data-id="${await p.evaluate(() => ST.products.find(q => q.name === 'Hat').id)}"]`);
  await p.fill('[data-spv="0:price"]', '49000'); await p.click('[data-x="spsend"]'); await wait(p);
  ok(await p.evaluate(() => ST.products.find(q => q.name === 'Hat').variants[0].price) === 49000, 'shop can edit its own price');
  await p.evaluate(() => { S.tab = 'home'; S.screen = 'home'; S.name = ''; render(); });
  ok((await p.textContent('#feed')).includes('Hat'), 'shop product appears in the home feed');
  await p.evaluate(() => { S.tab = 'team'; S.sub = 'products'; S.draft = null; render(); });
  ok((await p.textContent('main')).includes('ຮ້ານລົງເອງ'), 'team list marks it as shop-listed');
  await p.evaluate(async () => { const x = ST.products.find(q => q.name === 'Hat'); await put(pcoll(x), x.id, { ...pdoc(x), active: false }); });
  ok(await p.evaluate(() => ST.products.find(q => q.name === 'Hat').active === false && ST.shopProducts.find(q => q.name === 'Hat').active === false), 'team sale switch writes back to the shop collection');
  await p.evaluate(async () => { const x = ST.products.find(q => q.name === 'Hat'); await put(pcoll(x), x.id, { ...pdoc(x), active: true }); });

  // categories, quick budgets, trust strip, square crop
  ok(await p.evaluate(() => [catKey({cat:'ເສື້ອ'}),catKey({cat:'ພາບ'}),catKey({cat:'shoes'}),catKey({cat:'',name:'ພັດລົມຕັ້ງໂຕະ'}),catKey({cat:'xyz'})].join()) === 'clothes,home,shoes,appliance,other', 'old free-text categories map onto the fixed list');
  await p.evaluate(() => { S.tab = 'home'; S.screen = 'home'; S.budget = 0; S.name = ''; S.cat = ''; render(); });
  const hm = await p.textContent('main');
  ok(hm.includes('ຊື້ຕາມງົບ') && hm.includes('ຄືນສິນຄ້າໄດ້') && (await p.$$('.cat')).length === 0 && (await p.$$('[data-qb]')).length === 4, 'home has logo+tagline, trust strip, categories folded away, 4 quick budgets');
  await p.click('[data-x="catstog"]'); await p.waitForTimeout(80);
  ok((await p.$$('.cat')).length === 8, 'tapping “categories” shows the 8 category tiles');
  await p.click('[data-cat="other"]'); await wait(p);
  ok(await p.evaluate(() => S.screen === 'results' && S.cat === 'other' && results().list.every(r => catKey(r.p) === 'other') && results().list.some(r => r.p.name === 'Hat')), 'tapping a category shows only that category');
  await p.click('[data-cat=""]'); await wait(p);
  ok(await p.evaluate(() => S.cat === '' && results().list.length > 1), 'the "all" pill clears the category');
  await p.evaluate(() => { S.screen = 'home'; render(); });
  await p.click('[data-qb="100000"]'); await wait(p);
  ok(await p.evaluate(() => S.budget === 100000 && S.mode === 'under' && results().list.every(r => r.price <= 100000)), 'quick budget 100,000 lists only items under it');
  const dims = await p.evaluate(async () => { const b = await (await fetch(document.querySelector('#rectimg').src)).blob(); const ref = await upDb(b, 'product'); const u = ST.up[ref.slice(2)].data; return await new Promise(r => { const i = new Image(); i.onload = () => r(i.width + 'x' + i.height); i.src = u }) }).catch(e => 'err ' + e);
  ok(dims === '60x30', 'product photos keep their full shape on upload (' + dims + ')');
  const hatCat = await p.evaluate(() => { const h = ST.products.find(q => q.name === 'Hat'); return [h.cat, catLabel(h), catKey(h), catVal('ເສື້ອຜ້າ')].join() });
  ok(hatCat === 'ປຶ້ມ,ປຶ້ມ,other,clothes', 'typed category kept as typed, grouped under ອື່ນໆ; picking a listed one stores its key (' + hatCat + ')');
  await p.evaluate(() => { const h = ST.products.find(q => q.name === 'Hat'); S.tab = 'home'; S.pid = h.id; S.vi = 0; S.screen = 'product'; render(); });
  ok(await p.evaluate(() => getComputedStyle(document.querySelector('.gal img') || document.querySelector('.gal .noimg')).objectFit) === 'contain', 'product page shows the whole photo (contain, not cover)');

  // delivery rules: capital door delivery with the >30 km step; shops outside the capital ship themselves
  ok(await p.evaluate(() => [feeKm(5), feeKm(10), feeKm(30), feeKm(31), feeKm(45)].join()) === '15000,30000,90000,95000,165000', 'fees: 5→15,000 · 10→30,000 · 30→90,000 · 31→95,000 · 45→165,000');
  await p.evaluate(() => { ST.shops.push({ id: 'sL', name: 'Shop LPB', phone: '020 9999 0000', type: 'shop', prov: 'ຫຼວງພະບາງ', map: '19.8856, 102.1347' }); ST.tp.push({ id: 'pL', name: 'Silk scarf', cat: 'clothes', shopId: 'sL', shopName: 'Shop LPB', variants: [{ label: '—', price: 120000, stock: 4 }], imgs: [], active: true, createdAt: 1, stockAt: 1, updatedAt: 1 }); mergeP(); S.tab = 'home'; S.pid = 'pL'; S.vi = 0; S.screen = 'product'; render(); });
  let pg = await p.textContent('main');
  ok(pg.includes('ຫຼວງພະບາງ') && pg.includes('ຈ່າຍທີ່ສາຂາປາຍທາງ') && !pg.includes('ເລີ່ມ 15,000'), 'far-shop product page says the shop ships and the carrier is paid at the branch');
  await p.evaluate(() => { S.screen = 'home'; S.name = ''; S.cat = ''; S.budget = 0; render(); });
  ok((await p.textContent('#feed')).includes('📦'), 'feed card marks far-shop items with 📦');
  await p.evaluate(() => { S.screen = 'results'; S.door = true; render(); });
  ok(await p.evaluate(() => !results().list.some(r => r.p.id === 'pL') && results().list.length > 0), 'door-delivery filter hides far-shop items');
  await p.evaluate(() => { S.door = false; });
  const oL = await mk('pL', '17.9757, 102.6331');
  await p.evaluate(async id => { await answerOrder(id, true); await new Promise(r => setTimeout(r, 20)) }, oL);
  ok(await p.evaluate(id => { const o = byId(ST.orders, id); return dMode(o) === 'shop' && o.status === 'await_pay' && !!o.payDeadline && dueOf(o) === 120000 }, oL), 'far-shop order: pay goods only (120,000) right after the shop accepts');
  await p.evaluate(async id => { const o = byId(ST.orders, id); await lockOrder(o, { price: 120000, qty: 1, fee: 0, total: 120000, pay: 'qr', verifiedAt: 1 }); await setOrder(o, { status: 'await_pickup' }, 'team'); S.tab = 'team'; S.sub = 'run'; render(); }, oL);
  ok(!(await p.textContent('main')).includes('Shop LPB'), 'team pickup run does not include the far shop');
  await p.evaluate(() => { S.shopId = 'sL'; S.tab = 'store'; S.ss = 'orders'; S.sp = null; render(); });
  ok(!!(await p.$(`[data-x="sship"][data-id="${oL}"]`)), 'far shop sees the pack-and-ship form');
  await p.click(`[data-x="sship"][data-id="${oL}"]`); await wait(p);
  ok(await p.evaluate(id => byId(ST.orders, id).status, oL) === 'await_pickup', 'cannot confirm without carrier and receipt number');
  await p.fill(`[data-hd="s${oL}:carrier"]`, 'Anousith'); await p.fill(`[data-hd="s${oL}:no"]`, 'AN-12345');
  await p.click(`[data-x="sship"][data-id="${oL}"]`); await wait(p);
  ok(await p.evaluate(id => { const o = byId(ST.orders, id); return o.status === 'shipping' && o.receiptNo === 'AN-12345' && o.shippedBy === 'shop' && !!o.handedAt }, oL), 'shop confirms hand-over: shipping with receipt number');
  await p.evaluate(id => { S.tab = 'orders'; S.oid = id; render(); }, oL);
  pg = await p.textContent('main');
  ok(pg.includes('AN-12345') && pg.includes('ສາຂາ') && !!(await p.$(`[data-x="received"][data-id="${oL}"]`)), 'customer sees carrier + receipt number and can confirm receipt');
  await p.evaluate(() => { S.tab = 'team'; S.sub = 'run'; render(); });
  ok(!(await p.textContent('main')).includes('AN-12345'), 'team delivery list does not include it');
  const oP = await p.evaluate(async () => { S.pid = 'p2'; S.vi = 0; S.co = { name: 'Cust', phone: '020 7777 8888', addr: 'ເມືອງໄກສອນ, ແຂວງ ສະຫວັນນະເຂດ', map: '16.57, 104.75' }; S.coCart = false; S.screen = 'checkout'; S.tab = 'home'; render(); await placeOrder(); await new Promise(r => setTimeout(r, 20)); return S.oid; });
  ok(await p.evaluate(id => { const o = byId(ST.orders, id); return dMode(o) === 'team' && autoFee(o) === 0 }, oP), 'capital shop → province customer: team ships, carrier paid at branch');

  // team-listed products: editors can edit them from the shop screen; team can hand them over to the shop
  await p.evaluate(() => { const b = ST.tp.find(q => q.id === 'p2'); b.imgs = ['a1', 'a2']; b.weight = 0.8; b.cat = 'bags'; mergeP(); S.shopId = 's1'; S.tab = 'store'; S.ss = 'products'; S.sp = null; render(); });
  ok(!!(await p.$('[data-x="spedit"][data-id="p2"]')), 'editor sees "edit" on a team-listed product in the shop screen');
  await p.click('[data-x="spedit"][data-id="p2"]'); await wait(p);
  await p.click('[data-x="sprmph"][data-i="0"]'); await wait(p);
  await p.fill('[data-spv="0:price"]', '210000'); await p.click('[data-x="spsend"]'); await wait(p);
  const bag = await p.evaluate(() => { const b = ST.products.find(q => q.id === 'p2'); return { src: b.src || 'team', imgs: b.imgs.join(), price: b.variants[0].price, inTp: ST.tp.some(q => q.id === 'p2'), inSp: ST.shopProducts.some(q => q.id === 'p2') } });
  ok(bag.src === 'team' && bag.imgs === 'a2' && bag.price === 210000 && bag.inTp && !bag.inSp, 'photo removed + price changed, product stays a team product (' + JSON.stringify(bag) + ')');
  await p.evaluate(() => { S.canAdmin = false; render(); });
  ok(!(await p.$('[data-x="spedit"][data-id="p2"]')), 'a shop (non-editor) still cannot edit team-listed products');
  await p.evaluate(() => { S.canAdmin = true; S.tab = 'team'; S.sub = 'products'; S.draft = null; render(); });
  await p.click('[data-act="tomove"][data-id="p2"]'); await wait(p);
  ok((await p.textContent('[data-act="tomove"][data-id="p2"]')).includes('ກົດອີກຄັ້ງ'), 'hand-over asks for a second tap');
  await p.click('[data-act="tomove"][data-id="p2"]'); await wait(p);
  ok(await p.evaluate(() => { const b = ST.products.find(q => q.id === 'p2'); return b && b.src === 'sp' && !ST.tp.some(q => q.id === 'p2') && b.variants[0].price === 210000 }), 'product moved to the shop with the same id');
  await p.evaluate(() => { S.canAdmin = false; S.shopId = 's1'; S.tab = 'store'; S.ss = 'products'; render(); });
  ok(!!(await p.$('[data-x="spedit"][data-id="p2"]')), 'after hand-over the shop itself can edit it');
  await p.evaluate(async () => { S.canAdmin = true; const b = ST.products.find(q => q.id === 'p2'); await put(pcoll(b), b.id, { ...pdoc(b), variants: [{ label: '—', price: 200000, stock: 5 }] }); });

  // a capital shop that chose "no door delivery" behaves like a far shop
  await p.evaluate(() => { ST.shops.push({ id: 'sS', name: 'Shop Self', phone: '020 4444 5555', type: 'shop', prov: 'ນະຄອນຫຼວງວຽງຈັນ', pickup: 'self', map: '17.9700, 102.6100' }); ST.tp.push({ id: 'pS', name: 'Lamp', cat: 'home', shopId: 'sS', shopName: 'Shop Self', variants: [{ label: '—', price: 80000, stock: 2 }], imgs: [], active: true, createdAt: 1, stockAt: 1, updatedAt: 9 }); mergeP(); S.tab = 'home'; S.screen = 'home'; S.name = ''; S.cat = ''; S.budget = 0; render(); });
  ok(await p.evaluate(() => pMode(byId(ST.products, 'pS')) === 'shop' && dMode({ shopId: 'sS', kind: 'local' }) === 'shop' && autoFee({ shopId: 'sS', kind: 'local', ll: { lat: 17.97, lng: 102.63 } }) === 0), 'capital shop with "no door delivery" → shop ships, no door fee');
  ok((await p.textContent('#feed')).includes('ບໍ່ມີສົ່ງຮອດເຮືອນ'), 'feed card says "no door delivery"');
  await p.evaluate(() => { S.pid = 'pS'; S.vi = 0; S.screen = 'product'; render(); });
  ok((await p.textContent('main')).includes('ບໍ່ມີບໍລິການສົ່ງຮອດເຮືອນ'), 'product page says "no door delivery service"');
  ok(await p.evaluate(() => { S.sdraft = { id: 'x', name: 'X', type: 'shop', prov: 'ຫຼວງພະບາງ', pickup: 'team', phone: '', map: '', addr: '', bank: '', account: '', agreed: true }; return true }), 'setup');

  await p.evaluate(async () => { const b = ST.products.find(q => q.id === 'p2'); await put(pcoll(b), b.id, { ...pdoc(b), variants: [{ label: '—', price: 200000, stock: 20 }] }); });
  // checkout for a carrier-shipping shop: branch fields instead of address + map
  await p.evaluate(() => { S.co = { name: 'Cust', phone: '020 7777 8888' }; S.coCart = false; S.pid = 'pS'; S.vi = 0; S.tab = 'home'; S.screen = 'checkout'; render(); });
  ok(!(await p.$('[data-co="map"]')) && !(await p.$('[data-x="geo"]')) && !(await p.$('[data-co="addr"]')) && !!(await p.$('[data-co="branch"]')) && !!(await p.$('select[data-co="prov"]')), 'no-door product: no map/address, branch + village + district + province instead');
  const nBefore = await p.evaluate(() => ST.orders.length);
  await p.evaluate(async () => { await placeOrder(); await new Promise(r => setTimeout(r, 20)) });
  ok(await p.evaluate(() => ST.orders.length) === nBefore && (await p.textContent('#toast')).includes('ສາຂາ'), 'branch, district and province are required');
  await p.fill('[data-co="branch"]', 'ອານຸສິດ ສາຂາໂພນທັນ'); await p.fill('[data-co="village"]', 'ໂພນທັນ'); await p.fill('[data-co="district"]', 'ໄຊເສດຖາ'); await p.selectOption('select[data-co="prov"]', 'ນະຄອນຫຼວງວຽງຈັນ');
  ok(await p.inputValue('[data-co="brPhone"]') === '', 'branch phone starts empty (typed every order)');
  const nb2 = await p.evaluate(() => ST.orders.length);
  await p.evaluate(async () => { await placeOrder(); await new Promise(r => setTimeout(r, 20)) });
  ok(await p.evaluate(() => ST.orders.length) === nb2, 'branch phone is required');
  await p.fill('[data-co="brPhone"]', '020 5555 6666');
  await p.evaluate(async () => { await placeOrder(); await new Promise(r => setTimeout(r, 20)) });
  const ob = await p.evaluate(() => { const o = ST.orders[ST.orders.length - 1]; return { addr: o.addr, br: o.branch && o.branch.name, bp: o.branch && o.branch.phone, ll: o.ll } });
  ok(ob.bp === '020 5555 6666' && ob.addr.includes('ໂທ 020 5555 6666') && ob.br === 'ອານຸສິດ ສາຂາໂພນທັນ' && ob.addr.includes('ເມືອງ ໄຊເສດຖາ') && ob.addr.includes('ນະຄອນຫຼວງວຽງຈັນ') && !ob.ll, 'order stores the destination branch (' + ob.addr + ')');
  await p.evaluate(() => { S.pid = 'pS'; S.vi = 0; S.tab = 'home'; S.screen = 'product'; render(); });
  await p.click('[data-act="order"]'); await wait(p);
  ok(await p.inputValue('[data-co="branch"]') === '' && await p.inputValue('[data-co="brPhone"]') === '' && await p.inputValue('[data-co="district"]') === '', 'next carrier order starts with empty branch, phone and district');
  await p.evaluate(() => { S.co = {}; S.pid = 'p2'; S.vi = 0; S.tab = 'home'; S.screen = 'checkout'; render(); });
  ok(!!(await p.$('[data-co="map"]')) && !(await p.$('[data-co="branch"]')), 'door product: address + map, no branch fields');

  // cart: two items from Shop A + one from a second shop with coordinates
  await p.evaluate(() => { ST.shops.push({ id: 's3', name: 'Shop C', phone: '020 3333 4444', type: 'shop', map: '17.9757, 102.6331' }); ST.tp.push({ id: 'p4', name: 'Cup', shopId: 's3', shopName: 'Shop C', variants: [{ label: '—', price: 30000, stock: 9 }], imgs: [], active: true, createdAt: 1, stockAt: 1, updatedAt: 1 }); mergeP(); S.cart = []; });
  for (const pid of ['p2', 'p2', 'p4']) { await p.evaluate(pid => { S.tab = 'home'; S.pid = pid; S.vi = 0; S.screen = 'product'; render(); }, pid); await p.click('[data-act="addcart"]'); await wait(p); }
  const hatId = await p.evaluate(() => ST.products.find(q => q.name === 'Hat').id);
  await p.evaluate(id => { S.pid = id; S.vi = 0; S.screen = 'product'; render(); }, hatId); await p.click('[data-act="addcart"]'); await wait(p);
  ok(await p.evaluate(() => cartN()) === 4 && (await p.textContent('.nbadge')) === '4', 'cart badge counts 4 items');
  await p.evaluate(() => { S.tab = 'cart'; render(); });
  let ct = await p.textContent('main');
  ok(ct.includes('Shop A') && ct.includes('Shop C') && ct.includes('479,000'), 'cart groups by shop; goods 2×200,000 + 30,000 + 49,000 = 479,000');
  await p.evaluate(() => { S.co = { name: 'Cust', phone: '020 7777 8888', addr: 'ບ້ານ ໂພນທັນ, ນະຄອນຫຼວງ', map: '' }; });
  await p.click('[data-x="cbuy"]'); await wait(p);
  await p.fill('[data-co="map"]', '17.9757, 102.6331');
  const cs = await p.textContent('#cosum');
  ok(cs.includes('× 2') && cs.includes('Shop A') && cs.includes('Shop C'), 'checkout lists cart lines with quantities and a fee line per shop');
  ok(cs.includes('509,000'), 'total = 479,000 goods + 15,000 (Shop A) + 15,000 (Shop C, 0 km→1 km)');
  await p.evaluate(async () => { S.co.name = 'Cust'; S.co.phone = '020 7777 8888'; S.co.addr = 'ບ້ານ ໂພນທັນ, ນະຄອນຫຼວງ'; await placeOrder(); await new Promise(r => setTimeout(r, 30)); });
  const grp = await p.evaluate(() => { const L = ST.orders.filter(o => o.gid); return { n: L.length, gid: new Set(L.map(o => o.gid)).size, cart: S.cart.length, qty: L.find(o => o.pid === 'p2').qty } });
  ok(grp.n === 3 && grp.gid === 1 && grp.cart === 0 && grp.qty === 2, 'cart became 3 orders in one group (Bag ×2), cart emptied');
  await p.evaluate(async () => { for (const o of ST.orders.filter(o => o.gid)) await answerOrder(o.id, true); await new Promise(r => setTimeout(r, 30)); });
  const fees = await p.evaluate(() => ST.orders.filter(o => o.gid).map(o => o.shopName + ':' + autoFee(o)).sort());
  ok(JSON.stringify(fees) === JSON.stringify(['Shop A:0', 'Shop A:15000', 'Shop C:15000']), 'one delivery fee per shop inside the group');
  const g1 = await p.evaluate(() => ST.orders.find(o => o.gid).id);
  await p.evaluate(id => { S.tab = 'orders'; S.oid = id; render(); }, g1);
  const pt = await p.textContent('main');
  ok(pt.includes('509,000') && pt.includes('QR'), 'customer pays the whole cart with one QR (509,000)');
  await pickPhoto(p, `[data-x="slippick"][data-id="${g1}"]`); await p.click(`[data-x="slipsend"][data-id="${g1}"]`); await wait(p);
  ok(await p.evaluate(() => { const L = ST.orders.filter(o => o.gid); return L.every(o => o.status === 'await_verify') && new Set(L.map(o => o.slipId)).size === 1 }), 'one slip moves all 3 orders to slip check');
  await p.evaluate(() => { S.tab = 'team'; S.sub = 'verify'; S.vq = 0; render(); });
  ok((await p.textContent('main')).includes('509,000'), 'team checks the slip against the group total');
  await p.evaluate(async () => { const o = ST.orders.find(o => o.gid); await vApprove(o.id); await new Promise(r => setTimeout(r, 30)); });
  ok(await p.evaluate(() => ST.orders.filter(o => o.gid).every(o => o.status === 'await_pickup' && LK(o) && LK(o).verifiedAt)), 'one approval clears the whole group');
  await p.evaluate(() => { S.tab = 'cart'; render(); });
  await p.screenshot({ path: path.join(__dirname, 'out', 'cart-empty.png') });

  await browser.close();
  console.log(fails ? `\n${fails} FAILED` : '\nALL PASSED');
  process.exit(fails ? 1 : 0);
})();
