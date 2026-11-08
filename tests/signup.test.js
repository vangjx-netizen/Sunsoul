// New people can create an account (name + phone); anyone signing in without a name is asked for it once.
const { chromium } = require('playwright'); const path = require('path');
let fails = 0; const ok = (c, m) => { console.log((c ? 'PASS ' : 'FAIL ') + m); if (!c) fails++; };
(async () => {
  const b = await chromium.launch(process.env.CHROME_PATH ? { executablePath: process.env.CHROME_PATH } : {});
  const p = await b.newPage({ viewport: { width: 430, height: 900 } });
  p.on('pageerror', e => { console.log('ERR', e.message); fails++; });
  await p.goto('file://' + path.join(__dirname, '..', 'public', 'index.html')); await p.waitForTimeout(300);
  await p.evaluate(() => { S.user = null; S.tab = 'account'; render(); });
  let t = await p.textContent('main');
  ok(t.includes('ເຂົ້າສູ່ລະບົບ ຫຼື ສ້າງບັນຊີໃໝ່') && !!(await p.$('[data-x="signup"]')) && !!(await p.$('[data-x="login"]')), 'account page offers “sign in” and “create a new account”');

  // create an account
  await p.click('[data-x="signup"]'); await p.waitForTimeout(80);
  ok((await p.textContent('main')).includes('ສ້າງບັນຊີໃໝ່') && !!(await p.$('[data-lg="name"]')), 'sign-up screen asks for name and phone');
  await p.fill('[data-lg="phone"]', '20 5555 1234'); await p.click('[data-x="lgsend"]'); await p.waitForTimeout(80);
  ok((await p.textContent('main')).includes('ກະລຸນາໃສ່ຊື່'), 'name is required to create an account');
  await p.fill('[data-lg="name"]', 'ນ້ອຍ'); await p.click('[data-x="lgsend"]'); await p.waitForTimeout(80);
  await p.fill('[data-lg="code"]', '123456'); await p.click('[data-x="lgok"]'); await p.waitForTimeout(150);
  ok(await p.evaluate(() => S.user && S.user.name === 'ນ້ອຍ' && S.tab === 'account'), 'account created with the name, back on the account page');
  ok((await p.textContent('#toast')).includes('ສ້າງບັນຊີສຳເລັດ'), '“account created” message');
  ok((await p.textContent('main')).includes('ນ້ອຍ'), 'account page shows the name');

  // signing in again later remembers the name on this device
  await p.evaluate(() => { S.user = null; S.lg = { step: 'code', mode: 'login', phone: '20 5555 1234', code: '123456', err: '' }; lgOk(); });
  ok(await p.evaluate(() => S.user && S.user.name === 'ນ້ອຍ'), 'signing in again on this device: no need to retype the name');

  // signing in with a new number and no name → asked once
  await p.evaluate(() => { S.user = null; S.after = 'account'; S.lg = { step: 'code', mode: 'login', phone: '20 7777 0000', code: '123456', err: '' }; S.tab = 'home'; S.screen = 'login'; lgOk(); });
  ok(await p.evaluate(() => S.lg.step === 'name' && !S.user), 'first sign-in without a name → asked for the name');
  await p.click('[data-x="lgname"]'); await p.waitForTimeout(50);
  ok(await p.evaluate(() => !S.user), 'cannot skip the name');
  await p.fill('[data-lg="name"]', 'ຄຳ'); await p.click('[data-x="lgname"]'); await p.waitForTimeout(100);
  ok(await p.evaluate(() => S.user && S.user.name === 'ຄຳ'), 'name saved, signed in');

  // switching between the two modes
  await p.evaluate(() => { S.user = null; S.lg = { step: 'phone', phone: '', code: '', err: '' }; S.tab = 'home'; S.screen = 'login'; render(); });
  ok(!(await p.$('[data-lg="name"]')), 'sign-in screen has no name field');
  await p.click('[data-x="lgmode"]'); await p.waitForTimeout(50);
  ok(!!(await p.$('[data-lg="name"]')), '“no account yet? create one” switches to sign-up');
  await b.close(); console.log(fails ? fails + ' FAILED' : 'ALL PASSED'); process.exit(fails ? 1 : 0);
})();
