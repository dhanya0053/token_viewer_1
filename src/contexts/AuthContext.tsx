import React, { createContext, useContext, useState, useEffect } from 'react';
import { 
  signInWithEmailAndPassword, 
  signInWithPopup, 
  GoogleAuthProvider as FirebaseGoogleAuthProvider,
  signOut as firebaseSignOut,
  onAuthStateChanged
} from 'firebase/auth';
import { auth, provider } from '../config/firebaseConfig';
import { api } from '../lib/api';

type User = {
  id: string;
  email: string;
  name: string;
  role: 'admin' | 'viewer';
};

interface AuthContextType {
  user: User | null;
  isAuthenticated: boolean;
  loading: boolean;
  loginWithEmail: (email: string, password: string) => Promise<boolean>;
  logout: () => Promise<void>;
  refreshUser: () => Promise<User>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  const refreshUser = async () => {
    try {
      const userData = await api<User>('/users/me', {
        method: 'GET',
      });
      setUser(userData);
      return userData;
    } catch (error) {
      console.error('Failed to refresh user:', error);
      setUser(null);
      throw error;
    }
  };

  // Handle auth state changes
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      if (firebaseUser) {
        try {
          // Get the Firebase ID token
          const idToken = await firebaseUser.getIdToken();
          
          // Set the token in a cookie via the backend using the api utility
          await api('/users/sessions?provider=email', {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${idToken}`
            },
          });

          // Refresh user data from our backend
          await refreshUser();
        } catch (error) {
          console.error('Auth state change error:', error);
          setUser(null);
        }
      } else {
        setUser(null);
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const loginWithEmail = async (email: string, password: string): Promise<boolean> => {
    setLoading(true);
    try {
      const userCredential = await signInWithEmailAndPassword(auth, email, password);
      const user = userCredential.user;
      const idToken = await user.getIdToken();
      if (!idToken) return false;

      await api('/users/sessions?provider=email', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${idToken}`
        },
      });
      
      await refreshUser();
      return true;
    } catch (error) {
      console.error('Email login failed:', error);
      return false;
    } finally {
      setLoading(false);
    }
  };


  const logout = async () => {
    try {
      // Sign out from Firebase
      await firebaseSignOut(auth);
      
      try {
        // Clear session on the backend using the api utility
        await api('/users/sessions', {
          method: 'DELETE',
        });
      } catch (apiError) {
        console.error('Failed to clear session on backend:', apiError);
        // Continue with logout even if backend logout fails
      }
      
      setUser(null);
    } catch (error) {
      console.error('Logout failed:', error);
      throw error;
    }
  };

  const value = {
    user,
    isAuthenticated: !!user,
    loading,
    loginWithEmail,
    logout,
    refreshUser
  };

  return (
    <AuthContext.Provider value={value}>
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
