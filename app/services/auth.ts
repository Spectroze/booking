import { 
  signInWithPopup, 
  GoogleAuthProvider, 
  signOut as firebaseSignOut,
  User 
} from 'firebase/auth';
import { 
  doc, 
  setDoc, 
  getDoc, 
  serverTimestamp 
} from 'firebase/firestore';
import { auth, db } from './firebase';

const googleProvider = new GoogleAuthProvider();

export interface UserData {
  uid: string;
  email: string;
  displayName: string;
  photoURL?: string;
  role?: 'user' | 'admin';
  isAdmin?: boolean; // Keep for backward compatibility
  createdAt?: any;
  lastLogin?: any;
}

export const signInWithGoogle = async (): Promise<User> => {
  try {
    const result = await signInWithPopup(auth, googleProvider);
    const user = result.user;
    
    // Save or update user data in Firestore
    const userRef = doc(db, 'users', user.uid);
    const userSnap = await getDoc(userRef);
    
    const userData: UserData = {
      uid: user.uid,
      email: user.email || '',
      displayName: user.displayName || '',
      photoURL: user.photoURL || undefined,
      lastLogin: serverTimestamp(),
    };
    
    if (!userSnap.exists()) {
      // New user - create document with default role "user"
      await setDoc(userRef, {
        ...userData,
        role: 'user', // Default role is "user"
        isAdmin: false, // Keep for backward compatibility
        createdAt: serverTimestamp(),
      });
    } else {
      // Existing user - update last login and ensure role exists
      const existingData = userSnap.data();
      const updateData = {
        ...userData,
        // Preserve existing role if it exists, otherwise set to "user"
        role: existingData?.role || 'user',
      };
      await setDoc(userRef, updateData, { merge: true });
    }
    
    return user;
  } catch (error) {
    console.error('Error signing in with Google:', error);
    throw error;
  }
};

export const getUserData = async (uid: string): Promise<UserData | null> => {
  try {
    const userRef = doc(db, 'users', uid);
    const userSnap = await getDoc(userRef);
    
    if (userSnap.exists()) {
      return userSnap.data() as UserData;
    }
    return null;
  } catch (error) {
    console.error('Error getting user data:', error);
    return null;
  }
};

export const isAdmin = async (uid: string): Promise<boolean> => {
  try {
    const userData = await getUserData(uid);
    // Check both role field and isAdmin field for backward compatibility
    return userData?.role === 'admin' || userData?.isAdmin === true;
  } catch (error) {
    console.error('Error checking admin status:', error);
    return false;
  }
};

export const signOut = async (): Promise<void> => {
  try {
    await firebaseSignOut(auth);
  } catch (error) {
    console.error('Error signing out:', error);
    throw error;
  }
};

export { auth };
