import React, { createContext, useContext, useEffect, useState } from 'react';
import { authApi } from '../services/api';

interface Profile {
  id: string;
  email: string;
  full_name: string;
  role: string;
  phoneNumber?: string;
  address?: string;
  phone_number?: string;
  avatar_url?: string;
}

interface AuthContextType {
  user: any;
  profile: Profile | null;
  loading: boolean;
  error: string | null;
  signIn: (credentials: any) => Promise<void>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<any>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    checkUser();
  }, []);

  const checkUser = async () => {
    const token = localStorage.getItem('jd_token');
    
    if (token) {
      try {
        const { data } = await authApi.getMe();
        // Keep data structure compatible with existing components
        const formattedProfile = {
          ...data,
          full_name: data.fullName,
          phone_number: data.phoneNumber,
          address: data.address,
          avatar_url: data.avatarUrl
        };
        setUser(data);
        setProfile(formattedProfile);
      } catch (err) {
        console.error('Session validation failed:', err);
        localStorage.removeItem('jd_token');
        localStorage.removeItem('jd_user');
        setUser(null);
        setProfile(null);
      }
    } else {
      setUser(null);
      setProfile(null);
    }
    setLoading(false);
  };

  const signIn = async (credentials: any) => {
    try {
      setLoading(true);
      setError(null);
      const { data } = await authApi.login(credentials);
      
      localStorage.setItem('jd_token', data.token);
      localStorage.setItem('jd_user', JSON.stringify(data.user));
      
      const formattedProfile = {
        ...data.user,
        full_name: data.user.fullName,
        phone_number: data.user.phoneNumber,
        address: data.user.address,
        avatar_url: data.user.avatarUrl
      };
      
      setUser(data.user);
      setProfile(formattedProfile);
    } catch (err: any) {
      let msg = err.response?.data?.error || 'Login failed';
      if (err.response?.status === 401) {
        msg = 'Invalid email or password.';
      }
      setError(msg);
      // Preserve the error code (e.g. EMAIL_NOT_VERIFIED) so callers can handle specific cases
      const thrown: any = new Error(msg);
      thrown.code = err.response?.data?.code;
      throw thrown;
    } finally {
      setLoading(false);
    }
  };

  const signOut = async () => {
    localStorage.removeItem('jd_token');
    localStorage.removeItem('jd_user');
    setUser(null);
    setProfile(null);
  };

  return (
    <AuthContext.Provider value={{ user, profile, loading, error, signIn, signOut }}>
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
