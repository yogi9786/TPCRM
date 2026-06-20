// =============================================
// firebase.ts — Replace with YOUR Firebase config
// Go to: Firebase Console → Project Settings → Your apps → SDK setup
// =============================================

import { initializeApp } from 'firebase/app'
import { getAuth } from 'firebase/auth'
import { getFirestore } from 'firebase/firestore'
import { getStorage } from 'firebase/storage'

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY || "AIzaSyCewJ7GqHR-ruIF8-HT-fXE_pEGgH8T5Xw",
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || "tpcrm-f474f.firebaseapp.com",
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || "tpcrm-f474f",
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || "tpcrm-f474f.firebasestorage.app",
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || "696500756351",
  appId: import.meta.env.VITE_FIREBASE_APP_ID || "1:696500756351:web:15b96cc3ce5d2949b0844a",
  measurementId: import.meta.env.VITE_FIREBASE_MEASUREMENT_ID || "G-8QZGSQTY1Y"
};


const app = initializeApp(firebaseConfig)

export const auth = getAuth(app)
export const db = getFirestore(app)
export const storage = getStorage(app)
export default app
