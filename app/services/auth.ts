import { 
  signInWithPopup, 
  GoogleAuthProvider, 
  signOut as firebaseSignOut,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  updateProfile,
  User 
} from 'firebase/auth';
import { 
  doc, 
  setDoc, 
  getDoc, 
  serverTimestamp,
  collection,
  getDocs,
  updateDoc,
  onSnapshot,
  deleteDoc,
} from 'firebase/firestore';
import { auth, db } from './firebase';

const googleProvider = new GoogleAuthProvider();

export interface UserData {
  uid: string;
  email: string;
  displayName: string;
  photoURL?: string;
  role?: 'user' | 'admin' | 'admin-training' | 'admin-dome';
  status?: 'pending' | 'approved' | 'declined';
  isAdmin?: boolean; // Keep for backward compatibility
  createdAt?: any;
  lastLogin?: any;
}

export type AppRole = 'user' | 'admin' | 'admin-training' | 'admin-dome';

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
        status: 'pending', // Default status is "pending"
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

// Sign up with email and password
export const signUpWithEmail = async (email: string, password: string, displayName: string): Promise<User> => {
  try {
    const result = await createUserWithEmailAndPassword(auth, email, password);
    const user = result.user;

    // Set display name on the Firebase Auth profile
    await updateProfile(user, { displayName });

    // Create user document in Firestore with pending status
    const userRef = doc(db, 'users', user.uid);
    await setDoc(userRef, {
      uid: user.uid,
      email: user.email || email,
      displayName,
      role: 'user',
      status: 'pending',
      isAdmin: false,
      createdAt: serverTimestamp(),
      lastLogin: serverTimestamp(),
    });

    return user;
  } catch (error) {
    console.error('Error signing up with email:', error);
    throw error;
  }
};

// Sign in with email and password
export const signInWithEmail = async (email: string, password: string): Promise<User> => {
  try {
    const result = await signInWithEmailAndPassword(auth, email, password);
    const user = result.user;

    // Update last login
    const userRef = doc(db, 'users', user.uid);
    await setDoc(userRef, { lastLogin: serverTimestamp() }, { merge: true });

    return user;
  } catch (error) {
    console.error('Error signing in with email:', error);
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

export const getAllUsers = async (): Promise<UserData[]> => {
  try {
    const usersCollection = collection(db, 'users');
    const userSnapshot = await getDocs(usersCollection);
    return userSnapshot.docs.map(doc => doc.data() as UserData);
  } catch (error) {
    console.error('Error getting all users:', error);
    return [];
  }
};

export const getSafeUserRole = (role?: string | null): AppRole => {
  if (role === 'admin' || role === 'admin-training' || role === 'admin-dome') {
    return role;
  }
  return 'user';
};

export const getDefaultRouteForRole = (role: AppRole): string => {
  switch (role) {
    case 'admin-training':
      return '/admin';
    case 'admin-dome':
      return '/admin/admin-dome-tent';
    case 'admin':
      return '/admin/select-dashboard';
    default:
      return '/user';
  }
};

/** Real-time listener for all user documents (admin dashboards, user management) */
export const subscribeToAllUsers = (
  callback: (users: UserData[]) => void
): (() => void) => {
  const usersCollection = collection(db, 'users');
  return onSnapshot(
    usersCollection,
    snapshot => {
      callback(snapshot.docs.map(d => d.data() as UserData));
    },
    error => {
      console.error('subscribeToAllUsers:', error);
      callback([]);
    }
  );
};

export const updateUserStatus = async (uid: string, status: 'pending' | 'approved' | 'declined'): Promise<void> => {
  try {
    const userRef = doc(db, 'users', uid);
    await updateDoc(userRef, { status });
  } catch (error) {
    console.error('Error updating user status:', error);
    throw error;
  }
};

// Update user role (admin only)
export const updateUserRole = async (
  uid: string,
  role: 'user' | 'admin' | 'admin-training' | 'admin-dome'
): Promise<void> => {
  try {
    const userRef = doc(db, 'users', uid);
    await updateDoc(userRef, { role });
  } catch (error) {
    console.error('Error updating user role:', error);
    throw error;
  }
};

export const deleteUser = async (uid: string): Promise<void> => {
  try {
    const userRef = doc(db, 'users', uid);
    await deleteDoc(userRef);
  } catch (error) {
    console.error('Error deleting user:', error);
    throw error;
  }
};

export const isAdmin = async (uid: string): Promise<boolean> => {
  try {
    const userData = await getUserData(uid);
    // Check both role field and isAdmin field for backward compatibility
    return userData?.role === 'admin' || userData?.role === 'admin-training' || userData?.role === 'admin-dome' || userData?.isAdmin === true;
  } catch (error) {
    console.error('Error checking admin status:', error);
    return false;
  }
};

// Get user role
export const getUserRole = async (uid: string): Promise<string | null> => {
  try {
    const userData = await getUserData(uid);
    return userData?.role || null;
  } catch (error) {
    console.error('Error getting user role:', error);
    return null;
  }
};

// Check if user is admin-training
export const isAdminTraining = async (uid: string): Promise<boolean> => {
  try {
    const userData = await getUserData(uid);
    return userData?.role === 'admin-training';
  } catch (error) {
    console.error('Error checking admin-training status:', error);
    return false;
  }
};

// Check if user is admin-dome
export const isAdminDome = async (uid: string): Promise<boolean> => {
  try {
    const userData = await getUserData(uid);
    return userData?.role === 'admin-dome';
  } catch (error) {
    console.error('Error checking admin-dome status:', error);
    return false;
  }
};

// Check if user is general admin (can choose dashboard)
export const isGeneralAdmin = async (uid: string): Promise<boolean> => {
  try {
    const userData = await getUserData(uid);
    return userData?.role === 'admin';
  } catch (error) {
    console.error('Error checking general admin status:', error);
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
