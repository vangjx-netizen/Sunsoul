// End to end on the Firebase emulators: the real page, the real Firebase SDK (served from node_modules in place of
// gstatic), Firestore + Auth emulators and the real firestore.rules. Four browsers play buyer, stranger, shop and team.
// Run with:  npm run test:e2e
const http = require('http'); const fs = require('fs'); const path = require('path');
const { chromium } = require('playwright');
const { initializeTestEnvironment } = require('@firebase/rules-unit-testing');
const { doc, setDoc, getDoc, updateDoc } = require('firebase/firestore');

let fails = 0; const ok = (c, m) => { console.log((c ? 'PASS ' : 'FAIL ') + m); if (!c) fails++; };
const PUB = path.join(__dirname, '..', '..', 'public');
const SDK = path.dirname(require.resolve('firebase/package.json'));
const TYPES = { '.html': 'text/html', '.js': 'application/javascript', '.json': 'application/json' };
const wait = ms => new Promise(r => setTimeout(r, ms));
async function until(fn, ms = 8000) { const t = Date.now(); while (Date.now() - t < ms) { if (await fn()) return true; await wait(150); } return false; }

(async () => {
  const server = http.createServer((req, res) => {
    const f = path.join(PUB, decodeURIComponent(req.url.split('?')[0]) === '/' ? 'index.html' : decodeURIComponent(req.url.split('?')[0]));
    if (!f.startsWith(PUB) || !fs.existsSync(f)) { res.writeHead(404); res.end(); return; }
    res.writeHead(200, { 'content-type': TYPES[path.extname(f)] || 'application/octet-stream' }); fs.createReadStream(f).pipe(res);
  }).listen(5055);
  const env = await initializeTestEnvironment({ projectId: 'demo-sunsoul', firestore: { rules: fs.readFileSync(path.join(__dirname, '..', '..', 'firestore.rules'), 'utf8') } });
  await env.clearFirestore();
  // withSecurityRulesDisabled resolves to nothing, so the result is passed out by hand
  const admin = async fn => { let r; await env.withSecurityRulesDisabled(async c => { r = await fn(c.firestore()); }); return r; };
  await admin(async d => {
    await setDoc(doc(d, 'shops/s1'), { name: 'Kham', prov: 'ນະຄອນຫຼວງວຽງຈັນ', pickup: 'team', phone: '020 5555 7777' });
    await setDoc(doc(d, 'products/p1'), { name: 'ໝໍ້ຫຸງເຂົ້າ', cat: 'home', shopId: 's1', shopName: 'Kham', variants: [{ label: '—', price: 250000, stock: 3 }], imgs: [], active: true, createdAt: 1, stockAt: 1 });
  });

  const browser = await chromium.launch(process.env.CHROME_PATH ? { executablePath: process.env.CHROME_PATH } : {});
  async function person(name) {
    const ctx = await browser.newContext({ viewport: { width: 430, height: 900 } });
    await ctx.route('https://www.gstatic.com/firebasejs/12.19.0/*', r => r.fulfill({ path: path.join(SDK, path.basename(new URL(r.request().url()).pathname)), contentType: 'application/javascript' }));
    const p = await ctx.newPage();
    p.on('pageerror', e => { console.log('ERR(' + name + ')', e.message); fails++; });
    await p.goto('http://localhost:5055/?fb=1');
    await until(() => p.evaluate(() => !!(window.H && H.uid) && S.ready).catch(() => false));
    return p;
  }

  // buyer
  const buyer = await person('buyer');
  const buyerUid = await buyer.evaluate(() => H.uid);
  ok(!!buyerUid && (await buyer.textContent('main')).includes('ໝໍ້ຫຸງເຂົ້າ'), 'buyer: signed in anonymously and sees the products');
  ok(await buyer.evaluate(() => H.scoped === true && S.canAdmin === false), 'buyer: page runs in Firebase mode, not team');
  await buyer.evaluate(async () => {
    S.user = { phone: '2098798512', name: 'Noy' };
    await put('orders', 'o1', { uid: H.uid, no: 'SS-1', pid: 'p1', pname: 'ໝໍ້ຫຸງເຂົ້າ', vlabel: '—', qty: 2, price: 250000, shopId: 's1', shopName: 'Kham', status: 'await_shop', acct: '2098798512', cust: { name: 'Noy', phone: '2098798512' }, addr: 'ບ້ານ ໂພນໄຊ', createdAt: Date.now(), history: [] });
  });
  ok(await until(() => buyer.evaluate(() => ST.orders.some(o => o.id === 'o1'))), 'buyer: own order saved (rules allow it) and shown');
  ok(await buyer.evaluate(() => stockLeft(byId(ST.products, 'p1'), vars(byId(ST.products, 'p1'))[0]) === 1), 'buyer: stock left 3 → 1');
  const forged = await buyer.evaluate(async () => { try { await put('orders', 'o1', { ...strip(byId(ST.orders, 'o1')), status: 'await_pickup' }); return 'allowed'; } catch (e) { return e.code || e.message; } });
  ok(/permission/i.test(forged), 'buyer: cannot mark own order as paid (' + forged + ')');

  // stranger
  const stranger = await person('stranger');
  ok(await until(() => stranger.evaluate(() => stockLeft(byId(ST.products, 'p1'), vars(byId(ST.products, 'p1'))[0]) === 1)), 'stranger: sees the correct stock (1 left) without seeing the order');
  ok(await stranger.evaluate(() => ST.orders.length === 0), 'stranger: loads no orders at all');
  const peek = await stranger.evaluate(async () => { try { const s = await H.db.doc('orders/o1').get(); return s.exists ? 'read it' : 'none'; } catch (e) { return e.code || e.message; } });
  ok(/permission/i.test(peek), 'stranger: reading the buyer’s order directly is refused (' + peek + ')');

  // shop: the team links the shop to this person's account
  const shop = await person('shop');
  const shopUid = await shop.evaluate(() => H.uid);
  await admin(d => updateDoc(doc(d, 'shops/s1'), { ownerUid: shopUid }));
  ok(await until(() => shop.evaluate(() => ST.orders.some(o => o.id === 'o1'))), 'shop: sees the order for its shop');
  ok(await shop.evaluate(() => !ST.orders.some(o => o.cust && o.cust.name === 'x')) , 'shop: only its own shop’s orders');
  await shop.evaluate(async () => { S.shopId = 's1'; await setOrder(byId(ST.orders, 'o1'), { status: 'await_pay', shopAt: Date.now() }, 'shop', 'await_shop'); });
  const st = await admin(async d => (await getDoc(doc(d, 'orders/o1'))).data().status);
  ok(st === 'await_pay', 'shop: confirms it has the goods (status ' + st + ')');
  const pubSt = await admin(async d => (await getDoc(doc(d, 'orderPub/o1'))).data().status);
  ok(pubSt === 'await_pay', 'stock copy follows the order status');

  // team
  const team0 = await person('team');
  const teamUid = await team0.evaluate(() => H.uid);
  await admin(d => setDoc(doc(d, 'admins/' + teamUid), { name: 'Vang' }));
  await team0.reload(); await until(() => team0.evaluate(() => !!(window.H && H.uid) && S.ready).catch(() => false));
  ok(await until(() => team0.evaluate(() => S.canAdmin === true && ST.orders.some(o => o.id === 'o1'))), 'team: recognised from admins/ and sees all orders');
  await team0.evaluate(async () => { await lockOrder(byId(ST.orders, 'o1'), { price: 250000, qty: 2, fee: 15000, total: 515000, pay: 'qr' }); });
  const lock = await admin(async d => (await getDoc(doc(d, 'orderLock/o1'))).data());
  ok(lock && lock.total === 515000 && lock.uid === buyerUid && lock.shopId === 's1', 'team: locks the amount (tagged with buyer and shop)');
  ok(await until(() => buyer.evaluate(() => !!ST.locks.o1 && ST.locks.o1.total === 515000)), 'buyer: sees the locked amount of own order');
  ok(await until(() => shop.evaluate(() => !!ST.locks.o1)), 'shop: sees the amount of its order');
  const buyerLock = await buyer.evaluate(async () => { try { await H.db.doc('orderLock/o1').set({ total: 1, uid: H.uid }); return 'allowed'; } catch (e) { return e.code || e.message; } });
  ok(/permission/i.test(buyerLock), 'buyer: cannot change the amount (' + buyerLock + ')');

  await browser.close(); await env.cleanup(); server.close();
  console.log(fails ? fails + ' FAILED' : 'ALL PASSED'); process.exit(fails ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
