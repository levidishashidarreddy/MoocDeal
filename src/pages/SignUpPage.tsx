import React, { useState } from 'react';
import { UserPlus, Layers, AlertCircle, ArrowRight } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { BrandedLogo } from '../components/BrandedLogo';
import { Branch, AcademicYear } from '../types';

interface SignUpPageProps {
  onGoToSignIn: () => void;
  onSuccess: () => void;
}

export const SignUpPage: React.FC<SignUpPageProps> = ({ onGoToSignIn, onSuccess }) => {
  const { signUp } = useAuth();
  const [regNo, setRegNo] = useState('');
  const [fullName, setFullName] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [branch, setBranch] = useState<Branch>('CSE');
  const [academicYear, setAcademicYear] = useState<AcademicYear>('3rd Year');
  const [section, setSection] = useState('');
  const [consent, setConsent] = useState(true);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!regNo.trim()) {
      setError('Please provide your SRMAP registration number.');
      return;
    }
    if (!fullName.trim()) {
      setError('Please enter your full name or display name.');
      return;
    }
    if (password.length < 4) {
      setError('Password or PIN must be at least 4 digits or characters.');
      return;
    }
    if (password !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }
    if (!section.trim()) {
      setError('Please provide your section (e.g. CSE-A or B).');
      return;
    }
    if (!consent) {
      setError('Please accept community guidelines.');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const res = await signUp({
        reg_no: regNo.trim(),
        full_name: fullName.trim(),
        password,
        branch,
        academic_year: academicYear,
        section: section.trim(),
      });

      if (res.success) {
        onSuccess();
      } else {
        setError(res.error || 'Failed to create student account.');
      }
    } catch (err: any) {
      setError(err.message || 'Error occurred during registration.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-[85vh] flex items-center justify-center px-3.5 py-8 sm:py-12 animate-fade-in">
      <div className="w-full max-w-md bg-dark-800 border border-subtle-border rounded-2xl p-5 sm:p-7 shadow-card space-y-6">

        {/* Header */}
        <div className="text-center space-y-2">
          <BrandedLogo size="lg" className="mx-auto" />
          <h2 className="text-lg sm:text-xl font-bold text-white tracking-tight">Create MoocDeal Account</h2>
          <p className="text-xs text-subtle-text">
            Join fellow SRM AP students for MOOC & exam buddy discovery
          </p>
        </div>

        {error && (
          <div className="p-3 text-xs bg-rose-500/10 border border-rose-500/20 text-rose-300 rounded-xl flex items-start gap-2">
            <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-rose-400" />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1">
                Registration Number *
              </label>
              <input
                type="text"
                value={regNo}
                onChange={e => {
                  setRegNo(e.target.value);
                  if (error) setError(null);
                }}
                placeholder="AP21110010145"
                className="w-full text-xs font-mono uppercase px-3 py-2.5 rounded-xl bg-dark-850 border border-subtle-border text-white placeholder-slate-500 focus:outline-none focus:border-brand-violet min-h-[42px]"
                required
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1">
                Display Name *
              </label>
              <input
                type="text"
                value={fullName}
                onChange={e => {
                  setFullName(e.target.value);
                  if (error) setError(null);
                }}
                placeholder="e.g. Karthik Varma"
                className="w-full text-xs px-3 py-2.5 rounded-xl bg-dark-850 border border-subtle-border text-white placeholder-slate-500 focus:outline-none focus:border-brand-violet min-h-[42px]"
                required
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1">Branch</label>
              <select
                value={branch}
                onChange={e => setBranch(e.target.value as Branch)}
                className="w-full text-xs px-2.5 py-2 rounded-xl bg-dark-850 border border-subtle-border text-white focus:outline-none focus:border-brand-violet"
              >
                <option value="CSE">CSE</option>
                <option value="ECE">ECE</option>
                <option value="EEE">EEE</option>
                <option value="AI_ML">AI & ML</option>
                <option value="DATA_SCIENCE">Data Sci</option>
                <option value="CYBER_SECURITY">Cyber</option>
                <option value="MECH">Mech</option>
                <option value="CIVIL">Civil</option>
                <option value="OTHER">Other</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1">Year</label>
              <select
                value={academicYear}
                onChange={e => setAcademicYear(e.target.value as AcademicYear)}
                className="w-full text-xs px-2.5 py-2 rounded-xl bg-dark-850 border border-subtle-border text-white focus:outline-none focus:border-brand-violet"
              >
                <option value="1st Year">1st Year</option>
                <option value="2nd Year">2nd Year</option>
                <option value="3rd Year">3rd Year</option>
                <option value="4th Year">4th Year</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1">Section</label>
              <input
                type="text"
                value={section}
                onChange={e => setSection(e.target.value)}
                placeholder="CSE-A"
                className="w-full text-xs uppercase px-2.5 py-2 rounded-xl bg-dark-850 border border-subtle-border text-white placeholder-slate-500 focus:outline-none focus:border-brand-violet"
                required
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1">Password *</label>
              <input
                type="password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                placeholder="Min 4 digits or characters"
                className="w-full text-xs px-3 py-2 rounded-xl bg-dark-850 border border-subtle-border text-white placeholder-slate-500 focus:outline-none focus:border-brand-violet"
                required
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1">Confirm Password *</label>
              <input
                type="password"
                value={confirmPassword}
                onChange={e => setConfirmPassword(e.target.value)}
                placeholder="Re-enter password"
                className="w-full text-xs px-3 py-2 rounded-xl bg-dark-850 border border-subtle-border text-white placeholder-slate-500 focus:outline-none focus:border-brand-violet"
                required
              />
            </div>
          </div>

          <div className="flex items-start gap-2 pt-1">
            <input
              type="checkbox"
              id="consent"
              checked={consent}
              onChange={e => setConsent(e.target.checked)}
              className="mt-0.5 rounded bg-dark-850 border-subtle-border text-brand-violet focus:ring-brand-violet"
            />
            <label htmlFor="consent" className="text-[11px] text-subtle-text leading-tight">
              I am an enrolled student at SRM University–AP and agree to respectful community conduct.
            </label>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full py-2.5 text-xs font-semibold text-white bg-brand-violet hover:bg-purple-700 disabled:opacity-50 rounded-xl transition-all shadow-glow flex items-center justify-center gap-2"
          >
            {loading ? (
              <span>Creating Account...</span>
            ) : (
              <>
                <span>Complete Registration</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </>
            )}
          </button>
        </form>

        <div className="text-center pt-2 border-t border-white/5">
          <p className="text-xs text-subtle-text">
            Already registered?{' '}
            <button
              onClick={onGoToSignIn}
              className="font-medium text-brand-accent hover:underline"
            >
              Sign In
            </button>
          </p>
        </div>
      </div>
    </div>
  );
};
