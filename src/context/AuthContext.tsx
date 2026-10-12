import React, { createContext, useContext, useState, useEffect } from 'react';
import { StudentProfile, Branch, AcademicYear } from '../types';
import { dataService } from '../services/dataService';
import { INITIAL_STUDENTS } from '../services/mockData';

interface AuthContextType {
  user: StudentProfile | null;
  loading: boolean;
  isLiveSupabase: boolean;
  signIn: (regNo: string, password: string) => Promise<{ success: boolean; error?: string }>;
  signUp: (data: {
    reg_no: string;
    password: string;
    full_name: string;
    branch: Branch;
    academic_year: AcademicYear;
    section: string;
  }) => Promise<{ success: boolean; error?: string }>;
  signOut: () => Promise<void>;
  updateProfile: (data: Partial<StudentProfile>) => Promise<void>;
  switchDemoUser: (studentId: string) => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<StudentProfile | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const initAuth = async () => {
      try {
        const current = await dataService.getCurrentUser();
        setUser(current);
      } catch (err) {
        console.error('Failed to load user:', err);
      } finally {
        setLoading(false);
      }
    };
    initAuth();
  }, []);

  const signIn = async (regNo: string, password: string) => {
    const res = await dataService.signIn(regNo, password);
    if (res.user) {
      setUser(res.user);
      return { success: true };
    }
    return { success: false, error: res.error };
  };

  const signUp = async (data: {
    reg_no: string;
    password: string;
    full_name: string;
    branch: Branch;
    academic_year: AcademicYear;
    section: string;
  }) => {
    const res = await dataService.signUp(data);
    if (res.user) {
      setUser(res.user);
      return { success: true };
    }
    return { success: false, error: res.error };
  };

  const signOut = async () => {
    await dataService.signOut();
    setUser(null);
  };

  const updateProfile = async (data: Partial<StudentProfile>) => {
    if (!user) return;
    const updated = await dataService.updateProfile(user.id, data);
    setUser(updated);
  };

  const switchDemoUser = async (studentId: string) => {
    const target = INITIAL_STUDENTS.find((s: StudentProfile) => s.id === studentId);
    if (target) {
      await dataService.signIn(target.reg_no, 'password123');
      const updated = await dataService.getCurrentUser();
      setUser(updated);
    }
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        loading,
        isLiveSupabase: dataService.isLiveSupabase(),
        signIn,
        signUp,
        signOut,
        updateProfile,
        switchDemoUser,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within an AuthProvider');
  return ctx;
};
