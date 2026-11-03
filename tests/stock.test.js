const { chromium } = require('playwright');const path=require('path');let fails=0;const ok=(c,m)=>{console.log((c?'PASS ':'FAIL ')+m);if(!c)fails++};
(async()=>{const b=await chromium.launch(process.env.CHROME_PATH?{executablePath:process.env.CHROME_PATH}:{});const p=await b.newPage({viewport:{width:430,height:900}});
p.on('pageerror',e=>{console.log('ERR',e.message);fails++});
await p.addInitScript(()=>{window.claude={use:async n=>n==='user'?{canEdit:async()=>true}:null}});
await p.goto('file://'+path.join(__dirname,'..','public','index.html'));await p.waitForTimeout(300);
const red='data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8DwHwAFBQIAX8jx0gAAAABJRU5ErkJggg==';
await p.evaluate(r=>{ST.up.red={data:r};ST.up.blue={data:r};ST.up.main={data:r};S.user={phone:'020 7777 8888',name:'C'};ST.shops.push({id:'s1',name:'ຮ້ານ ເຈເຈ',map:'17.9700,102.6100'});
ST.shopProducts.push({id:'sp1',status:'live',name:'ເສື້ອກັນໜາວ',cat:'clothes',shopId:'s1',shopName:'ຮ້ານ ເຈເຈ',weight:0.5,variants:[{label:'ແດງ · L',price:320000,stock:10,img:'u:red'},{label:'ຟ້າ · L',price:320000,stock:10,img:'u:blue'}],imgs:['u:main'],active:true,createdAt:1,stockAt:1,updatedAt:1});mergeP();},red);
// order 2 of red
await p.evaluate(async()=>{for(let i=0;i<2;i++){S.pid='sp1';S.vi=0;S.co={name:'C',phone:'020 7777 8888',addr:'ບ້ານ ໂພນທັນ, ນະຄອນຫຼວງ',map:'17.9757, 102.6331'};S.coCart=false;S.tab='home';S.screen='checkout';render();await placeOrder();await new Promise(r=>setTimeout(r,20))}});
const left=await p.evaluate(()=>{const x=byId(ST.products,'sp1');return [stockLeft(x,x.variants[0]),stockLeft(x,x.variants[1])].join()});
ok(left==='8,10','10 in stock, 2 ordered → red shows 8 left right away, blue still 10 ('+left+')');
await p.evaluate(()=>{S.shopId='s1';S.tab='store';S.ss='products';S.sp=null;render()});
ok((await p.textContent('main')).includes('ເຫຼືອ 18'),'shop list shows 18 left in total (8 + 10)');
await p.click('[data-x="spedit"][data-id="sp1"]');await p.waitForTimeout(100);
ok(await p.inputValue('[data-spv="0:stock"]')==='8','edit form shows 8, not 10');
await p.click('[data-x="spsend"]');await p.waitForTimeout(100);
ok(await p.evaluate(()=>{const x=byId(ST.products,'sp1');return stockLeft(x,x.variants[0])})===8,'saving without changes keeps 8');
await p.click('[data-x="spedit"][data-id="sp1"]');await p.fill('[data-spv="0:stock"]','12');await p.click('[data-x="spsend"]');await p.waitForTimeout(100);
ok(await p.evaluate(()=>{const x=byId(ST.products,'sp1');return stockLeft(x,x.variants[0])})===12,'setting 12 means 12 can still be sold');
await p.evaluate(async()=>{const o=ST.orders.find(o=>o.pid==='sp1');await answerOrder(o.id,false);await new Promise(r=>setTimeout(r,20))});
ok(await p.evaluate(()=>{const x=byId(ST.products,'sp1');return stockLeft(x,x.variants[0])})===13,'a declined order gives its item back (13)');
// per-option photo on the product page
await p.evaluate(()=>{ST.shopOff=[];syncOff();S.tab='home';S.pid='sp1';S.vi=1;S.img=0;S.screen='product';render()});
const pg=await p.evaluate(()=>({sel:document.querySelector('.lb span').textContent,thumbs:document.querySelectorAll('.vo .voi').length,first:vimgs(byId(ST.products,'sp1'),priced(byId(ST.products,'sp1'))[S.vi])[0]}));
ok(pg.sel.includes('ຟ້າ · L')&&pg.thumbs===2&&pg.first==='u:blue','option buttons show their photos; picked "ຟ້າ · L" is spelled out and its photo leads ('+JSON.stringify(pg)+')');
await p.screenshot({path:path.join(__dirname,'out','variant-page.png')});
await b.close();console.log(fails?fails+' FAILED':'ALL PASSED');process.exit(fails?1:0)})();
