import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { 
  User, 
  onAuthStateChanged, 
  signInWithPopup, 
  GoogleAuthProvider, 
  signOut 
} from 'firebase/auth';
import { auth, db } from './firebase';
import { 
  doc, 
  getDoc, 
  setDoc, 
  updateDoc, 
  serverTimestamp 
} from 'firebase/firestore';

export interface UserProfile {
  uid: string;
  email: string;
  displayName: string;
  photoURL?: string;
  language?: string;
  voiceName?: string;
  mood?: string;
  wakeWordEnabled?: boolean;
  offlineEnabled?: boolean;
  voicePitch?: number;
  voiceRate?: number;
  createdAt?: any;
  updatedAt?: any;
}

interface AuthContextType {
  user: User | null;
  profile: UserProfile | null;
  loading: boolean;
  isLoggingIn: boolean;
  login: () => Promise<void>;
  logout: () => Promise<void>;
  updateProfile: (data: Partial<UserProfile>) => Promise<void>;
  refreshProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [isLoggingIn, setIsLoggingIn] = useState(false);

  // Sync user profile from Firestore or bootstrap default
  const syncProfile = useCallback(async (authUser: User) => {
    try {
      const userRef = doc(db, 'users', authUser.uid);
      const userSnap = await getDoc(userRef);

      if (userSnap.exists()) {
        const data = userSnap.data() as UserProfile;
        setProfile(data);

        // Populate localStorage caches for voice engine
        if (data.voiceName) localStorage.setItem('alya_preferred_voice', data.voiceName);
        if (data.language) localStorage.setItem('alya_preferred_lang', data.language);
        if (data.mood) localStorage.setItem('alya_current_mood', data.mood);
      } else {
        const newProfile: UserProfile = {
          uid: authUser.uid,
          email: authUser.email || '',
          displayName: authUser.displayName || 'Alya User',
          photoURL: authUser.photoURL || '',
          language: localStorage.getItem('alya_preferred_lang') || 'auto',
          voiceName: localStorage.getItem('alya_preferred_voice') || 'Kore',
          mood: localStorage.getItem('alya_current_mood') || 'auto',
          wakeWordEnabled: true,
          offlineEnabled: true,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        };

        await setDoc(userRef, newProfile);
        setProfile(newProfile);
      }
    } catch (err) {
      console.warn('[AuthContext] Error syncing user profile from Firestore:', err);
      // Fallback in-memory profile
      setProfile({
        uid: authUser.uid,
        email: authUser.email || '',
        displayName: authUser.displayName || 'Alya User',
        photoURL: authUser.photoURL || '',
        language: 'auto',
        voiceName: 'Kore',
        mood: 'auto'
      });
    }
  }, []);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (authUser) => {
      setUser(authUser);
      if (authUser) {
        await syncProfile(authUser);
      } else {
        setProfile(null);
      }
      setLoading(false);
    });

    return unsubscribe;
  }, [syncProfile]);

  const login = async () => {
    if (isLoggingIn) return;
    setIsLoggingIn(true);
    try {
      const provider = new GoogleAuthProvider();
      provider.setCustomParameters({ prompt: 'select_account' });
      await signInWithPopup(auth, provider);
    } catch (error: any) {
      if (error.code !== 'auth/cancelled-popup-request' && error.code !== 'auth/popup-closed-by-user') {
        console.error('Firebase Login error:', error);
      }
    } finally {
      setIsLoggingIn(false);
    }
  };

  const logout = async () => {
    try {
      await signOut(auth);
      setUser(null);
      setProfile(null);
    } catch (error) {
      console.error('Logout error:', error);
    }
  };

  const updateProfileData = async (data: Partial<UserProfile>) => {
    if (!user) return;
    try {
      const userRef = doc(db, 'users', user.uid);
      const updatedFields = {
        ...data,
        updatedAt: serverTimestamp()
      };

      await updateDoc(userRef, updatedFields);

      setProfile(prev => prev ? { ...prev, ...data } : null);

      // Keep voice & language settings in local storage
      if (data.voiceName) localStorage.setItem('alya_preferred_voice', data.voiceName);
      if (data.language) localStorage.setItem('alya_preferred_lang', data.language);
      if (data.mood) localStorage.setItem('alya_current_mood', data.mood);
    } catch (error) {
      console.error('[AuthContext] Error updating user profile:', error);
      throw error;
    }
  };

  const refreshProfile = async () => {
    if (user) {
      await syncProfile(user);
    }
  };

  return (
    <AuthContext.Provider value={{ 
      user, 
      profile, 
      loading, 
      isLoggingIn, 
      login, 
      logout, 
      updateProfile: updateProfileData,
      refreshProfile 
    }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
