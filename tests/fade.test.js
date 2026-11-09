// Shop product list: a product switched to "out of stock" is faded right away (and after reload of the list).
const { chromium } = require('playwright'); const path = require('path');
let fails = 0; const ok = (c, m) => { console.log((c ? 'PASS ' : 'FAIL ') + m); if (!c) fails++; };
(async () => {
  const b = await chromium.launch(process.env.CHROME_PATH ? { executablePath: process.env.CHROME_PATH } : {});
  const p = await b.newPage({ viewport: { width: 430, height: 900 } });
  p.on('pageerror', e => { console.log('ERR', e.message); fails++; });
  await p.addInitScript(() => { window.claude = { use: async n => n === 'user' ? { canEdit: async () => true } : null }; });
  await p.goto('file://' + path.join(__dirname, '..', 'public', 'index.html')); await p.waitForTimeout(300);
  await p.evaluate(() => {
    ST.shops.push({ id: 's1', name: 'Shop A', map: '17.9700,102.6100' });
    ['a', 'b'].forEach(id => ST.shopProducts.push({ id, status: 'live', name: 'Item ' + id, cat: 'clothes', shopId: 's1', shopName: 'Shop A', variants: [{ label: 'M', price: 1000, stock: 3 }], imgs: [], createdAt: 1 }));
    mergeP(); S.shopId = 's1'; S.tab = 'store'; S.ss = 'products'; S.sp = null; render();
  });
  const row = id => p.$(`[data-xc="soff"][data-id="${id}"]`).then(h => h.evaluateHandle(e => e.closest('.arow')));
  const faded = async id => (await row(id)).evaluate(r => r.classList.contains('pout') && getComputedStyle(r.querySelector('.am')).opacity < 0.5);
  ok(!(await faded('a')) && !(await faded('b')), 'in-stock products are not faded');
  await p.click('[data-xc="soff"][data-id="a"]'); await p.waitForTimeout(150);
  ok(await faded('a') && !(await faded('b')), 'switching one to out of stock fades only that one');
  ok((await (await row('a')).evaluate(r => r.querySelector('label').textContent)).includes('ໝົດ'), 'its label now reads “out of stock”');
  await p.evaluate(() => render()); await p.waitForTimeout(50);
  ok(await faded('a'), 'still faded after the list is redrawn');
  await p.click('[data-xc="soff"][data-id="a"]'); await p.waitForTimeout(150);
  ok(!(await faded('a')), 'switching it back removes the fade');
  await b.close(); console.log(fails ? fails + ' FAILED' : 'ALL PASSED'); process.exit(fails ? 1 : 0);
})();
