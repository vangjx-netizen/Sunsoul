// Checks firestore.rules against the real Firestore emulator.
// Run with:  npm run test:rules   (needs Java; starts the emulator, runs this file, stops it)
const fs = require('fs'); const path = require('path');
const { initializeTestEnvironment, assertSucceeds, assertFails } = require('@firebase/rules-unit-testing');
const { doc, getDoc, setDoc, updateDoc, deleteDoc, getDocs, collection, query, where, deleteField } = require('firebase/firestore');

let fails = 0, n = 0;
async function check(name, p, shouldPass) {
  n++;
  try { await (shouldPass ? assertSucceeds(p) : assertFails(p)); console.log('PASS ' + name); }
  catch (e) { fails++; console.log('FAIL ' + name + ' — ' + (e && e.message || e).split('\n')[0]); }
}
const allow = (name, p) => check(name, p, true);
const deny = (name, p) => check(name, p, false);

(async () => {
  const env = await initializeTestEnvironment({
    projectId: 'demo-sunsoul',
    firestore: { rules: fs.readFileSync(path.join(__dirname, '..', '..', 'firestore.rules'), 'utf8') },
  });
  const order = (o = {}) => ({ no: 'SS-1', uid: 'buyer', shopId: 's1', pid: 'p1', vlabel: 'M', qty: 1, price: 100000, status: 'await_shop', createdAt: 1, history: [], ...o });
  async function seed() {
    await env.clearFirestore();
    await env.withSecurityRulesDisabled(async c => {
      const d = c.firestore();
      await setDoc(doc(d, 'admins/team1'), { name: 'Vang' });
      await setDoc(doc(d, 'invites/ABCD2345'), { createdAt: 1, note: 'tester' });
      await setDoc(doc(d, 'invites/USED2345'), { createdAt: 1, claimedBy: 'someone', claimedAt: 2 });
      await setDoc(doc(d, 'orders/r1'), order({ status: 'delivered', deliveredAt: 5, receivedAt: 5, receivedBy: 'customer' }));
      await setDoc(doc(d, 'orders/r2'), order({ status: 'delivered', deliveredAt: 5 }));
      await setDoc(doc(d, 'teamEmails/boss@gmail.com'), { addedAt: 1 });
      await setDoc(doc(d, 'shops/s3'), { name: 'Mail shop', ownerEmail: 'owner@gmail.com' });
      await setDoc(doc(d, 'orders/o3'), { no: 'SS-3', uid: 'someone', shopId: 's3', pid: 'p1', vlabel: 'M', qty: 1, price: 1, status: 'await_shop', createdAt: 1, history: [] });
      await setDoc(doc(d, 'shops/s1'), { name: 'Kham', ownerUid: 'shopper', phoneE164: '+8562055557777' });
      await setDoc(doc(d, 'shops/s2'), { name: 'Other', ownerUid: 'other-shop' });
      await setDoc(doc(d, 'products/p1'), { name: 'Shirt', shopId: 's1' });
      await setDoc(doc(d, 'orders/o1'), order());
      await setDoc(doc(d, 'orders/o2'), order({ uid: 'someone', status: 'await_pay' }));
      await setDoc(doc(d, 'orderLock/o1'), { uid: 'buyer', shopId: 's1', total: 115000 });
      await setDoc(doc(d, 'cases/c1'), { uid: 'buyer', status: 'closed', owner: 'none' });
      await setDoc(doc(d, 'cases/c6'), { uid: 'buyer', shopId: 's1', status: 'closed', owner: 'store', remedy: 'refund', retNeeded: true, refund: 100000 });
      await setDoc(doc(d, 'cases/c5'), { uid: 'buyer', shopId: 's1', status: 'closed', owner: 'store', remedy: 'exchange', refund: 0 });
      await setDoc(doc(d, 'kyc/applicant'), { account: '0101' });
      await setDoc(doc(d, 'sellerDecision/applicant'), { status: 'approved' });
    });
  }
  const as = (uid, claims) => (uid ? env.authenticatedContext(uid, claims) : env.unauthenticatedContext()).firestore();
  const buyer = as('buyer'), stranger = as('stranger'), shop = as('shopper'), team = as('team1'), nobody = as(null);
  const shopByPhone = as('phone-user', { phone_number: '+8562055557777' });

  await seed();
  // catalogue
  await allow('anyone reads products', getDoc(doc(nobody, 'products/p1')));
  await deny('visitor cannot change a product', setDoc(doc(stranger, 'products/p1'), { name: 'x' }));
  await allow('team changes a product', setDoc(doc(team, 'products/p1'), { name: 'Shirt 2', shopId: 's1' }));
  await deny('visitor cannot read shop bank accounts', getDoc(doc(stranger, 'shopPrivate/s1')));
  await deny('nobody can make themselves team', setDoc(doc(stranger, 'admins/stranger'), {}));
  await allow('team member can check own admin entry', getDoc(doc(team, 'admins/team1')));

  // orders: who sees what
  await allow('buyer reads own order', getDoc(doc(buyer, 'orders/o1')));
  await deny('stranger cannot read someone’s order', getDoc(doc(stranger, 'orders/o1')));
  await allow('shop (ownerUid) reads its order', getDoc(doc(shop, 'orders/o1')));
  await allow('shop (verified phone) reads its order', getDoc(doc(shopByPhone, 'orders/o1')));
  // team and shop owners by Gmail (a Google sign-in carries a verified e-mail)
  const boss = as('any-device-uid', { email: 'boss@gmail.com', email_verified: true });
  const fakeBoss = as('other-uid', { email: 'boss@gmail.com', email_verified: false });
  const mailOwner = as('owner-device', { email: 'owner@gmail.com', email_verified: true });
  await allow('team by Gmail: reads any order, from any device', getDoc(doc(boss, 'orders/o2')));
  await deny('an unverified e-mail is not team', getDoc(doc(fakeBoss, 'orders/o2')));
  await allow('team by Gmail adds a team member', setDoc(doc(boss, 'teamEmails/new@gmail.com'), { addedAt: 2 }));
  await deny('non-team cannot add themselves to the team', setDoc(doc(mailOwner, 'teamEmails/owner@gmail.com'), { addedAt: 2 }));
  await allow('a person can check whether their own Gmail is on the team', getDoc(doc(mailOwner, 'teamEmails/owner@gmail.com')));
  await deny('…but not read someone else’s entry', getDoc(doc(mailOwner, 'teamEmails/boss@gmail.com')));
  await allow('shop owner by Gmail reads its order', getDoc(doc(mailOwner, 'orders/o3')));
  await deny('shop owner by Gmail cannot read another shop’s order', getDoc(doc(mailOwner, 'orders/o1')));
  await deny('another shop cannot read it', getDoc(doc(as('other-shop'), 'orders/o1')));
  await allow('buyer lists own orders', getDocs(query(collection(buyer, 'orders'), where('uid', '==', 'buyer'))));
  await deny('visitor cannot list all orders', getDocs(collection(stranger, 'orders')));
  await allow('shop lists its orders', getDocs(query(collection(shop, 'orders'), where('shopId', '==', 's1'))));
  await deny('shop cannot list another shop’s orders', getDocs(query(collection(shop, 'orders'), where('shopId', '==', 's2'))));
  await allow('team lists all orders', getDocs(collection(team, 'orders')));

  // orders: creating
  await allow('buyer places an order', setDoc(doc(buyer, 'orders/n1'), order({ uid: 'buyer' })));
  await deny('cannot place an order in someone else’s name', setDoc(doc(buyer, 'orders/n2'), order({ uid: 'someone' })));
  await deny('cannot place an order that is already paid', setDoc(doc(buyer, 'orders/n3'), order({ status: 'await_pickup' })));
  await deny('cannot place an order marked paid out', setDoc(doc(buyer, 'orders/n4'), order({ paidOutAt: 1 })));

  // orders: buyer changes
  await seed();
  await allow('buyer cancels before the shop answers', updateDoc(doc(buyer, 'orders/o1'), { status: 'cancelled', cancelWhy: 'customer' }));
  await seed();
  await deny('buyer cannot mark own order as paid', updateDoc(doc(buyer, 'orders/o1'), { status: 'await_pickup' }));
  await deny('buyer cannot change the price', updateDoc(doc(buyer, 'orders/o1'), { price: 1 }));
  await deny('buyer cannot move the order to another shop', updateDoc(doc(buyer, 'orders/o1'), { shopId: 's2' }));
  await deny('buyer cannot set payout fields', updateDoc(doc(buyer, 'orders/o1'), { paidOutAt: 1 }));
  await allow('buyer hides a finished order', updateDoc(doc(buyer, 'orders/o1'), { custHidden: true }));
  await env.withSecurityRulesDisabled(c => updateDoc(doc(c.firestore(), 'orders/o1'), { status: 'await_pay' }));
  await allow('buyer sends a slip', updateDoc(doc(buyer, 'orders/o1'), { status: 'await_verify', slipId: 'u:x', paidAt: 5 }));
  await deny('stranger cannot touch the order', updateDoc(doc(stranger, 'orders/o1'), { custSeen: true }));

  // orders: shop changes
  await seed();
  await allow('shop confirms it has stock', updateDoc(doc(shop, 'orders/o1'), { status: 'await_pay', shopAt: 9 }));
  await seed();
  await deny('shop cannot mark the order as paid', updateDoc(doc(shop, 'orders/o1'), { status: 'await_pickup' }));
  await deny('shop cannot edit the customer', updateDoc(doc(shop, 'orders/o1'), { cust: { name: 'x' } }));
  await deny('another shop cannot answer it', updateDoc(doc(as('other-shop'), 'orders/o1'), { status: 'declined' }));
  await deny('only the team deletes orders', deleteDoc(doc(buyer, 'orders/o1')));

  // stock mirror
  await seed();
  const pub = { pid: 'p1', vlabel: 'M', qty: 1, status: 'await_shop', createdAt: 1, shopId: 's1' };
  await allow('buyer writes the matching stock mirror', setDoc(doc(buyer, 'orderPub/o1'), pub));
  await deny('mirror must match the order (status)', setDoc(doc(buyer, 'orderPub/o1'), { ...pub, status: 'cancelled' }));
  await deny('mirror must match the order (qty)', setDoc(doc(buyer, 'orderPub/o1'), { ...pub, qty: 50 }));
  await deny('mirror cannot carry personal data', setDoc(doc(buyer, 'orderPub/o1'), { ...pub, cust: { phone: '1' } }));
  await deny('stranger cannot write a mirror for someone’s order', setDoc(doc(stranger, 'orderPub/o1'), pub));
  await deny('no mirror for an order that does not exist', setDoc(doc(buyer, 'orderPub/zz'), pub));
  await allow('anyone reads the stock mirror', getDocs(collection(nobody, 'orderPub')));

  // money
  await allow('buyer reads the amount of own order', getDoc(doc(buyer, 'orderLock/o1')));
  await allow('buyer lists own amounts', getDocs(query(collection(buyer, 'orderLock'), where('uid', '==', 'buyer'))));
  await deny('stranger cannot read it', getDoc(doc(stranger, 'orderLock/o1')));
  await deny('buyer cannot change the amount', setDoc(doc(buyer, 'orderLock/o1'), { uid: 'buyer', total: 1 }));
  await deny('shop cannot change the amount', setDoc(doc(shop, 'orderLock/o1'), { uid: 'buyer', total: 1 }));
  await allow('team sets the amount', setDoc(doc(team, 'orderLock/o1'), { uid: 'buyer', shopId: 's1', total: 115000, verifiedAt: 1 }));

  // cases
  await allow('buyer opens a case', setDoc(doc(buyer, 'cases/c9'), { uid: 'buyer', status: 'open', reason: 'damaged' }));
  await allow('buyer notes the video was sent on WhatsApp', updateDoc(doc(buyer, 'cases/c9'), { vidSentAt: 5 }));
  await deny('…but cannot decide the case on the way', updateDoc(doc(buyer, 'cases/c9'), { vidSentAt: 6, owner: 'us' }));
  await deny('buyer cannot set the remedy when opening a case', setDoc(doc(buyer, 'cases/c7'), { uid: 'buyer', status: 'open', reason: 'wrong', want: 'exchange', remedy: 'exchange' }));
  await allow('shop reads a case about its order', getDoc(doc(shop, 'cases/c5')));
  await allow('shop lists the cases of its shop', getDocs(query(collection(shop, 'cases'), where('shopId', '==', 's1'))));
  await deny('another shop cannot read it', getDoc(doc(as('other-shop'), 'cases/c5')));
  await allow('shop says the replacement is ready', updateDoc(doc(shop, 'cases/c5'), { shopReadyAt: 9 }));
  await allow('shop marks the decision as read', updateDoc(doc(shop, 'cases/c5'), { shopSeenAt: 9 }));
  await allow('shop notes it contacted the team', updateDoc(doc(shop, 'cases/c5'), { shopAskAt: 9 }));
  await deny('shop cannot change the decision', updateDoc(doc(shop, 'cases/c5'), { owner: 'us' }));
  await deny('shop cannot mark the exchange as done', updateDoc(doc(shop, 'cases/c5'), { exDoneAt: 9 }));
  await allow('buyer gives the return tracking number', updateDoc(doc(buyer, 'cases/c6'), { retSentAt: 1, retCarrier: 'Anousith', retNo: 'AN1' }));
  await deny('buyer cannot mark the item as received', updateDoc(doc(buyer, 'cases/c6'), { retGotAt: 1 }));
  await deny('buyer cannot change the refund amount', updateDoc(doc(buyer, 'cases/c6'), { retNo: 'AN2', refund: 999999 }));
  await deny('no tracking number where no return is needed', updateDoc(doc(buyer, 'cases/c1'), { retSentAt: 1, retCarrier: 'x', retNo: 'y' }));
  await allow('team opens a case when the customer refuses at the door', setDoc(doc(team, 'cases/cd'), { uid: 'buyer', shopId: 's1', status: 'open', reason: 'wrong', atDoor: true }));
  await allow('buyer attaches own refund account', updateDoc(doc(buyer, 'cases/cd'), { kycId: 'buyer', acctAt: 1 }));
  await deny('buyer cannot point the refund at someone else’s account', updateDoc(doc(buyer, 'cases/cd'), { kycId: 'applicant', acctAt: 2 }));
  await deny('stranger cannot open a case for the buyer', setDoc(doc(stranger, 'cases/cx'), { uid: 'buyer', status: 'open', reason: 'wrong' }));
  await allow('buyer takes back own “received” (back to shipping)', updateDoc(doc(buyer, 'orders/r1'), { status: 'shipping', receivedAt: deleteField(), receivedBy: deleteField(), deliveredAt: deleteField() }));
  await deny('buyer cannot undo a delivery the team marked', updateDoc(doc(buyer, 'orders/r2'), { status: 'shipping', deliveredAt: deleteField() }));
  await allow('shop agrees to pack and ship itself', updateDoc(doc(shop, 'orders/o1'), { selfShip: true }));
  await deny('buyer cannot switch who ships the order', updateDoc(doc(buyer, 'orders/o1'), { selfShip: false }));
  // test-mode invite links
  await allow('a visitor looks up an invite code', getDoc(doc(stranger, 'invites/ABCD2345')));
  await deny('…but cannot list all invite codes', getDocs(collection(stranger, 'invites')));
  await deny('cannot claim an invite for someone else', updateDoc(doc(stranger, 'invites/ABCD2345'), { claimedBy: 'buyer', claimedAt: 3 }));
  await deny('cannot change the invite note while claiming', updateDoc(doc(stranger, 'invites/ABCD2345'), { claimedBy: 'stranger', claimedAt: 3, note: 'x' }));
  await allow('a visitor claims an unused invite for themselves', updateDoc(doc(stranger, 'invites/ABCD2345'), { claimedBy: 'stranger', claimedAt: 3 }));
  await deny('nobody can claim it a second time', updateDoc(doc(buyer, 'invites/ABCD2345'), { claimedBy: 'buyer', claimedAt: 4 }));
  await deny('a used invite cannot be taken over', updateDoc(doc(stranger, 'invites/USED2345'), { claimedBy: 'stranger', claimedAt: 4 }));
  await deny('visitors cannot make invites', setDoc(doc(stranger, 'invites/MINE2345'), { createdAt: 5 }));
  await allow('the team makes invites', setDoc(doc(team, 'invites/TEAM2345'), { createdAt: 5 }));
  await deny('visitors cannot switch test mode', setDoc(doc(stranger, 'settings/site'), { private: false }));
  await allow('a visitor who claimed an invite marks this device as a tester', setDoc(doc(stranger, 'testers/stranger'), { code: 'ABCD2345', at: 1 }));
  await deny('cannot mark someone else as a tester', setDoc(doc(stranger, 'testers/buyer'), { code: 'ABCD2345', at: 1 }));
  await deny('cannot claim to be a tester with an invite one did not use', setDoc(doc(buyer, 'testers/buyer'), { code: 'ABCD2345', at: 1 }));
  await deny('buyer cannot decide own case', setDoc(doc(buyer, 'cases/c8'), { uid: 'buyer', status: 'open', owner: 'us', refund: 999 }));
  await deny('stranger cannot read the case', getDoc(doc(stranger, 'cases/c1')));
  await deny('buyer cannot mark the refund as paid', updateDoc(doc(buyer, 'cases/c1'), { refundedAt: 1 }));
  await allow('buyer appeals once', updateDoc(doc(buyer, 'cases/c1'), { status: 'open', appeal: { note: 'x', at: 1 }, log: [] }));
  await env.withSecurityRulesDisabled(c => updateDoc(doc(c.firestore(), 'cases/c1'), { status: 'closed' }));
  await deny('buyer cannot appeal twice', updateDoc(doc(buyer, 'cases/c1'), { status: 'open', appeal: { note: 'again', at: 2 }, log: [] }));

  // selling
  await allow('applicant writes own application', setDoc(doc(as('applicant'), 'sellerApps/applicant'), { name: 'Kham' }));
  await deny('cannot write someone else’s application', setDoc(doc(stranger, 'sellerApps/applicant'), { name: 'x' }));
  await deny('visitor cannot list applications', getDocs(collection(stranger, 'sellerApps')));
  await allow('team lists applications', getDocs(collection(team, 'sellerApps')));
  await deny('stranger cannot read someone’s bank account', getDoc(doc(stranger, 'kyc/applicant')));
  await allow('team reads it', getDoc(doc(team, 'kyc/applicant')));
  await allow('applicant reads own decision', getDoc(doc(as('applicant'), 'sellerDecision/applicant')));
  await deny('applicant cannot approve themselves', setDoc(doc(as('applicant'), 'sellerDecision/applicant'), { status: 'approved' }));
  await allow('shop lists a product for its own shop', setDoc(doc(shop, 'shopProducts/sp1'), { shopId: 's1', name: 'x', status: 'live' }));
  await deny('cannot list a product for another shop', setDoc(doc(shop, 'shopProducts/sp2'), { shopId: 's2', name: 'x' }));
  await allow('shop marks own product sold out', setDoc(doc(shop, 'shopOff/p1'), { off: true, shopId: 's1' }));
  await deny('cannot mark another shop’s product sold out', setDoc(doc(as('other-shop'), 'shopOff/p1'), { off: true, shopId: 's2' }));

  // photos and profiles
  await allow('anyone signed in uploads a slip photo', setDoc(doc(buyer, 'upimgs/u1'), { data: 'data:image/jpeg;base64,xx' }));
  await allow('a photo can be opened by its id', getDoc(doc(stranger, 'upimgs/u1')));
  await deny('photos cannot be listed', getDocs(collection(stranger, 'upimgs')));
  await deny('oversized photo rejected', setDoc(doc(buyer, 'upimgs/u2'), { data: 'x'.repeat(700000) }));
  await allow('own profile', setDoc(doc(buyer, 'data/users/buyer/profile'), { addrs: [] }));
  await deny('someone else’s profile', getDoc(doc(stranger, 'data/users/buyer/profile')));
  await deny('signed-out visitor cannot write anything', setDoc(doc(nobody, 'orders/x'), order({ uid: 'x' })));

  await env.cleanup();
  console.log(`\n${n - fails}/${n} rule checks passed`);
  process.exit(fails ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
