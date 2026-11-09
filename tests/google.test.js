// Sign in with Google (no SMS): Google first, then name + WhatsApp number once; account linking keeps the uid.
const { chromium } = require('playwright'); const path = require('path');
let fails = 0, outs = 0; const ok = (c, m) => { console.log((c ? 'PASS ' : 'FAIL ') + m); if (!c) fails++; };
(async () => {
  // 1) backend-core: Google is linked to the current (anonymous) account; an account already used elsewhere is switched to
  const { makeBackend } = await import('file://' + path.join(__dirname, '..', 'public', 'backend-core.js'));
  const mk = (linkErr) => {
    const calls = []; const anon = { uid: 'anon1', providerData: [] };
    const auth = { currentUser: anon };
    function GoogleAuthProvider() { this.setCustomParameters = () => {}; }
    GoogleAuthProvider.credentialFromError = () => ({ c: 1 });
    const fb = {
      initializeApp: () => ({}), getFirestore: () => ({}), getAuth: () => auth,
      onAuthStateChanged: (a, cb) => { setTimeout(() => cb(anon)); return () => {}; }, signInAnonymously: async () => {},
      doc: () => ({}), getDoc: async () => ({ exists: () => false }),
      GoogleAuthProvider,
      linkWithPopup: async (u) => { calls.push('link:' + u.uid); if (linkErr) { const e = new Error('x'); e.code = linkErr; throw e; } return { user: { uid: u.uid, email: 'noy@gmail.com', displayName: 'Noy', providerData: [{ providerId: 'google.com', email: 'noy@gmail.com', displayName: 'Noy' }] } }; },
      signInWithCredential: async () => { calls.push('cred'); return { user: { uid: 'g9', email: 'noy@gmail.com', displayName: 'Noy', providerData: [{ providerId: 'google.com' }] } }; },
      signInWithPopup: async () => { calls.push('popup'); },
      signOut: async () => { calls.push('out'); },
    };
    return { be: makeBackend(fb, { storageBucket: 'b' }), calls };
  };
  let t = mk(null); let a = await t.be.google();
  ok(a.uid === 'anon1' && a.email === 'noy@gmail.com' && a.name === 'Noy' && !a.switched && t.calls.join() === 'link:anon1', 'Google is linked to the same account (uid kept, orders and addresses stay)');
  t = mk('auth/credential-already-in-use'); a = await t.be.google();
  ok(a.uid === 'g9' && a.switched && t.calls.join() === 'link:anon1,cred', 'Google account used on another phone → switches to that account');
  t = mk('auth/operation-not-allowed'); let err = ''; try { await t.be.google(); } catch (e) { err = e.code; }
  ok(err === 'auth/operation-not-allowed', 'Google not enabled in Firebase → error reaches the page');

  // 2) the page
  const b = await chromium.launch(process.env.CHROME_PATH ? { executablePath: process.env.CHROME_PATH } : {});
  const p = await b.newPage({ viewport: { width: 430, height: 900 } });
  p.on('pageerror', e => { console.log('ERR', e.message); fails++; });
  await p.goto('file://' + path.join(__dirname, '..', 'public', 'index.html')); await p.waitForTimeout(300);
  await p.evaluate(() => { window.__mode = 'ok'; window.__out = 0;
    H.be = { google: async () => { if (window.__mode === 'off') { const e = new Error('x'); e.code = 'auth/operation-not-allowed'; throw e; } return { uid: 'anon1', email: 'noy@gmail.com', name: 'Noy Phommavong', google: true, switched: false }; }, signOut: async () => { window.__out++; } };
    S.tab = 'account'; render(); });
  await p.click('[data-x="login"]'); await p.waitForTimeout(80);
  let txt = await p.textContent('main');
  ok(!!(await p.$('[data-x="lggoogle"]')) && !(await p.$('[data-lg="phone"]')) && txt.includes('SMS'), 'login screen: “Sign in with Google” first, no phone/SMS box');
  await p.evaluate(() => { window.__mode = 'off'; }); await p.click('[data-x="lggoogle"]'); await p.waitForTimeout(80);
  ok((await p.textContent('main')).includes(await p.evaluate(() => T.gOff)), 'Google not switched on yet → clear message');
  await p.evaluate(() => { window.__mode = 'ok'; }); await p.click('[data-x="lggoogle"]'); await p.waitForTimeout(80);
  ok(await p.evaluate(() => S.lg.step === 'contact') && (await p.inputValue('[data-lg="name"]')) === 'Noy Phommavong' && (await p.textContent('main')).includes('noy@gmail.com'), 'after Google: one step with the name filled in and the Gmail shown');
  await p.click('[data-x="lgcontact"]'); await p.waitForTimeout(50);
  ok(await p.evaluate(() => !S.user), 'WhatsApp number is required');
  await p.fill('[data-lg="phone"]', '20 5555 1234'); await p.click('[data-x="lgcontact"]'); await p.waitForTimeout(80);
  ok(await p.evaluate(() => !!S.user && S.user.phone === '20 5555 1234' && S.user.email === 'noy@gmail.com' && S.user.name === 'Noy Phommavong'), 'signed in with name, WhatsApp number and Gmail');
  txt = await p.textContent('main');
  ok(txt.includes('noy@gmail.com') && txt.includes('20 5555 1234'), 'account page shows the WhatsApp number and Google account');
  // log out of a Google account: signs out, keeps the WhatsApp number in the profile for next time
  await p.exposeFunction('noteOut', () => { outs++; });
  await p.evaluate(() => { window.__saved = 0; window.saveProfile = () => { window.__saved++; }; H.be.signOut = async () => { await window.noteOut(); }; S.tab = 'account'; render(); });
  const saved0 = await p.evaluate(() => window.__saved);
  await Promise.all([p.waitForEvent('load'), p.click('[data-x="logout"]')]); await p.waitForTimeout(300);
  ok(outs === 1 && saved0 === 0 && await p.evaluate(() => !S.user), 'log out: Google signed out, page restarts fresh, profile number not wiped');
  await p.evaluate(() => { H.be = { google: async () => ({}), signOut: async () => {} }; });
  // phone way still reachable while testing
  await p.evaluate(() => { S.user = null; S.lg = { step: 'phone', phone: '', code: '', err: '' }; S.screen = 'login'; render(); });
  await p.click('[data-x="lgphoneway"]'); await p.waitForTimeout(50);
  ok(!!(await p.$('[data-lg="phone"]')), 'phone + test code still available behind a link');
  // without the Firebase backend (Claude version) the old phone screen shows
  await p.evaluate(() => { H.be = null; S.lg = { step: 'phone', phone: '', code: '', err: '' }; render(); });
  ok(!!(await p.$('[data-lg="phone"]')) && !(await p.$('[data-x="lggoogle"]')), 'Claude version (no Firebase): phone screen as before');
  await b.close(); console.log(fails ? fails + ' FAILED' : 'ALL PASSED'); process.exit(fails ? 1 : 0);
})();
