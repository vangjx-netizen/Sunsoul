const { chromium } = require('playwright');const path=require('path');let fails=0;const ok=(c,m)=>{console.log((c?'PASS ':'FAIL ')+m);if(!c)fails++};
(async()=>{const b=await chromium.launch(process.env.CHROME_PATH?{executablePath:process.env.CHROME_PATH}:{});const p=await b.newPage({viewport:{width:430,height:900}});
p.on('pageerror',e=>{console.log('ERR',e.message);fails++});
await p.goto('file://'+path.join(__dirname,'..','public','index.html'));await p.waitForTimeout(300);
await p.evaluate(()=>{const H1=3600e3,t0=Date.now()-2*86400e3;S.user={phone:'2098798512',name:'Noy'};
 ST.shops.push({id:'far',name:'FarShop',prov:'ຫຼວງພະບາງ',pickup:'self',phone:'1'},{id:'cap',name:'CapShop',prov:'ນະຄອນຫຼວງວຽງຈັນ',pickup:'team',phone:'2'});
 const base={pid:'p1',pname:'ເສື້ອ',vlabel:'L',qty:1,price:100000,acct:'2098798512',cust:{name:'Noy',phone:'2098798512'},createdAt:t0,history:[],kind:'local'};
 ST.locks.F={price:100000,qty:1,fee:20000,total:120000,verifiedAt:t0};ST.locks.D={price:100000,qty:1,fee:15000,total:115000,verifiedAt:t0};
 ST.orders.push({...base,id:'F',no:'SS-F',shopId:'far',shopName:'FarShop',status:'delivered',deliveredAt:t0+H1,handedAt:t0},
  {...base,id:'D',no:'SS-D',shopId:'cap',shopName:'CapShop',status:'delivered',deliveredAt:t0+H1,pickPhotos:['u:x']},
  {...base,id:'S',no:'SS-S',shopId:'cap',shopName:'CapShop',status:'shipping'});
 S.tab='account';render()});
// policy page
await p.click('[data-x="polopen"]');await p.waitForTimeout(100);let t=await p.textContent('main');
ok(t.includes('ກໍລະນີທີ່ບໍ່ຮັບຄືນ')&&t.includes('ປ່ຽນໃຈ')&&t.includes('ຮ້ານຝາກຂົນສົ່ງເອງ')&&t.includes('ວິດີໂອຕອນແກະກ່ອງ'),'policy page: accepted / not accepted / who pays / evidence');
// unboxing reminder while shipping
await p.evaluate(()=>{S.pol=false;S.tab='orders';S.oid='S';render()});
ok((await p.textContent('main')).includes('ກ່ອນແກະກ່ອງ ເລີ່ມຖ່າຍວິດີໂອກ່ອນ'),'order on its way shows the unboxing-video reminder');
// return form
await p.evaluate(()=>{S.oid='F';S.rt={reason:'',note:'',imgs:[],video:null};S.tab='home';S.screen='return';render()});
await p.click('[data-x="rtreason"][data-k="mind"]');await p.waitForTimeout(50);t=await p.textContent('main');
ok(t.includes('ກໍລະນີນີ້ບໍ່ຮັບຄືນ')&&!(await p.$('[data-x="rtsend"]')),'change of mind: told no, no send button');
await p.click('[data-x="rtreason"][data-k="damaged"]');await p.click('[data-x="rtvid"][data-k="0"]');await p.waitForTimeout(50);
ok((await p.textContent('main')).includes('ບໍ່ມີວິດີໂອແກະກ່ອງ ບໍ່ສາມາດຮັບຄືນໄດ້')&&!(await p.$('[data-x="rtsend"]')),'no unboxing video: blocked');
await p.click('[data-x="rtvid"][data-k="1"]');await p.waitForTimeout(50);
await p.click('[data-x="vidpre"]');await p.waitForTimeout(80);
ok(!(await p.$('[data-rt="vlink"]'))&&(await p.textContent('main')).includes('WhatsApp')&&(await p.evaluate(()=>document.body.textContent.includes(T.vwFirst))),'video: no link box, told to send it on WhatsApp after sending the case');
await p.evaluate(()=>{S.rt.imgs=['u:a','u:b'];rr()});await p.click('[data-x="rtsend"]');await p.waitForTimeout(100);
ok(await p.evaluate(()=>ST.cases.length)===0,'refund account required');
await p.click('[data-x="rtsend"]');await p.waitForTimeout(80);
ok(await p.evaluate(()=>ST.cases.length===0&&document.querySelector('#rterr').textContent===T.wantNeed),'must choose refund or exchange');
await p.click('[data-x="rtwant"][data-k="refund"]');await p.waitForTimeout(50);
await p.fill('[data-rt="rbank"]','BCEL');await p.fill('[data-rt="racct"]','0101999');await p.fill('[data-rt="rname"]','NOY');
await p.click('[data-x="rtsend"]');await p.waitForTimeout(200);
let c=await p.evaluate(()=>ST.cases[0]);
ok(c&&c.video===true&&c.shipper==='shop'&&!c.racct,'case saved with video + shipper, bank not in the case');
await p.evaluate(()=>{ST.contact={wa:'8562055556666'};window.__wa=[];window.open=u=>{window.__wa.push(u)};S.oid='F';S.screen='home';S.tab='orders';render()});
ok(!!(await p.$('[data-x="vidwa"]')),'open case shows “send video on WhatsApp”');
await p.click('[data-x="vidwa"]');await p.waitForTimeout(150);
const wa=await p.evaluate(()=>window.__wa[0]||'');
ok(/wa\.me\/8562055556666/.test(wa)&&decodeURIComponent(wa).includes(c.no)&&decodeURIComponent(wa).includes('#'),'WhatsApp opens to the team with case and order number typed in');
ok(await p.evaluate(id=>!!(ST.cases.find(x=>x.id===id)||{}).vidSentAt,c.id),'case notes that the customer opened WhatsApp');
ok(await p.evaluate(k=>ST.kyc[k]&&ST.kyc[k].racct==='0101999',c.kycId),'refund account stored privately');
// team: shop shipped itself → shop pays, Sunsoul option disabled
await p.evaluate(id=>{S.canAdmin=true;S.tab='team';S.sub='cases';S.cid=id;render()},c.id);t=await p.textContent('main');
ok(t.includes('ຮ້ານຝາກຂົນສົ່ງເອງ')&&t.includes('ຮ້ານຮັບຜິດຊອບ')&&t.includes('120,000'),'team: suggestion = shop pays, refund 120,000');
ok(await p.$eval('[data-xc="cowner"][data-k="us"]',e=>e.disabled),'"Sunsoul pays" is disabled when the shop shipped itself');
await p.fill('[data-cnote]','ວິດີໂອເຫັນເສື້ອຂາດຕັ້ງແຕ່ແກະ');await p.click('[data-x="cdecide"]');await p.waitForTimeout(200);
c=await p.evaluate(id=>byId(ST.cases,id),c.id);ok(c.status==='closed'&&c.owner==='store'&&c.refund===120000,'decided: shop pays, refund 120,000');
// payouts: shop not paid for that order
await p.evaluate(()=>{byId(ST.orders,'F').handedAt=Date.now()-30*86400e3;S.sub='payouts';S.cid=null;render()});t=await p.textContent('main');
ok(t.includes('ບໍ່ໂອນ')&&t.includes('SS-F'),'payouts: the order is marked "not paid to shop"');
ok(await p.evaluate(()=>!forfeit(byId(ST.orders,'D'))&&forfeit(byId(ST.orders,'F'))),'only the shop-fault order is withheld');
// refund list
await p.evaluate(()=>{S.sub='cases';render()});t=await p.textContent('main');
ok(!t.includes('ຕ້ອງຄືນເງິນລູກຄ້າ'),'carrier order: no refund before the item is back');
await p.evaluate(()=>{const c=ST.cases.find(x=>x.oid==='F');c.retSentAt=Date.now();c.retGotAt=Date.now();c.retFee=0;render()});t=await p.textContent('main');
ok(t.includes('ຕ້ອງຄືນເງິນລູກຄ້າ')&&t.includes('0101999')&&t.includes('120,000'),'item back → team refund to-do shows amount and customer account');
await p.click('[data-x="rfdone"]');await p.waitForTimeout(200);
await p.evaluate(()=>{S.canAdmin=false;S.tab='orders';S.oid='F';render()});t=await p.textContent('main');
ok(t.includes('ໂອນຄືນ 120,000 ກີບ ແລ້ວ'),'customer sees the refund done');
// team-handled delivery: question decides
await p.evaluate(()=>{ST.cases.push({id:'k2',no:'RT-2',oid:'D',reason:'damaged',video:true,status:'open',owner:'',createdAt:Date.now(),shipper:'team'});S.canAdmin=true;S.tab='team';S.sub='cases';S.cid='k2';render()});
ok(!(await p.$eval('[data-xc="cowner"][data-k="us"]',e=>e.disabled)),'team delivered: Sunsoul option allowed');
await p.click('[data-x="cpk"][data-k="ok"]');await p.waitForTimeout(80);
ok((await p.textContent('main')).includes('ທີມເຫັນເຄື່ອງດີ')&&await p.$eval('[data-xc="cowner"][data-k="us"]',e=>e.checked),'pickup photos fine → Sunsoul pays');
await p.click('[data-x="cpk"][data-k="bad"]');await p.waitForTimeout(80);
ok(await p.$eval('[data-xc="cowner"][data-k="store"]',e=>e.checked),'pickup photos already wrong → shop pays');
await p.screenshot({path:path.join(__dirname,'out','policy.png'),fullPage:true});
await b.close();console.log(fails?fails+' FAILED':'ALL PASSED');process.exit(fails?1:0)})();
