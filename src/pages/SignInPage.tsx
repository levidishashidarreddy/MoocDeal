import React, { useState } from 'react';
import { LogIn, Lock, GraduationCap, AlertCircle, ArrowRight, ShieldCheck, Zap } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { INITIAL_STUDENTS } from '../services/mockData';

interface SignInPageProps {
  onGoToSignUp: () => void;
  onSuccess: () => void;
}

export const SignInPage: React.FC<SignInPageProps> = ({ onGoToSignUp, onSuccess }) => {
  const { signIn, isLiveSupabase } = useAuth();
  const [regNo, setRegNo] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!regNo.trim()) {
      setError('Please enter your SRMAP registration number.');
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const res = await signIn(regNo.trim(), password);
      if (res.success) {
        onSuccess();
      } else {
        setError(res.error || 'Failed to sign in.');
      }
    } catch (err: any) {
      setError(err.message || 'An unexpected error occurred.');
    } finally {
      setLoading(false);
    }
  };

  const handleQuickDemoFill = (student: typeof INITIAL_STUDENTS[0]) => {
    setRegNo(student.reg_no);
    setPassword('password123');
    setError(null);
  };

  return (
    <div className="min-h-[85vh] flex items-center justify-center p-4 bg-slate-50">
      <div className="bg-white rounded-3xl max-w-md w-full p-8 shadow-card border border-slate-200/80 space-y-6">
        
        {/* Header */}
        <div className="text-center space-y-2">
          <div className="w-12 h-12 rounded-2xl bg-navy-900 text-white mx-auto flex items-center justify-center shadow-md">
            <GraduationCap className="w-7 h-7 text-amber-300" />
          </div>
          <h2 className="text-2xl font-extrabold text-navy-950">Student Sign In</h2>
          <p className="text-xs text-slate-500">
            Access your NPTEL exam cohort & study buddy listings
          </p>
        </div>

        {/* Demo Quick-Fill Pill Bar (Only in sandbox mode for convenience) */}
        {!isLiveSupabase && (
          <div className="p-3 rounded-2xl bg-navy-50/70 border border-navy-100 space-y-2">
            <div className="flex items-center justify-between text-[11px] font-semibold text-navy-900">
              <span className="flex items-center gap-1">
                <Zap className="w-3.5 h-3.5 text-amber-600" />
                Quick Test Student Accounts:
              </span>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {INITIAL_STUDENTS.slice(0, 3).map(s => (
                <button
                  key={s.id}
                  type="button"
                  onClick={() => handleQuickDemoFill(s)}
                  className="px-2 py-1 text-[10px] font-semibold bg-white hover:bg-navy-900 hover:text-white border border-slate-200 rounded-lg text-slate-700 transition-colors shadow-2xs"
                >
                  {s.full_name} {s.is_admin ? '(Admin)' : ''}
                </button>
              ))}
            </div>
          </div>
        )}

        {error && (
          <div className="p-3.5 text-xs bg-rose-50 text-rose-700 border border-rose-200 rounded-xl flex items-start gap-2">
            <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              SRMAP Registration Number
            </label>
            <input
              type="text"
              value={regNo}
              onChange={e => {
                setRegNo(e.target.value);
                if (error) setError(null);
              }}
              placeholder="e.g. AP21110010145"
              className="w-full text-xs font-mono uppercase p-3 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-navy-700"
              required
            />
            <p className="text-[10px] text-slate-400 mt-1">
              Standard SRMAP university registration format
            </p>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Password / Credential
            </label>
            <input
              type="password"
              value={password}
              onChange={e => {
                setPassword(e.target.value);
                if (error) setError(null);
              }}
              placeholder="••••••••"
              className="w-full text-xs p-3 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-navy-700"
              required
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full py-3 text-xs font-bold text-white bg-navy-900 hover:bg-navy-800 disabled:opacity-50 rounded-xl transition-all shadow-md flex items-center justify-center gap-2"
          >
            {loading ? (
              <span>Authenticating...</span>
            ) : (
              <>
                <LogIn className="w-4 h-4 text-amber-300" />
                <span>Sign In to Exam Buddy</span>
              </>
            )}
          </button>
        </form>

        {/* Footer switch to sign up */}
        <div className="text-center pt-2 border-t border-slate-100">
          <p className="text-xs text-slate-500">
            New student taking an NPTEL exam?{' '}
            <button
              onClick={onGoToSignUp}
              className="font-bold text-navy-900 hover:underline"
            >
              Create Account
            </button>
          </p>
        </div>
      </div>
    </div>
  );
};
