// Fake db kept on the Node side so it survives reloads; browser storage is wiped between visits.
const { chromium } = require('playwright');const path=require('path');
const store={};let fails=0;const ok=(c,m)=>{console.log((c?'PASS ':'FAIL ')+m);if(!c)fails++};
(async()=>{const b=await chromium.launch(process.env.CHROME_PATH?{executablePath:process.env.CHROME_PATH}:{});const ctx=await b.newContext();
await ctx.exposeFunction('dbGet',k=>store[k]===undefined?null:JSON.stringify(store[k]));
await ctx.exposeFunction('dbSet',(k,v)=>{store[k]=JSON.parse(v);return true});
await ctx.addInitScript(()=>{
 const ref=k=>({get:async()=>{const v=await window.dbGet(k);return{exists:v!==null,data:()=>JSON.parse(v)}},set:async d=>{await window.dbSet(k,JSON.stringify(d))},delete:async()=>{},onSnapshot:(cb)=>{cb({exists:false,data:()=>null});return()=>{}}});
 const col=c=>({doc:id=>ref(c+"/"+id),onSnapshot:(cb)=>{cb({docs:[]});return()=>{}}});
 const db={collection:col,doc:p=>ref(p)};
 window.claude={use:async n=>n==='db'?db:n==='user'?{canEdit:async()=>false,id:async()=>'u_customer1'}:null};
});
const visit=async()=>{const p=await ctx.newPage();p.on('pageerror',e=>{console.log('ERR',e.message);fails++});await p.goto('file://'+path.join(__dirname,'..','public','index.html'));await p.waitForTimeout(500);return p};
// visit 1: log in once with OTP, place an order
let p=await visit();
ok(await p.evaluate(()=>!S.user),'first visit: not logged in');
await p.evaluate(()=>{ST.shops.push({id:'s1',name:'Shop A',map:'17.9700,102.6100'});ST.tp.push({id:'p1',name:'Bag',shopId:'s1',shopName:'Shop A',variants:[{label:'—',price:100000,stock:9}],imgs:[],active:true,createdAt:1,stockAt:1});mergeP();S.pid='p1';S.vi=0;S.screen='product';render()});
await p.click('[data-act="order"]');await p.waitForTimeout(100);
await p.fill('[data-lg="phone"]','20 5555 1234');await p.click('[data-x="lgsend"]');await p.fill('[data-lg="code"]','123456');await p.click('[data-x="lgok"]');await p.waitForTimeout(100);
ok(await p.evaluate(()=>S.lg.step==='name'),'first sign-in asks the name once');
await p.fill('[data-lg="name"]','ນ້ອຍ');await p.click('[data-x="lgname"]');await p.waitForTimeout(100);
ok(await p.evaluate(()=>S.screen==='checkout'&&S.user.phone==='20 5555 1234'&&S.user.name==='ນ້ອຍ'),'OTP once → straight to checkout');
await p.fill('[data-co="name"]','Vang');await p.evaluate(()=>{S.co.addr='ບ້ານ ໂພນທັນ, ນະຄອນຫຼວງ';S.co.map='17.9757, 102.6331';rr()});
await p.click('[data-x="place"]');await p.waitForTimeout(300);
ok(!!store['data/users/u_customer1/profile']&&store['data/users/u_customer1/profile'].addrs.length===1,'profile with phone + address saved in the private db space');
await p.evaluate(()=>localStorage.clear());await p.close();
// visit 2: browser storage wiped → still logged in, address pre-filled, no OTP
p=await visit();
ok(await p.evaluate(()=>!!S.user&&S.user.phone==='20 5555 1234'),'second visit with wiped storage: still logged in');
await p.evaluate(()=>{ST.shops.push({id:'s1',name:'Shop A',map:'17.9700,102.6100'});ST.tp.push({id:'p1',name:'Bag',shopId:'s1',shopName:'Shop A',variants:[{label:'—',price:100000,stock:9}],imgs:[],active:true,createdAt:1,stockAt:1});mergeP();S.pid='p1';S.vi=0;S.screen='product';render()});
await p.click('[data-act="order"]');await p.waitForTimeout(150);
const co=await p.evaluate(()=>({scr:S.screen,...S.co}));
ok(co.scr==='checkout'&&co.name==='Vang'&&co.addr.includes('ໂພນທັນ')&&co.map.includes('17.9757'),'"order now" opens checkout already filled (name, address, location)');
const sum=await p.textContent('#cosum');console.log('COSUM:',sum.replace(/\s+/g,' '));ok(sum.includes('15,000'),'fee already calculated from the saved location');
await p.screenshot({path:path.join(__dirname,'out','checkout-saved.png')});
// a second address, then the account page lists both and can remove one
await p.fill('[data-co="name"]','Mom');await p.fill('[data-co="phone"]','020 2222 3333');await p.evaluate(()=>{S.co.addr='ບ້ານ ສີສັງວອນ, ນະຄອນຫຼວງ';S.co.map='17.99000, 102.63000';rr()});
await p.click('[data-x="place"]');await p.waitForTimeout(300);
ok(store['data/users/u_customer1/profile'].addrs.length===2,'sending to someone else adds a second saved address');
await p.evaluate(()=>{S.tab='account';render()});
ok((await p.textContent('main')).includes('Mom')&&(await p.$$('[data-x="rmaddr"]')).length===2,'account page lists both addresses');
await p.click('[data-x="logout"]');await p.waitForTimeout(200);
ok(store['data/users/u_customer1/profile'].phone===''&&store['data/users/u_customer1/profile'].addrs.length===2,'log out forgets the login but keeps the addresses');
await b.close();console.log(fails?fails+' FAILED':'ALL PASSED');process.exit(fails?1:0)})();
