import { initializeApp, getApps, FirebaseApp } from 'firebase/app';
import { getAuth, Auth } from 'firebase/auth';
import { getAnalytics, Analytics } from 'firebase/analytics';
import { getFirestore, Firestore } from 'firebase/firestore';

// Only initialize Firebase on client side
let app: FirebaseApp | null = null;
let authInstance: Auth | null = null;
let dbInstance: Firestore | null = null;
let analyticsInstance: Analytics | null = null;

function getFirebaseConfig() {
  return {
    apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
    authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
    projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
    storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
    messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
    appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
    measurementId: process.env.NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID,
  };
}

function getApp(): FirebaseApp {
  if (typeof window === 'undefined') {
    throw new Error('Firebase can only be initialized on the client side');
  }
  
  if (!app) {
    const firebaseConfig = getFirebaseConfig();
    
    // Validate config
    if (!firebaseConfig.apiKey || !firebaseConfig.projectId) {
      throw new Error('Firebase configuration is missing. Please check your environment variables.');
    }
    
    if (!getApps().length) {
      app = initializeApp(firebaseConfig);
    } else {
      app = getApps()[0];
    }
  }
  return app;
}

// Initialize Firebase Authentication - lazy initialization
export const auth: Auth = (() => {
  if (typeof window === 'undefined') {
    // During SSR/build, return a minimal mock that won't cause errors
    // This will be replaced on client side
    return {
      currentUser: null,
      onAuthStateChanged: () => () => {},
    } as unknown as Auth;
  }
  if (!authInstance) {
    authInstance = getAuth(getApp());
  }
  return authInstance;
})();

// Initialize Firestore - lazy initialization
export const db: Firestore = (() => {
  if (typeof window === 'undefined') {
    // During SSR/build, return a minimal mock that won't cause errors
    return {
      collection: () => ({}),
      doc: () => ({}),
    } as unknown as Firestore;
  }
  if (!dbInstance) {
    dbInstance = getFirestore(getApp());
  }
  return dbInstance;
})();

// Initialize Analytics (only in browser environment)
export const analytics: Analytics | null = 
  typeof window !== 'undefined' ? (analyticsInstance || (analyticsInstance = getAnalytics(getApp()))) : null;

export default getApp;

