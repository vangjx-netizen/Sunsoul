// Sunsoul backend adapter for Firebase.
//
// The page (index.html) was written against the Claude Artifact runtime:
//   claude.use("db")     → { collection(path).onSnapshot/doc(id), doc(path).get/set/update/delete/onSnapshot }
//   claude.use("assets") → { upload(blob,{type}) → {id,url}, list() → {assets:[{id,url}]} }
//   claude.use("user")   → { id(), canEdit(), isOwner() }
// This file offers the same shapes on top of Firebase, so the page itself does not change.
//
// makeBackend() receives the Firebase functions as `fb` instead of importing them, so it can be
// tested with a fake (tests/backend.test.js) and loaded with the real SDK by backend-firebase.js.

const snapOfDoc = s => ({ id: s.id, exists: s.exists(), data: () => s.data() });
const snapOfColl = s => ({ docs: s.docs.map(d => ({ id: d.id, data: () => d.data() })) });

export function makeBackend(fb, config) {
  const app = fb.initializeApp(config);
  const fs = fb.getFirestore(app);
  const auth = fb.getAuth(app);
  // Storage needs the paid (Blaze) plan on new projects; until config.useStorage is set, photos go to Firestore.
  const storage = config.useStorage && fb.getStorage ? fb.getStorage(app) : null;
  if (fb.useEmulators) fb.useEmulators(fs, auth, storage);   // local testing only

  // Every visitor gets an account (anonymous at first). Phone sign-in later links to the same account,
  // so the uid, profile and orders stay with the person.
  const ready = new Promise((resolve, reject) => {
    const stop = fb.onAuthStateChanged(auth, u => {
      if (u) { stop(); resolve(u); return; }
      fb.signInAnonymously(auth).catch(reject);
    });
  });

  const docApi = path => {
    const ref = fb.doc(fs, path);
    return {
      get: async () => snapOfDoc(await fb.getDoc(ref)),
      set: data => fb.setDoc(ref, data),
      update: data => fb.updateDoc(ref, data),
      delete: () => fb.deleteDoc(ref),
      onSnapshot: (cb, err) => fb.onSnapshot(ref, s => cb(snapOfDoc(s)), err),
    };
  };
  // where() narrows what is loaded: on Firebase each person reads only what the rules let them see
  const collApi = (path, filters = []) => ({
    doc: id => docApi(path + "/" + id),
    where: (field, op, value) => collApi(path, [...filters, [field, op, value]]),
    onSnapshot: (cb, err) => {
      const base = fb.collection(fs, path);
      const q = filters.length ? fb.query(base, ...filters.map(f => fb.where(...f))) : base;
      return fb.onSnapshot(q, s => cb(snapOfColl(s)), err);
    },
  });
  const db = { collection: collApi, doc: docApi };

  // the e-mail of a Google sign-in (always verified by Google), lower-case; "" for anonymous visitors
  const verifiedEmail = u => (u && u.emailVerified && u.email ? String(u.email).toLowerCase() : "");
  // Team members are listed in admins/{uid} or, by Gmail, in teamEmails/{email}; the security rules use the same lists.
  // remembered per account + e-mail: linking Google adds an e-mail, so the answer is asked again
  let adminP = null, adminKey = "";
  const isAdmin = () => {
    const cu = auth.currentUser, key = cu ? cu.uid + "|" + verifiedEmail(cu) : "";
    if (adminP && key === adminKey) return adminP;
    adminKey = key;
    return adminP = ready.then(async u => {
    try { if ((await fb.getDoc(fb.doc(fs, "admins/" + u.uid))).exists()) return true; } catch (e) { /* not by uid */ }
    const em = verifiedEmail(auth.currentUser || u);
    if (!em) return false;
    // the rules read the e-mail from the sign-in token; right after linking Google it may be missing until refreshed
    try { await (auth.currentUser || u).getIdToken(true); } catch (e) { /* offline: try with the token we have */ }
    try { return (await fb.getDoc(fb.doc(fs, "teamEmails/" + em))).exists(); } catch (e) { return false; }
  });
  };
  const user = {
    id: async () => (await ready).uid,
    email: async () => verifiedEmail(auth.currentUser || await ready),
    canEdit: () => isAdmin(),
    isOwner: () => isAdmin(),
  };

  // Images live in Storage at assets/<id>; the page refers to them by id, like on Claude.
  const bucket = config.storageBucket;
  const blobUrl = id => `https://firebasestorage.googleapis.com/v0/b/${bucket}/o/assets%2F${encodeURIComponent(id)}?alt=media`;
  const newId = () => Array.from(crypto.getRandomValues(new Uint8Array(16)), b => b.toString(16).padStart(2, "0")).join("");
  const assets = storage && {
    upload: async (blob, opts) => {
      const id = newId();
      await fb.uploadBytes(fb.ref(storage, "assets/" + id), blob, { contentType: (opts && opts.type) || blob.type || "image/jpeg" });
      return { id, url: blobUrl(id), sizeBytes: blob.size, contentType: (opts && opts.type) || blob.type };
    },
    // Listing every file is slow and costly on Storage; the page only needs URLs, which blobUrl() builds.
    list: async () => ({ assets: [] }),
  };

  // Sign in with Google: the Google account is linked to the visitor's current account, so the uid
  // (profile, saved addresses, orders) stays the same. If that Google account already belongs to another
  // uid (used on another phone before), the visitor switches to that uid and the page reloads.
  const who = u => {
    const g = (u.providerData || []).find(p => p.providerId === "google.com") || {};
    return { uid: u.uid, google: !!g.providerId, email: u.email || g.email || "", name: u.displayName || g.displayName || "" };
  };
  const google = fb.GoogleAuthProvider && (async () => {
    const u = auth.currentUser || await ready;
    if (who(u).google) return { ...who(u), switched: false };
    const provider = new fb.GoogleAuthProvider();
    provider.setCustomParameters({ prompt: "select_account" });
    try {
      const r = await fb.linkWithPopup(u, provider);
      return { ...who(r.user), switched: false };
    } catch (e) {
      if (e && (e.code === "auth/credential-already-in-use" || e.code === "auth/email-already-in-use")) {
        const cred = fb.GoogleAuthProvider.credentialFromError(e);
        const r = cred ? await fb.signInWithCredential(auth, cred) : await fb.signInWithPopup(auth, provider);
        return { ...who(r.user), switched: r.user.uid !== u.uid };
      }
      throw e;
    }
  });

  return {
    ready,
    blobUrl,
    google: google || null,
    account: async () => who(auth.currentUser || await ready),
    signOut: fb.signOut ? () => fb.signOut(auth) : null,
    // tells the page to load only the viewer's own data (Claude lets everyone read everything)
    scoped: true,
    noStorage: !storage,
    // Same contract as claude.use(): the namespace, or null when this viewer cannot use it.
    use: async name => {
      await ready;
      if (name === "db") return db;
      if (name === "user") return user;
      if (name === "assets") return storage && (await isAdmin()) ? assets : null;
      return null;
    },
  };
}
