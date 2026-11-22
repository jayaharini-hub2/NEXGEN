import { initializeApp } from "https://www.gstatic.com/firebasejs/13.4.0/firebase-app.js";

import { getAuth } from "https://www.gstatic.com/firebasejs/13.4.0/firebase-auth.js";

import {
    getFirestore,
    collection,
    doc,
    addDoc,
    updateDoc,
    deleteDoc,
    onSnapshot,
    getDocs,
    query,
    where,
    serverTimestamp
} from "https://www.gstatic.com/firebasejs/13.4.0/firebase-firestore.js";

const firebaseConfig = {
 
    apiKey: "AIzaSyCbLzSG-zarRnO2VZtc1MOm7QxtVekd0E4",
    authDomain: "nexgen-9e4a9.firebaseapp.com",
    projectId: "nexgen-9e4a9",
    storageBucket: "nexgen-9e4a9.firebasestorage.app",
    messagingSenderId: "743698562761",
    appId: "1:743698562761:web:9d5ca7a3c605d71512d718"
 
  };

// Initialize Firebase
const app = initializeApp(firebaseConfig);

// Initialize Firebase services
export const auth = getAuth(app);
export const db = getFirestore(app);

// Export Firestore functions for our application
export {
    collection,
    doc,
    addDoc,
    updateDoc,
    deleteDoc,
    onSnapshot,
    getDocs,
    query,
    where,
    serverTimestamp
};