// src/firebase/config.js
import { initializeApp } from "firebase/app";
import { getFirestore, Timestamp } from "firebase/firestore"; // Importamos Timestamp aquí también

const firebaseConfig = {
  apiKey: "AIzaSyDKbSKfwrV_KHJoliwIpC1IlN621_7nLOo",
  authDomain: "easyrentas-a2c88.firebaseapp.com",
  projectId: "easyrentas-a2c88",
  storageBucket: "easyrentas-a2c88.firebasestorage.app",
  messagingSenderId: "209386301108",
  appId: "1:209386301108:web:8cecfd46ee4f06bc0499e1",
  measurementId: "G-RJ2HC2SVMQ"
};

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);
export const FirebaseTimestamp = Timestamp; // Lo exportamos con un nombre claro