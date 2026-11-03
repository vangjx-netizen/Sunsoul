const { chromium } = require('playwright');const path=require('path');let fails=0;const ok=(c,m)=>{console.log((c?'PASS ':'FAIL ')+m);if(!c)fails++};
(async()=>{const b=await chromium.launch(process.env.CHROME_PATH?{executablePath:process.env.CHROME_PATH}:{});const p=await b.newPage({viewport:{width:430,height:900}});
p.on('pageerror',e=>{console.log('ERR',e.message);fails++});
await p.goto('file://'+path.join(__dirname,'..','public','index.html'));await p.waitForTimeout(300);
await p.evaluate(()=>{S.canAdmin=true;S.user={phone:'2098798512',name:'Noy'};ST.shops.push({id:'s1',name:'tt',phone:'020 5555 1234'});
const base={pid:'p1',pname:'ເສື້ອໄໝ',vlabel:'L',qty:1,price:100000,fee:15000,cat:'clothes',shopId:'s1',shopName:'tt',acct:'2098798512',cust:{name:'Noy',phone:'2098798512'},addr:'x',kind:'local'};
ST.locks.A={price:100000,qty:1,fee:15000,total:115000,pay:'qr'};
ST.orders.push({...base,id:'A',no:'SS-A',status:'await_verify',slipId:'u:s1',paidAt:Date.now(),createdAt:Date.now()-3600e3,history:[]});
S.tab='team';S.sub='verify';render()});
await p.click('[data-x="vbad"]');await p.waitForTimeout(80);
ok(!!(await p.$('[data-xc="vrr"]')),'reject opens a reason picker instead of rejecting at once');
await p.click('[data-x="vbadgo"]');await p.waitForTimeout(80);
ok(await p.evaluate(()=>byId(ST.orders,'A').status==='await_verify'),'cannot reject without a reason');
await p.check('[data-xc="vrr"][data-k="short"]');await p.waitForTimeout(50);
await p.fill('[data-vamt]','100000');await p.fill('[data-vnote]','ຂາດອີກ 15,000');
await p.click('[data-x="vbadgo"]');await p.waitForTimeout(150);
let o=await p.evaluate(()=>({o:byId(ST.orders,'A'),l:ST.locks.A}));
ok(o.o.status==='await_pay'&&o.o.slipRejected&&o.o.slipWhy.r==='short','order goes back to payment with the reason');
ok(o.l.got===100000&&o.l.slips.length===1&&o.l.slips[0].id==='u:s1','received 100,000 is recorded in the locked record with the old slip');
ok(o.o.payDeadline-Date.now()>23*3600e3,'customer gets 24 hours to fix, not 30 minutes');
// the sweeper never cancels it
await p.evaluate(async()=>{byId(ST.orders,'A').payDeadline=Date.now()-1000;S.ready=true;await sweep();render();});
ok(await p.evaluate(()=>byId(ST.orders,'A').status==='await_pay'),'expired fix window does not auto-cancel (money stays tracked)');
let t=await p.textContent('main');ok(t.includes('ລໍລູກຄ້າແກ້ສະລິບ')&&t.includes('ເກີນເວລາ'),'team sees it in the follow-up list');
// customer
await p.evaluate(()=>{byId(ST.orders,'A').payDeadline=Date.now()+3600e3;S.tab='home';S.screen='home';render()});
t=await p.textContent('main');ok(t.includes('ສະລິບມີບັນຫາ'),'home shows a red slip-problem banner');
ok((await p.textContent('.nav [data-tab="orders"] .nbadge'))==='1','orders tab badge');
await p.evaluate(()=>{S.tab='orders';S.oid='A';render()});t=await p.textContent('main');
ok(t.includes('ໂອນມາບໍ່ຄົບຈຳນວນ')&&t.includes('ຂາດອີກ 15,000'),'customer sees the reason and team message');
ok(t.includes('115,000')&&t.includes('100,000')&&t.includes('ໂອນເພີ່ມສະເພາະສ່ວນທີ່ຍັງຂາດ'),'customer sees full / received / remaining');
const big=await p.$eval('.qrbox + .sub2 + div',e=>e.textContent);ok(big.includes('15,000'),'amount to pay is only the 15,000 remaining: '+big.trim());
ok(!(await p.$('[data-x="custcx"]'))&&!t.includes('ຍົກເລີກອໍເດີ'),'customer cannot self-cancel once money was received');
// customer sends the extra slip; team sees earlier payment and approves
await p.evaluate(async()=>{await setOrder(byId(ST.orders,'A'),{status:'await_verify',slipId:'u:s2',slipRejected:false,paidAt:Date.now()},'customer');S.tab='team';S.sub='verify';S.vrej=null;render()});
t=await p.textContent('main');ok(t.includes('ໄດ້ຮັບກ່ອນໜ້າ')&&t.includes('ສະລິບນີ້ຕ້ອງເປັນ')&&t.includes('15,000'),'team sees earlier 100,000 and expects 15,000 now');
ok(t.includes('ສະລິບເກົ່າ'),'team sees the earlier slip');

await p.evaluate(async()=>{await vApprove('A')});o=await p.evaluate(()=>({o:byId(ST.orders,'A'),l:ST.locks.A}));
ok(o.o.status==='await_pickup'&&o.l.got===115000&&o.l.slips.length===2,'approved: fully paid, both slips on record');
// team cancels an order with partial money -> refund
await p.evaluate(()=>{ST.locks.B={price:100000,qty:1,fee:15000,total:115000,got:50000};ST.orders.push({pid:'p1',pname:'x',vlabel:'L',qty:1,shopId:'s1',shopName:'tt',acct:'2098798512',cust:{name:'Noy',phone:'2098798512'},id:'B',no:'SS-B',status:'await_pay',slipRejected:true,slipWhy:{r:'short'},payDeadline:Date.now()-1,createdAt:Date.now(),history:[]});render()});
await p.click('[data-x="owcx"][data-id="B"]');await p.waitForTimeout(50);await p.click('[data-x="owcx"][data-id="B"]');await p.waitForTimeout(150);
ok(await p.evaluate(()=>byId(ST.orders,'B').cancelWhy==='refund'),'team cancel with money received = refund');
ok((await p.textContent('main')).includes('ຕ້ອງຄືນເງິນລູກຄ້າ 50,000'),'team gets a refund-to-do');
await p.evaluate(()=>{S.tab='orders';S.oid='B';render()});ok((await p.textContent('main')).includes('ທີມຈະໂອນເງິນ 50,000'),'customer is told the 50,000 will be returned');
await p.evaluate(()=>{S.tab='team';S.sub='verify';render()});await p.click('[data-x="owdone"]');await p.waitForTimeout(150);
await p.evaluate(()=>{S.tab='orders';S.oid='B';render()});ok((await p.textContent('main')).includes('ໂອນຄືນ 50,000 ກີບ ແລ້ວ'),'customer sees refund done');
// ---- return refused ----
await p.evaluate(()=>{const t0=Date.now()-9*86400e3;ST.orders.push({pid:'p1',pname:'ເສື້ອ',vlabel:'L',qty:1,price:100000,shopId:'s1',shopName:'tt',acct:'2098798512',cust:{name:'Noy',phone:'2098798512'},id:'C',no:'SS-C',status:'delivered',deliveredAt:t0,receivedAt:t0,createdAt:t0,history:[]});
ST.cases.push({id:'k1',no:'RT-1',oid:'C',reason:'size',status:'open',owner:'',createdAt:Date.now()});S.tab='team';S.sub='cases';S.cid='k1';render()});
await p.check('[data-xc="cowner"][data-k="none"]');await p.waitForTimeout(80);
ok(!!(await p.$('[data-xc="cnowhy"]')),'choosing "no return" shows refusal reasons');
await p.fill('[data-cnote="k1"]','ທ່ານແຈ້ງຫຼັງ 9 ມື້');await p.click('[data-x="cdecide"]');await p.waitForTimeout(100);
ok(await p.evaluate(()=>byId(ST.cases,'k1').status==='open'),'cannot refuse without picking a reason');
await p.check('[data-xc="cnowhy"][data-k="late"]');await p.click('[data-x="cdecide"]');await p.waitForTimeout(150);
ok(await p.evaluate(()=>{const c=byId(ST.cases,'k1');return c.status==='closed'&&c.noWhy==='late'}),'refusal saved with reason');
await p.evaluate(()=>{S.tab='home';S.screen='home';render()});t=await p.textContent('main');
ok(t.includes('ເຄສຄືນສິນຄ້າ ຕັດສິນແລ້ວ'),'customer home shows decision banner');
await p.click('[data-x="casego"]');await p.waitForTimeout(150);t=await p.textContent('main');
ok(t.includes('ບໍ່ຮັບຄືນສິນຄ້າ')&&t.includes('ແຈ້ງເກີນກຳນົດ 3 ມື້')&&t.includes('ທ່ານແຈ້ງຫຼັງ 9 ມື້')&&t.includes('ສິນຄ້າຢູ່ກັບທ່ານ'),'customer sees decision, reason, team message, next step');
await p.screenshot({path:path.join(__dirname,'out','refuse.png'),fullPage:true});
ok(await p.evaluate(()=>byId(ST.cases,'k1').custSeenAt>0),'opening marks it seen');
await p.click('[data-x="appeal"]');await p.waitForTimeout(50);await p.fill('[data-apnote="k1"]','ໄດ້ຮັບວັນທີ 30');await p.click('[data-x="appealgo"]');await p.waitForTimeout(150);
ok(await p.evaluate(()=>{const c=byId(ST.cases,'k1');return c.status==='open'&&c.appeal.note==='ໄດ້ຮັບວັນທີ 30'}),'customer appeal reopens the case');
await p.evaluate(()=>{S.tab='team';S.sub='cases';S.cid='k1';render()});t=await p.textContent('main');
ok(t.includes('ລູກຄ້າຂໍໃຫ້ກວດຄືນ')&&t.includes('ໄດ້ຮັບວັນທີ 30'),'team sees the appeal');
await b.close();console.log(fails?fails+' FAILED':'ALL PASSED');process.exit(fails?1:0)})();
