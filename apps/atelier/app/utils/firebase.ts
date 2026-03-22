import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";

const firebaseConfig = {
  projectId: "atelier-eac0b",
  appId: "1:232969412082:web:05d16a58e9025734bc5f6b",
  storageBucket: "atelier-eac0b.firebasestorage.app",
  apiKey: "AIzaSyBQKE512uqkgmEnAtvX0nzkZaYUWWMqqEU",
  authDomain: "atelier-eac0b.firebaseapp.com",
  messagingSenderId: "232969412082",
};

const app = initializeApp(firebaseConfig);

export const auth = getAuth(app);
export const db = getFirestore(app);
