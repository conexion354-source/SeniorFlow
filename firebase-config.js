// Import the functions you need from the SDKs you need
import { initializeApp } from "firebase/app";
import { getAnalytics } from "firebase/analytics";
// TODO: Add SDKs for Firebase products that you want to use
// https://firebase.google.com/docs/web/setup#available-libraries

// Your web app's Firebase configuration
// For Firebase JS SDK v7.20.0 and later, measurementId is optional
const firebaseConfig = {
  apiKey: "AIzaSyCm35oVEiiFZr8bNgJZJXQp_6JJqMFSSD4",
  authDomain: "mundoledcontrol.firebaseapp.com",
  projectId: "mundoledcontrol",
  storageBucket: "mundoledcontrol.firebasestorage.app",
  messagingSenderId: "1058675840412",
  appId: "1:1058675840412:web:f5f739886abbd7b4fa2459",
  measurementId: "G-6TYTKKN90Y"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const analytics = getAnalytics(app);
