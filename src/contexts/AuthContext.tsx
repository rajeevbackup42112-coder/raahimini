'use client';

import { createContext, useContext, useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';

interface AuthContextType {
  user: any;
  session: any;
  loading: boolean;
  profile: any;
  signUp: (email: string, password: string, metadata?: any) => Promise<any>;
  signIn: (email: string, password: string) => Promise<any>;
  signInWithOtp: (phone: string) => Promise<any>;
  verifyOtp: (phone: string, token: string) => Promise<any>;
  requestPhoneVerification: (phone: string) => Promise<any>;
  verifyPhoneChange: (phone: string, token: string) => Promise<any>;
  removePhone: () => Promise<void>;
  signInWithGoogle: (redirectTo?: string) => Promise<any>;
  signOut: () => Promise<void>;
  getCurrentUser: () => Promise<any>;
  isEmailVerified: () => boolean;
  getUserProfile: () => Promise<any>;
  refreshProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({} as AuthContextType);

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return context;
};

export const AuthProvider = ({ children }: { children: React.ReactNode }) => {
  const [user, setUser] = useState<any>(null);
  const [session, setSession] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [profile, setProfile] = useState<any>(null);
  const supabase = createClient();

  const loadProfile = async (userId: string) => {
    try {
      const { data } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .single();
      setProfile(data);
    } catch {
      setProfile(null);
    }
  };

  const refreshProfile = async () => {
    if (user?.id) await loadProfile(user.id);
  };

  useEffect(() => {
    let active = true;
    let eventGeneration = 0;
    let profileTimer: ReturnType<typeof setTimeout> | null = null;

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      const generation = ++eventGeneration;
      setSession(nextSession);
      setUser(nextSession?.user ?? null);
      setLoading(false);

      if (profileTimer) {
        clearTimeout(profileTimer);
        profileTimer = null;
      }

      if (!nextSession?.user?.id) {
        setProfile(null);
        return;
      }

      // Do not call another Supabase API from inside onAuthStateChange.
      // supabase-js can hold its auth lock while this callback runs; a nested
      // query may deadlock the client and can provoke repeated refresh attempts.
      // Defer profile loading to the next task after the auth callback returns.
      const userId = nextSession.user.id;
      profileTimer = setTimeout(() => {
        void (async () => {
          try {
            const { data } = await supabase
              .from('profiles')
              .select('*')
              .eq('id', userId)
              .single();
            if (active && generation === eventGeneration) setProfile(data);
          } catch {
            if (active && generation === eventGeneration) setProfile(null);
          }
        })();
      }, 0);
    });

    return () => {
      active = false;
      if (profileTimer) clearTimeout(profileTimer);
      subscription.unsubscribe();
    };
  }, []);

  const signUp = async (email: string, password: string, metadata = {}) => {
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          display_name: (metadata as any)?.displayName || '',
          role: 'passenger',
        },
        emailRedirectTo: `${window.location.origin}/auth/callback`,
      },
    });
    if (error) throw error;
    return data;
  };

  const signIn = async (email: string, password: string) => {
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) throw error;
    return data;
  };

  // Mobile OTP: send OTP to phone number
  const signInWithOtp = async (phone: string) => {
    // Normalize phone: ensure +91 prefix
    const normalized = phone.startsWith('+') ? phone : `+91${phone.replace(/\D/g, '')}`;
    const { data, error } = await supabase.auth.signInWithOtp({
      phone: normalized,
    });
    if (error) throw error;
    return data;
  };

  // Mobile OTP: verify the OTP token
  const verifyOtp = async (phone: string, token: string) => {
    const normalized = phone.startsWith('+') ? phone : `+91${phone.replace(/\D/g, '')}`;
    const { data, error } = await supabase.auth.verifyOtp({
      phone: normalized,
      token,
      type: 'sms',
    });
    if (error) throw error;
    return data;
  };

  // Add or change a phone on the current account. Supabase sends a verification OTP.
  const requestPhoneVerification = async (phone: string) => {
    const normalized = phone.startsWith('+') ? phone : `+91${phone.replace(/\D/g, '')}`;
    const { data, error } = await supabase.auth.updateUser({ phone: normalized });
    if (error) throw error;
    return data;
  };

  const verifyPhoneChange = async (phone: string, token: string) => {
    const normalized = phone.startsWith('+') ? phone : `+91${phone.replace(/\D/g, '')}`;
    const { data, error } = await supabase.auth.verifyOtp({
      phone: normalized,
      token,
      type: 'phone_change',
    });
    if (error) throw error;

    const { data: userData, error: userError } = await supabase.auth.getUser();
    if (userError) throw userError;
    setUser(userData.user);
    if (userData.user?.id) {
      await supabase.from('profiles').update({ phone: userData.user.phone || '' }).eq('id', userData.user.id);
      await loadProfile(userData.user.id);
    }
    return data;
  };

  const removePhone = async () => {
    const { data, error } = await supabase.auth.getUserIdentities();
    if (error) throw error;
    const identities = data?.identities || [];
    const phoneIdentity = identities.find((identity: any) => identity.provider === 'phone');
    const hasAlternative = identities.some((identity: any) => identity.provider !== 'phone');
    if (!phoneIdentity) throw new Error('No phone identity is linked to this account.');
    if (!hasAlternative) throw new Error('Add another sign-in method before removing your phone.');

    const { error: unlinkError } = await supabase.auth.unlinkIdentity(phoneIdentity);
    if (unlinkError) throw unlinkError;

    const { data: userData, error: userError } = await supabase.auth.getUser();
    if (userError) throw userError;
    setUser(userData.user);
    if (userData.user?.id) {
      await supabase.from('profiles').update({ phone: '' }).eq('id', userData.user.id);
      await loadProfile(userData.user.id);
    }
  };

  // Google OAuth
  const signInWithGoogle = async (redirectTo?: string) => {
    const callbackUrl = `${window.location.origin}/auth/callback${redirectTo ? `?next=${encodeURIComponent(redirectTo)}` : ''}`;
    const { data, error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: callbackUrl,
      },
    });
    if (error) throw error;
    return data;
  };

  const signOut = async () => {
    const { error } = await supabase.auth.signOut();
    if (error) throw error;
    setProfile(null);
  };

  const getCurrentUser = async () => {
    const { data: { user }, error } = await supabase.auth.getUser();
    if (error) throw error;
    return user;
  };

  const isEmailVerified = () => {
    return user?.email_confirmed_at !== null;
  };

  const getUserProfile = async () => {
    if (!user) return null;
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', user.id)
      .single();
    if (error) throw error;
    return data;
  };

  const value: AuthContextType = {
    user,
    session,
    loading,
    profile,
    signUp,
    signIn,
    signInWithOtp,
    verifyOtp,
    requestPhoneVerification,
    verifyPhoneChange,
    removePhone,
    signInWithGoogle,
    signOut,
    getCurrentUser,
    isEmailVerified,
    getUserProfile,
    refreshProfile,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};
