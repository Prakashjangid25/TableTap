import React, { createContext, useContext, useState, useEffect } from 'react';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { db } from '../firebase';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [userRole, setUserRole] = useState(null);
  const [userRestaurantId, setUserRestaurantId] = useState(null);
  const [loading, setLoading] = useState(false);
  const [initialLoading, setInitialLoading] = useState(true);

  // Restore session from localStorage on mount
  useEffect(() => {
    const savedSession = localStorage.getItem('tabletap_session');
    if (savedSession) {
      try {
        const session = JSON.parse(savedSession);
        if (session && session.user) {
          setUser(session.user);
          setUserRole(session.role);
          setUserRestaurantId(session.restaurantId);
        }
      } catch (error) {
        console.error('Error restoring tabletap session:', error);
        localStorage.removeItem('tabletap_session');
      }
    }
    setInitialLoading(false);
  }, []);

  // Sign In using Firestore-based custom credentials store
  const signInWithEmail = async (email, password) => {
    setLoading(true);
    try {
      if (!email || !password) {
        throw new Error('Please fill in both email and password.');
      }
      
      const emailId = email.toLowerCase().trim();
      const userDocRef = doc(db, 'users', emailId);
      const userDocSnap = await getDoc(userDocRef);

      if (!userDocSnap.exists()) {
        throw new Error('No admin account found with this email.');
      }

      const userData = userDocSnap.data();
      
      // Verify password
      if (userData.password !== password) {
        throw new Error('Incorrect password. Please try again.');
      }

      const authenticatedUser = {
        uid: emailId,
        email: userData.email || email
      };

      setUser(authenticatedUser);
      setUserRole(userData.role || 'customer');
      setUserRestaurantId(userData.restaurantId || null);

      // Save session
      localStorage.setItem('tabletap_session', JSON.stringify({
        user: authenticatedUser,
        role: userData.role || 'customer',
        restaurantId: userData.restaurantId || null
      }));

      return authenticatedUser;
    } catch (error) {
      console.error('Custom sign-in error:', error);
      throw error;
    } finally {
      setLoading(false);
    }
  };

  // Sign Up using Firestore-based custom credentials store
  const signUpWithEmail = async (email, password, role = 'customer', restaurantId = null) => {
    setLoading(true);
    try {
      if (!email || !password) {
        throw new Error('Please fill in all fields.');
      }

      const emailId = email.toLowerCase().trim();
      const userDocRef = doc(db, 'users', emailId);
      const userDocSnap = await getDoc(userDocRef);

      if (userDocSnap.exists()) {
        throw new Error('An account with this email already exists.');
      }

      const userData = {
        uid: emailId,
        email: email,
        password: password, // Store plain password for simple admin control panel setup
        role: role,
        restaurantId: restaurantId,
        createdAt: new Date().toISOString()
      };

      // Save user to Firestore
      await setDoc(userDocRef, userData);

      const authenticatedUser = {
        uid: emailId,
        email: email
      };

      setUser(authenticatedUser);
      setUserRole(role);
      setUserRestaurantId(restaurantId);

      // Save session
      localStorage.setItem('tabletap_session', JSON.stringify({
        user: authenticatedUser,
        role: role,
        restaurantId: restaurantId
      }));

      return authenticatedUser;
    } catch (error) {
      console.error('Custom sign-up error:', error);
      throw error;
    } finally {
      setLoading(false);
    }
  };

  // Log Out
  const logOut = async () => {
    setLoading(true);
    try {
      setUser(null);
      setUserRole(null);
      setUserRestaurantId(null);
      localStorage.removeItem('tabletap_session');
    } catch (error) {
      console.error('Log out error:', error);
      throw error;
    } finally {
      setLoading(false);
    }
  };

  const value = {
    user,
    userRole,
    userRestaurantId,
    loading,
    signInWithEmail,
    signUpWithEmail,
    logOut
  };

  return (
    <AuthContext.Provider value={value}>
      {initialLoading ? (
        <div className="min-h-screen bg-slate-950 text-white font-sans flex items-center justify-center p-4">
          <div className="text-center space-y-4">
            <div className="w-12 h-12 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin mx-auto" />
            <p className="text-sm font-medium text-slate-400 uppercase tracking-wider">Loading TableTap Sessions...</p>
          </div>
        </div>
      ) : children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}

