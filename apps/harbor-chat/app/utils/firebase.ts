import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";

const firebaseConfig = {
  projectId: "harbor-7f970",
  appId: "1:63172028952:web:28769844f01b4e4892f16d",
  storageBucket: "harbor-7f970.firebasestorage.app",
  apiKey: "AIzaSyAIa1sTC1IqpkBn2cZMERP52_lq0sbxrk8",
  authDomain: "harbor-7f970.firebaseapp.com",
  messagingSenderId: "63172028952",
};

const app = initializeApp(firebaseConfig);

export const auth = getAuth(app);
export const db = getFirestore(app);
