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

  // moving data in: the team imports a file exported from the Claude version
  const PX = 'data:image/png;base64,' + fs.readFileSync(path.join(__dirname, '..', 'fixtures', 'px.png')).toString('base64');
  const img = 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa';
  const exportFile = path.join(require('os').tmpdir(), 'sunsoul-test-export.json');
  fs.writeFileSync(exportFile, JSON.stringify({ kind: 'sunsoul-export', version: 1, collections: {
    shops: { s9: { name: 'ຮ້ານນຳເຂົ້າ', prov: 'ນະຄອນຫຼວງວຽງຈັນ', pickup: 'team', phoneE164: '+8562000000009' } },
    shopPrivate: { s9: { bank: 'BCEL', account: '0101' } },
    products: { p9: { name: 'ສິນຄ້ານຳເຂົ້າ', cat: 'home', shopId: 's9', shopName: 'ຮ້ານນຳເຂົ້າ', variants: [{ label: '—', price: 90000, stock: 4 }], imgs: [img], active: true, createdAt: 1, stockAt: 1 } },
    imgm: { [img]: { d: PX } },
    orders: { sneaky: { uid: 'x', status: 'delivered' } },
  } }));
  await team0.evaluate(() => { S.tab = 'team'; S.sub = 'fees'; render(); });
  ok((await team0.textContent('main')).includes('ນຳເຂົ້າຂໍ້ມູນ'), 'team: import section on the settings page');
  const [fc] = await Promise.all([team0.waitForEvent('filechooser'), team0.click('[data-x="impfile"]')]);
  await fc.setFiles(exportFile);
  ok(await until(() => team0.evaluate(() => !!S.imp && S.imp.done === S.imp.total && S.imp.total === 4)), 'team: imports shops, bank, product and photo (orders in the file are ignored)');
  ok(!(await admin(async d => (await getDoc(doc(d, 'orders/sneaky'))).exists())), 'import never writes orders');
  ok(await until(() => stranger.evaluate(() => !!byId(ST.products, 'p9'))), 'stranger: sees the imported product live');
  await stranger.evaluate(() => { S.tab = 'home'; S.screen = 'home'; render(); });
  ok(await until(() => stranger.evaluate(() => [...document.querySelectorAll('img')].some(i => (i.getAttribute('src') || '').startsWith('data:image/png')))), 'stranger: product photo shows from its copy (no Storage needed)');
  ok(/permission/i.test(await stranger.evaluate(async () => { try { await H.db.doc('shopPrivate/s9').get(); return 'read it'; } catch (e) { return e.code || e.message; } })), 'stranger: cannot read the imported bank account');

  // the team links an imported shop to its owner's account through the shop form
  const ownerUid = await stranger.evaluate(() => H.uid);
  await team0.evaluate(() => { S.tab = 'team'; S.sub = 'shops'; S.sdraft = null; render(); });
  ok((await team0.textContent('main')).includes('ຍັງບໍ່ຜູກບັນຊີ'), 'team: shop list shows which shops are not linked yet');
  await team0.click('[data-act="edits"][data-id="s9"]');
  await team0.fill('[data-sf="ownerUid"]', 'ID: ' + ownerUid);
  if (!(await team0.isChecked('[data-agree]'))) await team0.check('[data-agree]');
  await team0.click('[data-act="saves"]');
  ok(await until(async () => (await admin(async d => (await getDoc(doc(d, 'shops/s9'))).data().ownerUid)) === ownerUid), 'team: pasted ID (with the "ID:" prefix) is saved on the shop');
  await stranger.evaluate(() => { S.tab = 'account'; S.sell = false; S.pol = false; render(); });
  ok(await until(async () => (await stranger.textContent('main')).includes('ໜ້າຮ້ານຄ້າ')), 'owner: account page now shows “my shop”');
  await buyer.evaluate(async () => { await put('orders', 'o9', { uid: H.uid, no: 'SS-9', pid: 'p9', pname: 'ສິນຄ້ານຳເຂົ້າ', vlabel: '—', qty: 1, price: 90000, shopId: 's9', shopName: 'ຮ້ານນຳເຂົ້າ', status: 'await_shop', acct: '2098798512', cust: { name: 'Noy', phone: '2098798512' }, createdAt: Date.now(), history: [] }); });
  ok(await until(() => stranger.evaluate(() => ST.orders.some(o => o.id === 'o9'))), 'owner: receives the new order for the linked shop');

  // return case, through the real form, against the real rules
  await admin(d => updateDoc(doc(d, 'orders/o1'), { status: 'delivered', deliveredAt: Date.now() }));
  await admin(d => setDoc(doc(d, 'upimgs/r1'), { data: PX })); await admin(d => setDoc(doc(d, 'upimgs/r2'), { data: PX }));
  ok(await until(() => buyer.evaluate(() => (byId(ST.orders, 'o1') || {}).status === 'delivered')), 'buyer: order delivered');
  await buyer.evaluate(() => { S.oid = 'o1'; S.rt = { reason: '', note: '', imgs: [], video: null }; S.tab = 'home'; S.screen = 'return'; render(); });
  await buyer.click('[data-x="rtreason"][data-k="damaged"]'); await buyer.click('[data-x="rtvid"][data-k="1"]');
  ok(!(await buyer.$('[data-x="rtwant"]')), 'buyer: home-delivery order offers refund only (no exchange)');
  await buyer.fill('[data-rt="rbank"]', 'BCEL'); await buyer.fill('[data-rt="racct"]', '0101999'); await buyer.fill('[data-rt="rname"]', 'NOY');
  await buyer.evaluate(() => { S.rt.imgs = ['u:r1', 'u:r2']; rr(); });
  await buyer.evaluate(() => { window.__toasts = []; const t0 = toast; window.toast = m => { window.__toasts.push(m); t0(m); }; });
  await buyer.click('[data-x="rtsend"]');
  const kase = await until(async () => !!(await admin(async d => { const s = await getDoc(doc(d, 'orders/o1')); return s.data().caseId; })), 10000);
  ok(kase, 'buyer: return case sent with the real rules (' + (await buyer.evaluate(() => (window.__toasts || []).join(' | '))) + ')');
  const cid = await admin(async d => (await getDoc(doc(d, 'orders/o1'))).data().caseId);
  const cdoc = cid ? await admin(async d => (await getDoc(doc(d, 'cases/' + cid))).data()) : null;
  ok(!!cdoc && cdoc.uid === buyerUid && cdoc.status === 'open' && cdoc.video === true && !('owner' in cdoc), 'case saved: buyer, open, with video, no decision');
  ok(((await admin(async d => (await getDoc(doc(d, 'kyc/' + buyerUid))).data())) || {}).racct === '0101999', 'refund account saved privately under the buyer');
  ok(await until(() => buyer.evaluate(() => !!document.querySelector('[data-x="vidwa"]'))), 'buyer: WhatsApp video button shows');
  ok(await until(() => shop.evaluate(id => ST.cases.some(c => c.id === id), cid)), 'shop: receives the case about its order');
  ok(await until(() => buyer.evaluate(id => ST.cases.some(c => c.id === id), cid)), 'buyer: still sees own case (cases merged from both queries)');
  ok(await stranger.evaluate(id => !ST.cases.some(c => c.id === id), cid), 'other shop owner: does not get it');
  await buyer.evaluate(() => { ST.contact = { wa: '8562055556666' }; window.open = () => {}; });
  await buyer.click('[data-x="vidwa"]');
  ok(await until(async () => !!(await admin(async d => (await getDoc(doc(d, 'cases/' + cid))).data().vidSentAt))), 'buyer: “video sent on WhatsApp” saved with the real rules');
  // "not received" on another delivered order
  await buyer.evaluate(async () => { await put('orders', 'o2', { uid: H.uid, no: 'SS-2', pid: 'p1', pname: 'ໝໍ້ຫຸງເຂົ້າ', vlabel: '—', qty: 1, price: 250000, shopId: 's1', shopName: 'Kham', status: 'await_shop', acct: '2098798512', cust: { name: 'Noy', phone: '2098798512' }, createdAt: Date.now(), history: [] }); });
  await admin(d => updateDoc(doc(d, 'orders/o2'), { status: 'delivered', deliveredAt: Date.now() }));
  ok(await until(() => buyer.evaluate(() => (byId(ST.orders, 'o2') || {}).status === 'delivered')), 'buyer: second order delivered');
  await buyer.evaluate(() => { S.oid = 'o2'; S.tab = 'orders'; S.screen = 'home'; render(); });
  await buyer.click('[data-x="notrcv"]'); await buyer.click('[data-x="notrcv"]');
  ok(await until(async () => !!(await admin(async d => (await getDoc(doc(d, 'orders/o2'))).data().caseId))), 'buyer: “not received” opens a case with the real rules');

  // ---- test mode: closed to the public, one-time invite links ----
  await admin(d => setDoc(doc(d, 'settings/site'), { private: true }));
  await admin(d => setDoc(doc(d, 'invites/TRY23456'), { createdAt: Date.now(), note: 'tester' }));
  const fresh = async (url) => {
    const ctx = await browser.newContext({ viewport: { width: 430, height: 900 } });
    await ctx.route('https://www.gstatic.com/firebasejs/12.19.0/*', r => r.fulfill({ path: path.join(SDK, path.basename(new URL(r.request().url()).pathname)), contentType: 'application/javascript' }));
    const pg = await ctx.newPage(); pg.on('pageerror', e => { console.log('ERR(test-mode)', e.message); fails++; });
    await pg.goto('http://localhost:5055' + url); await wait(2500); return { ctx, pg };
  };
  const isLocked = pg => pg.evaluate(() => typeof locked === 'function' && locked());
  const v = await fresh('/?fb=1');
  ok(await isLocked(v.pg) && (await v.pg.textContent('body')).includes('ກຳລັງພັດທະນາ') && !(await v.pg.textContent('body')).includes('ໝໍ້ຫຸງເຂົ້າ'), 'test mode: a visitor without an invite sees the lock page, no products');
  const t1 = await fresh('/?fb=1&inv=TRY23456');
  ok(!(await isLocked(t1.pg)) && await until(() => t1.pg.evaluate(() => document.body.textContent.includes('ສິນຄ້ານຳເຂົ້າ'))), 'invite link: the tester gets in and sees the products');
  ok(!(await t1.pg.evaluate(() => location.search.includes('inv='))), 'the invite code is removed from the address bar');
  const claimed = await admin(async d => (await getDoc(doc(d, 'invites/TRY23456'))).data());
  ok(!!claimed.claimedBy && claimed.claimedBy === await t1.pg.evaluate(() => H.uid), 'the invite is now marked as used by that tester');
  await t1.pg.reload(); await wait(2500);
  ok(!(await isLocked(t1.pg)), 'refreshing the same tab keeps access');
  const t1b = await t1.ctx.newPage(); await t1b.goto('http://localhost:5055/?fb=1'); await wait(2500);
  ok(await isLocked(t1b), 'a new tab (after leaving) is locked again');
  const t2 = await fresh('/?fb=1&inv=TRY23456');
  ok(await isLocked(t2.pg) && (await t2.pg.textContent('body')).includes('ໃຊ້ແລ້ວ'), 'the same link a second time: “this invite was already used”');
  await team0.reload(); await wait(2500);
  ok(!(await isLocked(team0)), 'the team is never locked out');
  // the team makes a link on the settings page: it shows up in the list right away, the name box is cleared
  await team0.evaluate(() => { S.tab = 'team'; S.sub = 'fees'; render(); });
  await team0.fill('[data-inv="1"]', 'Lang'); await team0.click('[data-x="invnew"]');
  ok(await until(async () => (await team0.$$('[data-x="invcopy"]')).length > 0 && (await team0.textContent('#cfgtop')).includes('Lang')), 'settings page: a new invite link appears in the list at once');
  ok(await team0.inputValue('[data-inv="1"]') === '', 'the name box is cleared after making the link');
  await stranger.reload(); await wait(2500);
  ok(!(await isLocked(stranger)), 'a shop owner (linked shop) is never locked out');
  await admin(d => setDoc(doc(d, 'settings/site'), { private: false }));
  await wait(1200);
  ok(!(await isLocked(v.pg)), 'test mode off: everyone gets in again');
  // main link open to everyone; a tester who came with an invite cannot come back once the visit is over
  await admin(d => setDoc(doc(d, 'invites/OPEN2345'), { createdAt: Date.now(), note: 'tester 2' }));
  const t3 = await fresh('/?fb=1&inv=OPEN2345');
  ok(!(await isLocked(t3.pg)) && await until(() => t3.pg.evaluate(() => document.body.textContent.includes('ສິນຄ້ານຳເຂົ້າ'))), 'site open + invite link: the tester gets in');
  const t3b = await t3.ctx.newPage(); await t3b.goto('http://localhost:5055/?fb=1'); await wait(2500);
  ok(await isLocked(t3b) && (await t3b.textContent('body')).includes('ຂອບໃຈທີ່ຊ່ວຍທົດສອບ'), 'the tester comes back through the MAIN link in a new tab → locked, “thanks for testing”');
  const uid3 = await t3.pg.evaluate(() => H.uid);
  ok(!!(await admin(async d => (await getDoc(doc(d, 'testers/' + uid3))).exists())), 'the device is remembered on the server as a tester');
  await t3b.evaluate(() => { try { localStorage.clear(); } catch (e) {} }); await t3b.reload(); await wait(2500);
  ok(await isLocked(t3b), 'clearing the browser storage does not get the tester back in');
  const pub = await fresh('/?fb=1');
  ok(!(await isLocked(pub.pg)), 'anyone else using the main link gets in as normal');


  await browser.close(); await env.cleanup(); server.close();
  console.log(fails ? fails + ' FAILED' : 'ALL PASSED'); process.exit(fails ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
