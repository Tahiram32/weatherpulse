import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";
import { getAuth, GoogleAuthProvider } from "firebase/auth";
import config from "../firebase-applet-config.json";

const firebaseConfig = {
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || config.projectId,
  appId: import.meta.env.VITE_FIREBASE_APP_ID || config.appId,
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY || config.apiKey,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || config.authDomain,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || config.storageBucket,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || config.messagingSenderId,
};

export const firebaseApp = initializeApp(firebaseConfig);
export const db = getFirestore(firebaseApp, import.meta.env.VITE_FIREBASE_FIRESTORE_DATABASE_ID || (config as any).firestoreDatabaseId || "(default)");
export const auth = getAuth(firebaseApp);
export const googleProvider = new GoogleAuthProvider();
googleProvider.addScope("https://www.googleapis.com/auth/calendar.events");
googleProvider.addScope("https://www.googleapis.com/auth/calendar.readonly");
googleProvider.setCustomParameters({
  prompt: 'consent',
  access_type: 'offline'
});
