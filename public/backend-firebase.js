// Loads the Firebase SDK and builds the backend the page uses when it runs on Firebase Hosting.
// index.html imports this file only on *.web.app / *.firebaseapp.com (and when testing with ?fb=1).
import { initializeApp } from "https://www.gstatic.com/firebasejs/12.19.0/firebase-app.js";
import { getFirestore, doc, collection, getDoc, setDoc, updateDoc, deleteDoc, onSnapshot } from "https://www.gstatic.com/firebasejs/12.19.0/firebase-firestore.js";
import { getAuth, onAuthStateChanged, signInAnonymously } from "https://www.gstatic.com/firebasejs/12.19.0/firebase-auth.js";
import { getStorage, ref, uploadBytes } from "https://www.gstatic.com/firebasejs/12.19.0/firebase-storage.js";
import { firebaseConfig } from "./firebase-config.js";
import { makeBackend } from "./backend-core.js";

export function start() {
  return makeBackend({
    initializeApp, getFirestore, doc, collection, getDoc, setDoc, updateDoc, deleteDoc, onSnapshot,
    getAuth, onAuthStateChanged, signInAnonymously, getStorage, ref, uploadBytes,
  }, firebaseConfig);
}
