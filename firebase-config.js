import { initializeApp } from "https://www.gstatic.com/firebasejs/12.11.0/firebase-app.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/12.11.0/firebase-auth.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/12.11.0/firebase-firestore.js";

const firebaseConfig = {
  apiKey: "AIzaSyCm35oVEiiFZr8bNgJZJXQp_6JJqMFSSD4",
  authDomain: "mundoledcontrol.firebaseapp.com",
  projectId: "mundoledcontrol",
  storageBucket: "mundoledcontrol.firebasestorage.app",
  messagingSenderId: "1058675840412",
  appId: "1:1058675840412:web:f5f739886abbd7b4fa2459"
};

const app = initializeApp(firebaseConfig);

export const auth = getAuth(app);
export const db = getFirestore(app);
