// Tests the Firebase backend adapter (public/backend-core.js) with an in-memory fake Firebase:
// first the adapter alone in Node, then the real page running on it in the browser.
const { chromium } = require('playwright'); const path = require('path'); const fs = require('fs');
const { pathToFileURL } = require('url');
const { makeFakeFirebase } = require('./fake-firebase.js');
let fails = 0; const ok = (c, m) => { console.log((c ? 'PASS ' : 'FAIL ') + m); if (!c) fails++; };
const CONFIG = { projectId: 'sunsoul-01', storageBucket: 'sunsoul-01.firebasestorage.app', useStorage: true };
const corePath = path.join(__dirname, '..', 'public', 'backend-core.js');

(async () => {
  // ---- 1. adapter alone ----
  const { makeBackend } = await import(pathToFileURL(corePath).href);
  const fb = makeFakeFirebase({ 'products/p1': { name: 'A' } });
  const be = makeBackend(fb, CONFIG);
  const db = await be.use('db'), user = await be.use('user');
  ok((await user.id()) === 'anon1' && fb._auth.anonCount === 1, 'visitor is signed in anonymously once');
  ok((await db.doc('products/p1').get()).exists && (await db.doc('products/p1').get()).data().name === 'A', 'doc().get() returns {exists, data()} like Claude');
  ok(!(await db.doc('products/none').get()).exists, 'missing doc → exists false');
  await db.collection('orders').doc('o1').set({ status: 'await_shop' });
  await db.doc('orders/o1').update({ status: 'await_pay' });
  ok(fb._docs.get('orders/o1').status === 'await_pay', 'set and update write through');
  let threw = false; try { await db.doc('kyc/x').update({ a: 1 }); } catch (e) { threw = true; }
  ok(threw, 'update on a missing doc fails (the page falls back to set)');
  const got = await new Promise(r => db.collection('orders').onSnapshot(s => r(s.docs.map(d => d.id + ':' + d.data().status))));
  ok(got.join() === 'o1:await_pay', 'collection().onSnapshot gives {docs:[{id,data()}]}');
  await db.doc('orders/o1').delete(); ok(!fb._docs.has('orders/o1'), 'delete works');
  ok((await user.canEdit()) === false && (await be.use('assets')) === null, 'ordinary visitor: not team, no asset upload');
  const fb2 = makeFakeFirebase({ 'admins/anon1': { name: 'Vang' } });
  const be2 = makeBackend(fb2, CONFIG);
  ok((await (await be2.use('user')).canEdit()) === true, 'uid listed in admins/ → team');
  const assets = await be2.use('assets');
  const up = await assets.upload({ size: 10, type: 'image/jpeg' }, { type: 'image/jpeg' });
  ok(/^[0-9a-f]{32}$/.test(up.id) && up.url.includes('sunsoul-01.firebasestorage.app') && up.url.includes(up.id), 'team upload → 32-char id + Storage URL');
  ok(be2.blobUrl('abc').startsWith('https://firebasestorage.googleapis.com/v0/b/sunsoul-01.firebasestorage.app/o/assets%2Fabc'), 'image address built from the id');

  // ---- 2. the real page on the adapter ----
  const b = await chromium.launch(process.env.CHROME_PATH ? { executablePath: process.env.CHROME_PATH } : {});
  const p = await b.newPage({ viewport: { width: 430, height: 900 } });
  p.on('pageerror', e => { console.log('ERR', e.message); fails++; });
  const core = fs.readFileSync(corePath, 'utf8').replace(/^export /gm, '');
  const fake = fs.readFileSync(path.join(__dirname, 'fake-firebase.js'), 'utf8');
  const seed = {
    'shops/s1': { name: 'Kham', prov: 'ນະຄອນຫຼວງວຽງຈັນ', pickup: 'team', verified: true },
    'products/p1': { name: 'ໝໍ້ຫຸງເຂົ້າ', cat: 'home', shopId: 's1', shopName: 'Kham', variants: [{ label: '—', price: 250000, stock: 3 }], imgs: ['0123456789abcdef0123456789abcdef'], active: true, createdAt: 1, stockAt: 1 },
  };
  await p.addInitScript(({ core, fake, seed, CONFIG }) => {
    eval(fake + '\n' + core + '\nwindow.__fb=makeFakeFirebase(seed);window.SUNSOUL_BACKEND=Promise.resolve(makeBackend(window.__fb,CONFIG));');
  }, { core, fake, seed, CONFIG });
  await p.goto('file://' + path.join(__dirname, '..', 'public', 'index.html')); await p.waitForTimeout(800);
  const t = await p.textContent('main');
  ok(t.includes('ໝໍ້ຫຸງເຂົ້າ') && t.includes('250,000'), 'page loads products from Firebase (not Claude)');
  ok(await p.evaluate(() => H.uid === 'anon1' && S.canAdmin === false), 'page knows the visitor id; not team');
  const src = await p.evaluate(() => imgSrc('0123456789abcdef0123456789abcdef'));
  ok(src.startsWith('https://firebasestorage.googleapis.com/') && src.includes('0123456789abcdef0123456789abcdef'), 'product photos point at Firebase Storage');
  await p.evaluate(async () => {
    S.user = { phone: '2098798512', name: 'Noy' }; S.addrs = [{ name: 'Noy', phone: '2098798512', addr: 'ບ້ານ ໂພນໄຊ' }]; saveProfile();
    await put('orders', 'o9', { uid: H.uid, no: 'SS-9', pid: 'p1', vlabel: '—', qty: 2, status: 'await_shop', acct: '2098798512', cust: { name: 'Noy', phone: '2098798512' }, createdAt: Date.now(), history: [] });
    await window.__fb.setDoc({ path: 'orders/x1' }, { uid: 'someone-else', pid: 'p1', status: 'await_shop', cust: { name: 'Other' } });
  });
  await p.waitForTimeout(200);
  ok(await p.evaluate(() => window.__fb._docs.has('data/users/anon1/profile') && window.__fb._docs.get('data/users/anon1/profile').addrs.length === 1), 'saved addresses go to the visitor’s own profile in Firebase');
  ok(await p.evaluate(() => window.__fb._docs.get('orders/o9').status === 'await_shop' && ST.orders.some(o => o.id === 'o9')), 'own order is written to Firebase and comes back through the live listener');
  ok(await p.evaluate(() => !ST.orders.some(o => o.id === 'x1')), 'someone else’s order is not loaded');
  ok(await p.evaluate(() => { const d = window.__fb._docs.get('orderPub/o9'); return !!d && d.qty === 2 && d.pid === 'p1' && !d.cust && !d.uid; }), 'order writes its stock copy without personal data');
  ok(await p.evaluate(() => stockLeft(byId(ST.products, 'p1'), vars(byId(ST.products, 'p1'))[0]) === 1), 'stock left counts from the copies (3 − 2 = 1)');
  await b.close();
  console.log(fails ? fails + ' FAILED' : 'ALL PASSED'); process.exit(fails ? 1 : 0);
})();
