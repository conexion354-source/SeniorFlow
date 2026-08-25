import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
import { getStorage } from 'firebase/storage';

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
// La caja y los movimientos deben reflejar siempre el estado compartido de
// Firebase. No se habilita persistencia IndexedDB para evitar que una PC
// opere con una copia local vieja de la caja.
const db = getFirestore(app);
const storage = getStorage(app);

export { auth, db, storage, firebaseConfig };
