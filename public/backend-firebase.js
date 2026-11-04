// Loads the Firebase SDK and builds the backend the page uses when it runs on Firebase Hosting.
// index.html imports this file only on *.web.app / *.firebaseapp.com (and when testing with ?fb=1).
import { initializeApp } from "https://www.gstatic.com/firebasejs/12.19.0/firebase-app.js";
import { getFirestore, doc, collection, getDoc, setDoc, updateDoc, deleteDoc, onSnapshot, query, where, connectFirestoreEmulator } from "https://www.gstatic.com/firebasejs/12.19.0/firebase-firestore.js";
import { getAuth, onAuthStateChanged, signInAnonymously, connectAuthEmulator } from "https://www.gstatic.com/firebasejs/12.19.0/firebase-auth.js";
import { getStorage, ref, uploadBytes, connectStorageEmulator } from "https://www.gstatic.com/firebasejs/12.19.0/firebase-storage.js";
import { firebaseConfig } from "./firebase-config.js";
import { makeBackend } from "./backend-core.js";

// On localhost the page talks to the Firebase emulators instead of the real project (for testing).
const local = ["localhost", "127.0.0.1"].includes(location.hostname);
const useEmulators = (fs, auth, storage) => {
  connectFirestoreEmulator(fs, "127.0.0.1", 8080);
  connectAuthEmulator(auth, "http://127.0.0.1:9099", { disableWarnings: true });
  if (storage) connectStorageEmulator(storage, "127.0.0.1", 9199);
};

export function start() {
  return makeBackend({
    initializeApp, getFirestore, doc, collection, getDoc, setDoc, updateDoc, deleteDoc, onSnapshot, query, where,
    getAuth, onAuthStateChanged, signInAnonymously, getStorage, ref, uploadBytes,
    useEmulators: local ? useEmulators : null,
  }, local ? { ...firebaseConfig, projectId: "demo-sunsoul" } : firebaseConfig);
}
