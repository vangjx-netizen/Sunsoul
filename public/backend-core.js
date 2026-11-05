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

  // Team members are listed in admins/{uid}; the security rules use the same list.
  let adminP = null;
  const isAdmin = () => adminP || (adminP = ready.then(async u => {
    try { return (await fb.getDoc(fb.doc(fs, "admins/" + u.uid))).exists(); } catch (e) { return false; }
  }));
  const user = {
    id: async () => (await ready).uid,
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

  return {
    ready,
    blobUrl,
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
