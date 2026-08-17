import { initializeApp } from "https://www.gstatic.com/firebasejs/12.11.0/firebase-app.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/12.11.0/firebase-auth.js";
import { getFirestore, initializeFirestore, persistentLocalCache, persistentMultipleTabManager } from "https://www.gstatic.com/firebasejs/12.11.0/firebase-firestore.js";
import { getStorage } from "https://www.gstatic.com/firebasejs/12.11.0/firebase-storage.js";

const firebaseConfig = {
  apiKey: "AIzaSyCm35oVEiiFZr8bNgJZJXQp_6JJqMFSSD4",
  authDomain: "mundoledcontrol.firebaseapp.com",
  projectId: "mundoledcontrol",
  storageBucket: "mundoledcontrol.firebasestorage.app",
  messagingSenderId: "1058675840412",
  appId: "1:1058675840412:web:f5f739886abbd7b4fa2459",
  measurementId: "G-6TYTKKN90Y"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
// Firestore mantiene una copia local y encola escrituras cuando no hay red.
// Si el navegador no soporta persistencia, conserva el comportamiento online.
let db;
try {
  db = initializeFirestore(app, {
    localCache: persistentLocalCache({ tabManager: persistentMultipleTabManager() })
  });
} catch (error) {
  console.warn('Persistencia offline no disponible; se usa Firestore online.', error);
  db = getFirestore(app);
}
const storage = getStorage(app);

export { auth, db, storage, firebaseConfig };
