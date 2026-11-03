const { chromium } = require('playwright');const path=require('path');let fails=0;const ok=(c,m)=>{console.log((c?'PASS ':'FAIL ')+m);if(!c)fails++};
(async()=>{const b=await chromium.launch(process.env.CHROME_PATH?{executablePath:process.env.CHROME_PATH}:{});const p=await b.newPage({viewport:{width:430,height:900}});
p.on('pageerror',e=>{console.log('ERR',e.message);fails++});
await p.goto('file://'+path.join(__dirname,'..','public','index.html'));await p.waitForTimeout(300);
await p.evaluate(()=>{const H=3600e3,t0=Date.now()-5*24*H;S.canAdmin=true;S.user={phone:'2098798512',name:'Noy'};
ST.shops.push({id:'s1',name:'tt',phone:'020 5555 1234',addr:'ບ້ານ ໂພນໄຊ',prov:'ນະຄອນຫຼວງວຽງຈັນ',pickup:'team'});
const base={pid:'p1',pname:'ເສື້ອໄໝ',vlabel:'L',qty:1,price:100000,fee:15000,cat:'clothes',shopId:'s1',shopName:'tt',acct:'2098798512',cust:{name:'Noy',phone:'2098798512'},addr:'ບ້ານ ສີສະຫວາດ',kind:'local'};
ST.orders.push({...base,id:'A',no:'SS-A',status:'delivered',createdAt:t0,refNote:'ລາຍດອກໄມ້',pickPhotos:['u:x1'],delPhotos:['u:x2'],receivedAt:t0+30*H,receivedBy:'customer',deliveredAt:t0+28*H,
 history:[{s:'await_pay',at:t0+H,by:'shop'},{s:'await_verify',at:t0+2*H,by:'customer'},{s:'await_pickup',at:t0+3*H,by:'team'},{s:'shipping',at:t0+20*H,by:'team'},{s:'delivered',at:t0+28*H,by:'team'}]},
 {...base,id:'B',no:'SS-B',status:'delivered',createdAt:t0,history:[]},{...base,id:'C',no:'SS-C',status:'cancelled',createdAt:t0,history:[]});
ST.locks=ST.locks||{};
ST.cases.push({id:'c1',no:'RT-1',oid:'A',ono:'SS-A',pname:'ເສື້ອໄໝ',shopId:'s1',shopName:'tt',cust:{name:'Noy'},reason:'wrong',note:'ໄດ້ໄຊສ໌ M',imgs:['u:x3'],status:'open',owner:'',createdAt:t0+50*H},
 {id:'c0',no:'RT-0',oid:'B',shopId:'s1',reason:'damaged',status:'closed',owner:'store',createdAt:t0});
S.tab='team';S.sub='cases';S.cid='c1';render()});
let t=await p.textContent('main');
ok(t.includes('RT-1')&&t.includes('ໄດ້ໄຊສ໌ M'),'case header shows number and customer note');
ok(t.includes('ແຈ້ງຫຼັງໄດ້ຮັບເຄື່ອງ'),'shows how long after receipt the case was filed');
ok(t.includes('ລາຍດອກໄມ້'),'shows the design the customer chose when ordering');
for(const w of ['ລູກຄ້າສັ່ງຊື້','ຮ້ານຢືນຢັນວ່າມີເຄື່ອງ','ລູກຄ້າສົ່ງສະລິບ','ທີມຢືນຢັນຍອດເງິນ','ທີມຮັບເຄື່ອງຈາກຮ້ານ','ສົ່ງຮອດ','ລູກຄ້າຢືນຢັນໄດ້ຮັບ','ລູກຄ້າແຈ້ງເຄສ'])ok(t.includes(w),'timeline: '+w);
const order=await p.$$eval('.evl li b',l=>l.map(x=>x.textContent));ok(order[0]==='ລູກຄ້າສັ່ງຊື້'&&order[order.length-1]==='ລູກຄ້າແຈ້ງເຄສ','timeline is in time order');
ok((await p.$$('.photos img')).length===3,'pickup, delivery and customer photos are side by side');
ok(t.includes('ສັ່ງທັງໝົດ 3 ອໍເດີ')&&t.includes('ແຈ້ງເຄສ 2 ຄັ້ງ'),'customer track record');
ok(t.includes('ສົ່ງສຳເລັດ 2 ອໍເດີ')&&t.includes('ຮ້ານຜິດ 1 ຄັ້ງ'),'shop track record');
ok(!!(await p.$('a[href="tel:02055551234"]')),'one tap to call the shop');
await p.screenshot({path:path.join(__dirname,'out','case.png'),fullPage:true});await p.click('[data-x="cdecide"]');await p.waitForTimeout(100);
ok(await p.evaluate(()=>byId(ST.cases,'c1').status==='open'),'cannot decide without writing a reason');
await p.fill('[data-cnote="c1"]','ຮູບຕອນຮັບເປັນ M');await p.click('[data-x="cdecide"]');await p.waitForTimeout(150);
const c=await p.evaluate(()=>byId(ST.cases,'c1'));ok(c.status==='closed'&&c.decisionNote==='ຮູບຕອນຮັບເປັນ M'&&c.log.length===1,'decision saved with reason and log');
t=await p.textContent('main');ok(t.includes('ທີມຕັດສິນ')&&t.includes('ຮູບຕອນຮັບເປັນ M'),'decision appears in timeline and result box');
await p.click('[data-x="creopen"]');await p.waitForTimeout(150);
ok(await p.evaluate(()=>{const c=byId(ST.cases,'c1');return c.status==='open'&&c.log.length===2}),'reopen is logged too');
ok((await p.textContent('main')).includes('ເປີດເຄສຄືນ'),'reopen appears in timeline');
await p.evaluate(()=>{S.cid='zz';render()});ok((await p.textContent('main')).length>0,'missing case does not crash');
await p.evaluate(()=>{ST.cases.push({id:'c9',no:'RT-9',oid:'gone',reason:'wrong',status:'open',createdAt:Date.now()});S.cid='c9';render()});ok((await p.textContent('main')).includes('ຖືກລຶບແລ້ວ'),'case whose order was deleted still opens');

await b.close();console.log(fails?fails+' FAILED':'ALL PASSED');process.exit(fails?1:0)})();
