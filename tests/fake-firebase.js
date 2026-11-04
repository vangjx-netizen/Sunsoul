// A small in-memory stand-in for the Firebase functions backend-core.js uses.
// Written as one plain function so it runs both in Node and inside the test browser (as source text).
function makeFakeFirebase(seed) {
  const docs = new Map(Object.entries(seed || {}).map(([k, v]) => [k, JSON.parse(JSON.stringify(v))]));
  const listeners = new Set();
  const clone = v => v === undefined ? undefined : JSON.parse(JSON.stringify(v));
  const segs = p => p.split("/").filter(Boolean);
  const children = path => [...docs.keys()].filter(k => k.startsWith(path + "/") && segs(k).length === segs(path).length + 1);
  const docSnap = path => ({ id: segs(path).pop(), exists: () => docs.has(path), data: () => clone(docs.get(path)) });
  const collSnap = path => ({ docs: children(path).map(k => ({ id: segs(k).pop(), data: () => clone(docs.get(k)) })) });
  const fire = () => listeners.forEach(l => l());
  const auth = { user: null, subs: new Set(), anonCount: 0 };
  const fb = {
    _docs: docs, _auth: auth, writes: [],
    initializeApp: c => ({ config: c }),
    getFirestore: () => ({}),
    getAuth: () => auth,
    getStorage: () => ({ files: new Map() }),
    doc: (fs, path) => ({ path }),
    collection: (fs, path) => ({ path, coll: true }),
    getDoc: async ref => docSnap(ref.path),
    setDoc: async (ref, data) => { fb.writes.push(["set", ref.path]); docs.set(ref.path, clone(data)); fire(); },
    updateDoc: async (ref, data) => {
      if (!docs.has(ref.path)) throw Object.assign(new Error("not-found"), { code: "not-found" });
      fb.writes.push(["update", ref.path]); docs.set(ref.path, { ...docs.get(ref.path), ...clone(data) }); fire();
    },
    deleteDoc: async ref => { fb.writes.push(["delete", ref.path]); docs.delete(ref.path); fire(); },
    onSnapshot: (ref, cb) => {
      const l = () => cb(ref.coll ? collSnap(ref.path) : docSnap(ref.path));
      listeners.add(l); setTimeout(l, 0); return () => listeners.delete(l);
    },
    onAuthStateChanged: (a, cb) => { a.subs.add(cb); setTimeout(() => cb(a.user), 0); return () => a.subs.delete(cb); },
    signInAnonymously: async a => { a.anonCount++; a.user = { uid: "anon" + a.anonCount, isAnonymous: true }; a.subs.forEach(cb => cb(a.user)); return { user: a.user }; },
    ref: (st, path) => ({ st, path }),
    uploadBytes: async (r, blob, meta) => { r.st.files.set(r.path, meta); return {}; },
  };
  return fb;
}
if (typeof module !== "undefined") module.exports = { makeFakeFirebase };
