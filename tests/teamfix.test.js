// (2) the team is told when a customer cancels after a slip problem; (4) the team can ask the shop to ship a carrier order itself.
const { chromium } = require('playwright'); const path = require('path');
let fails = 0; const ok = (c, m) => { console.log((c ? 'PASS ' : 'FAIL ') + m); if (!c) fails++; };
(async () => {
  const b = await chromium.launch(process.env.CHROME_PATH ? { executablePath: process.env.CHROME_PATH } : {});
  const p = await b.newPage({ viewport: { width: 430, height: 900 } });
  p.on('pageerror', e => { console.log('ERR', e.message); fails++; });
  await p.addInitScript(() => { window.claude = { use: async n => n === 'user' ? { canEdit: async () => true } : null }; });
  await p.goto('file://' + path.join(__dirname, '..', 'public', 'index.html')); await p.waitForTimeout(400);
  await p.evaluate(() => {
    S.user = { phone: '020 7777 8888', name: 'Noy' };
    ST.shops.push({ id: 'far', name: 'Far Shop', prov: 'ນະຄອນຫຼວງວຽງຈັນ', pickup: 'team', addr: 'ບ້ານໄກ', map: '18.2, 102.4' });
    const base = { pid: 'p', pname: 'ພັດລົມ', vlabel: 'ຂາວ', qty: 1, price: 100000, shopId: 'far', shopName: 'Far Shop', cust: { name: 'Noy', phone: '020 7777 8888' }, acct: '020 7777 8888', createdAt: 1, history: [] };
    ST.orders.push(
      { ...base, id: 'sl', no: 'SS-sl', kind: 'local', status: 'await_pay', slipRejected: true, slipId: '', slipWhy: { r: 'fake', at: Date.now() }, payDeadline: Date.now() + 3600000 },
      { ...base, id: 'c1', no: 'SS-c1', kind: 'carrier', status: 'await_shop', shopDeadline: Date.now() + 3600000, addr: 'ສາຂາ ອານຸສິດ ໂພນທັນ' },
      { ...base, id: 'c2', no: 'SS-c2', kind: 'carrier', status: 'await_shop', shopDeadline: Date.now() + 3600000, addr: 'ສາຂາ ອານຸສິດ ໂພນທັນ' });
    ST.locks.sl = { price: 100000, qty: 1, fee: 15000, total: 115000, pay: 'qr', got: 0 };
  });
  const T_ = k => p.evaluate(k2 => { const v = T[k2]; return typeof v === 'function' ? v(1) : v; }, k);

  // ---- (2) customer cancels after the slip was flagged ----
  await p.evaluate(() => { S.tab = 'orders'; S.oid = 'sl'; S.screen = 'home'; render(); });
  await p.click('[data-x="ccancel"][data-id="sl"]'); await p.click('[data-x="ccancel"][data-id="sl"]'); await p.waitForTimeout(100);
  ok(await p.evaluate(() => byId(ST.orders, 'sl').status === 'cancelled'), 'customer cancels after the slip problem');
  await p.evaluate(() => { S.tab = 'team'; S.sub = 'overview'; render(); });
  ok((await p.textContent('main')).includes(await T_('cxsHome')), 'team overview: alert “customer cancelled after a slip problem”');
  await p.evaluate(() => { S.sub = 'verify'; render(); });
  let t = await p.textContent('main');
  ok(t.includes(await T_('cxsT')) && t.includes('SS-sl') && t.includes(await T_('cxsNoMoney')), 'slip page: the cancelled order, the slip problem, and that no money came in');
  await p.click('[data-x="cxsseen"][data-id="sl"]'); await p.waitForTimeout(100);
  ok(!(await p.textContent('main')).includes(await T_('cxsT')), 'team acknowledges → notice leaves');

  // ---- (4) team can't collect: ask the shop to ship it itself, before it accepts ----
  await p.evaluate(() => { S.sub = 'run'; render(); });
  ok(!!(await p.$('[data-x="askself"][data-id="c1"]')), 'run page: new carrier orders the team would collect, with “ask the shop”');
  await p.click('[data-x="askself"][data-id="c1"]'); await p.click('[data-x="askself"][data-id="c2"]'); await p.waitForTimeout(100);
  ok(await p.evaluate(() => !!byId(ST.orders, 'c1').askSelfShip) && !!(await p.$('[data-x="askselfx"][data-id="c1"]')), 'asked; the team can withdraw the question');
  await p.evaluate(() => { S.shopId = 'far'; S.tab = 'store'; S.ss = 'orders'; render(); });
  t = await p.textContent('main');
  ok(t.includes(await p.evaluate(() => T.ssT)) && !!(await p.$('[data-x="sself"][data-id="c1"]')) && !(await p.$('[data-x="syes"][data-id="c1"]')), 'shop: asked to pack and ship itself, instead of the usual yes/no');
  await p.click('[data-x="sself"][data-id="c1"]'); await p.waitForTimeout(150);
  ok(await p.evaluate(() => { const o = byId(ST.orders, 'c1'); return o.selfShip === true && o.status === 'await_pay' && dMode(o) === 'shop'; }), 'shop agrees: order accepted, the shop ships it (shop’s responsibility rules)');
  await p.click('[data-x="snoship"][data-id="c2"]'); await p.waitForTimeout(50);
  await p.click('[data-x="snoship"][data-id="c2"]'); await p.waitForTimeout(150);
  ok(await p.evaluate(() => { const o = byId(ST.orders, 'c2'); return o.status === 'cancelled' && o.cancelWhy === 'noship'; }), 'shop cannot: order cancelled (customer had not paid yet)');
  await p.evaluate(() => { S.shopId = null; S.tab = 'orders'; S.oid = 'c2'; render(); });
  ok((await p.textContent('main')).includes(await p.evaluate(() => T.cxNoShip)), 'customer is told why it was cancelled');
  await p.evaluate(() => { S.tab = 'team'; S.sub = 'run'; render(); });
  ok(!(await p.$('[data-x="askself"][data-id="c1"]')) && !(await p.$('[data-x="dok"][data-id="c1"]')), 'self-shipped order is no longer on the team’s pickup list');
  await b.close(); console.log(fails ? fails + ' FAILED' : 'ALL PASSED'); process.exit(fails ? 1 : 0);
})();
