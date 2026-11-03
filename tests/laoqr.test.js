const { chromium } = require('playwright');const path=require('path');let fails=0;const ok=(c,m)=>{console.log((c?'PASS ':'FAIL ')+m);if(!c)fails++};
const REAL='00020101021138680016A00526628466257701087003041802030010325LRV24026JJPMJALKCAGT76P7M5204482953034185802LA6009Vientiane6304669D';
(async()=>{const b=await chromium.launch(process.env.CHROME_PATH?{executablePath:process.env.CHROME_PATH}:{});const p=await b.newPage({viewport:{width:430,height:900}});
p.on('pageerror',e=>{console.log('ERR',e.message);fails++});
await p.route('https://cdn.jsdelivr.net/npm/jsqr@1.4.0/dist/jsQR.min.js',r=>r.fulfill({path:require.resolve('jsqr/dist/jsQR.js'),contentType:'application/javascript'}));
await p.goto('file://'+path.join(__dirname,'..','public','index.html'));await p.waitForTimeout(300);
ok(await p.evaluate(R=>qrCheck(R)===R,REAL),'the real QR passes the checksum');
ok(await p.evaluate(R=>qrCheck(R.slice(0,-1)+'E')==="",REAL),'a damaged QR is rejected');
await p.evaluate(()=>{S.canAdmin=true;S.tab='team';S.sub='fees';render()});
ok((await p.textContent('main')).includes('ຍັງບໍ່ໄດ້ຕັ້ງ'),'fees page shows the account section, not set yet');
const [fc]=await Promise.all([p.waitForEvent('filechooser'),p.click('[data-x="payqrup"]')]);await fc.setFiles(path.join(__dirname,'fixtures','laoqr.png'));await p.waitForTimeout(1500);
ok(await p.evaluate(()=>S.payDraft&&S.payDraft.payload)===REAL,'uploading the QR image reads the exact payload');
await p.fill('[data-payf="name"]','SUNSOUL TEST');await p.fill('[data-payf="acct"]','0302000410012345');await p.fill('[data-payf="bank"]','BCEL');
await p.click('[data-x="paysave"]');await p.waitForTimeout(200);
ok(await p.evaluate(R=>ST.pay&&ST.pay.payload===R&&ST.pay.name==='SUNSOUL TEST',REAL),'account saved');
// customer pays
await p.evaluate(()=>{S.user={phone:'2098798512',name:'Noy'};ST.locks.A={price:100000,qty:1,fee:15000,total:115000,pay:'qr'};
 ST.orders.push({id:'A',no:'SS-A',pid:'p1',pname:'x',vlabel:'L',qty:1,price:100000,shopId:'s1',shopName:'tt',status:'await_pay',acct:'2098798512',cust:{name:'Noy',phone:'2098798512'},createdAt:Date.now(),payDeadline:Date.now()+1800e3,history:[]});
 S.tab='orders';S.oid='A';render()});
await p.addScriptTag({path:require.resolve('jsqr/dist/jsQR.js')});
const dec=async()=>p.evaluate(async()=>{const im=document.querySelector('.qrbox img');await im.decode();const c=document.createElement('canvas');c.width=im.naturalWidth;c.height=im.naturalHeight;const g=c.getContext('2d');g.drawImage(im,0,0);const r=jsQR(g.getImageData(0,0,c.width,c.height).data,c.width,c.height);return r&&r.data});
let d=await dec();console.log('   amount QR:',d);
ok(!!d&&d.includes('5406115000')&&d.includes('010212')&&qrCheckN(d),'customer QR scans to the account with amount 115,000 and valid CRC');
function qrCheckN(s){let c=0xFFFF;for(const ch of Buffer.from(s.slice(0,-4))){c^=ch<<8;for(let k=0;k<8;k++)c=c&0x8000?((c<<1)^0x1021)&0xFFFF:(c<<1)&0xFFFF}return c.toString(16).toUpperCase().padStart(4,'0')===s.slice(-4)}
ok(d&&d.includes('LRV24026JJPMJALKCAGT76P7M'),'same receiving account as the original QR');
let t=await p.textContent('main');ok(t.includes('SUNSOUL TEST')&&t.includes('0302000410012345')&&!t.includes('QR ທົດສອບ'),'account name / number shown, no test label');
await p.click('[data-x="qrplain"]');await p.waitForTimeout(100);d=await dec();
ok(d===REAL,'fallback button shows the original QR exactly');ok((await p.textContent('main')).includes('ພິມຍອດ 115,000'),'fallback tells the customer the amount to type');
// partial payment: QR carries only the remainder
await p.click('[data-x="qrplain"]');await p.evaluate(()=>{ST.locks.A.got=100000;byId(ST.orders,'A').slipRejected=true;byId(ST.orders,'A').slipWhy={r:'short'};render()});
d=await dec();ok(d&&d.includes('540515000'),'after a short payment, QR asks only for 15,000');
await p.screenshot({path:path.join(__dirname,'out','pay.png'),fullPage:true});
await b.close();console.log(fails?fails+' FAILED':'ALL PASSED');process.exit(fails?1:0)})();
