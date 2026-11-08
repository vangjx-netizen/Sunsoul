const { chromium } = require('playwright');const path=require('path');let fails=0;const ok=(c,m)=>{console.log((c?'PASS ':'FAIL ')+m);if(!c)fails++};
(async()=>{const b=await chromium.launch(process.env.CHROME_PATH?{executablePath:process.env.CHROME_PATH}:{});const p=await b.newPage({viewport:{width:430,height:900}});
p.on('pageerror',e=>{console.log('ERR',e.message);fails++});
await p.goto('file://'+path.join(__dirname,'..','public','index.html'));await p.waitForTimeout(300);
const px='data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8DwHwAFBQIAX8jx0gAAAABJRU5ErkJggg==';
await p.evaluate(r=>{['d1','d2','d3'].forEach(k=>ST.up[k]={data:r});S.user={phone:'020 7777 8888',name:'C'};ST.shops.push({id:'s1',name:'tt',map:'17.9700,102.6100'});
ST.shopProducts.push({id:'sp1',status:'live',name:'ເສື້ອຄຸມ',cat:'clothes',shopId:'s1',shopName:'tt',weight:0.5,variants:[{label:'S',price:230000,stock:9},{label:'M',price:230000,stock:8}],imgs:['u:d1','u:d2','u:d3'],multiDesign:true,active:true,createdAt:1,stockAt:1,updatedAt:1});ST.shopProducts.push({id:'sp2',status:'live',name:'ເກີບ',cat:'shoes',shopId:'s1',shopName:'tt',weight:0.5,variants:[{label:'40',price:200000,stock:3}],imgs:['u:d1','u:d2'],active:true,createdAt:1,stockAt:1,updatedAt:1});mergeP();S.pid='sp1';S.vi=0;S.screen='product';render()},px);
const pg=await p.textContent('main');ok(!pg.includes('ເຫຼືອ 9')&&!pg.includes('ເຫຼືອ 8'),'customer product page shows no stock counts');
await p.click('[data-act="order"]');await p.waitForTimeout(150);
ok((await p.$$('[data-x="refpick"]')).length===3,'checkout offers the 3 product photos to point at');
await p.click('[data-x="refpick"][data-rimg="u:d2"]');await p.waitForTimeout(80);
ok(await p.getAttribute('[data-x="refpick"][data-rimg="u:d2"]','aria-pressed')==='true','tapped design is highlighted');
await p.fill('[data-refnote]','ສີດຳ ລາຍທາງ');
await p.evaluate(()=>{S.co.addr='ບ້ານ ໂພນທັນ, ນະຄອນຫຼວງ';S.co.map='17.9757, 102.6331';rr()});
await p.click('[data-x="place"]');await p.waitForTimeout(250);
let o=await p.evaluate(()=>ST.orders[0]);ok(o&&o.refImg==='u:d2'&&o.refNote==='ສີດຳ ລາຍທາງ','order carries the chosen design and note');
// own screenshot
await p.evaluate(()=>{S.pid='sp1';S.vi=1;S.tab='home';S.screen='product';render()});await p.click('[data-act="order"]');await p.waitForTimeout(150);
const [fc]=await Promise.all([p.waitForEvent('filechooser'),p.click('[data-x="refup"]')]);await fc.setFiles(path.join(__dirname,'fixtures','px.png'));await p.waitForTimeout(300);
await p.click('[data-x="place"]');await p.waitForTimeout(250);
o=await p.evaluate(()=>ST.orders[1]);ok(o&&String(o.refImg).startsWith('u:')&&o.refImg!=='u:d1'&&o.refImg!=='u:d2'&&o.refImg!=='u:d3','customer can upload their own picture instead');
await p.evaluate(()=>{S.shopId='s1';S.tab='store';S.ss='orders';render()});
const sh=await p.textContent('main');ok(sh.includes('ລູກຄ້າຕ້ອງການລາຍນີ້')&&sh.includes('ສີດຳ ລາຍທາງ')&&(await p.$$('.refshow img')).length===2,'shop sees both chosen designs and the note');
await p.screenshot({path:path.join(__dirname,'out','ref-shop.png')});
await p.evaluate(()=>{S.shopId='s1';S.tab='store';S.ss='products';render()});ok((await p.textContent('main')).includes('ເຫຼືອ'),'shop still sees stock counts');
await p.evaluate(()=>{S.pid='sp1';S.vi=0;S.tab='home';S.screen='product';render()});await p.click('[data-act="order"]');await p.waitForTimeout(150);await p.click('[data-x="refpick"][data-rimg="u:d3"]');await p.waitForTimeout(80);
await p.screenshot({path:path.join(__dirname,'out','ref-checkout.png'),fullPage:true});
// product page: picker visible before ordering; choice carries to checkout and the order
await p.evaluate(()=>{S.coRef={};S.pid='sp1';S.vi=1;S.coCart=false;S.tab='home';S.screen='product';render()});
ok((await p.$$('main [data-x="refpick"]')).length===3,'design picker shows on the product page');
await p.click('[data-x="refpick"][data-rimg="u:d3"]');await p.waitForTimeout(80);
await p.click('[data-act="order"]');await p.waitForTimeout(150);
ok(await p.getAttribute('[data-x="refpick"][data-rimg="u:d3"]','aria-pressed')==='true','checkout already shows the design picked on the product page');
await p.click('[data-x="place"]');await p.waitForTimeout(250);
ok(await p.evaluate(()=>ST.orders[ST.orders.length-1].refImg)==='u:d3','order carries the design picked on the product page');
await p.evaluate(()=>{S.pid='sp2';S.vi=0;S.tab='home';S.screen='product';render()});
ok((await p.$$('main [data-x="refpick"]')).length===0,'no picker on the product page for a product shot from several angles');
// a product photographed from several angles: no design picker
await p.evaluate(()=>{S.pid='sp2';S.vi=0;S.coCart=false;S.tab='home';S.screen='product';render()});await p.click('[data-act="order"]');await p.waitForTimeout(150);
ok((await p.$$('[data-x="refpick"]')).length===0,'same item shot from several angles: no design picker at checkout');
// pay reminder on home once the shop has confirmed
await p.evaluate(async()=>{for(const o of ST.orders.filter(o=>o.status==='await_shop'))await answerOrder(o.id,true);await new Promise(r=>setTimeout(r,30));S.tab='home';S.screen='home';render()});
ok((await p.textContent('main')).includes('ລໍທ່ານຈ່າຍເງິນ'),'home shows the pay reminder');
await p.click('[data-x="paygo"]');await p.waitForTimeout(150);
ok(!!(await p.$('.qrbox')),'reminder opens an order with its QR');
// shop form switch is saved
await p.evaluate(()=>{S.shopId='s1';S.tab='store';S.ss='products';S.sp=null;render()});await p.click('[data-x="spedit"][data-id="sp2"]');await p.waitForTimeout(100);
await p.check('[data-spchk="multiDesign"]');await p.click('[data-x="spsend"]');await p.waitForTimeout(100);
ok(await p.evaluate(()=>byId(ST.products,'sp2').multiDesign===true),'shop can switch "photos are different designs" on');
await b.close();console.log(fails?fails+' FAILED':'ALL PASSED');process.exit(fails?1:0)})();
