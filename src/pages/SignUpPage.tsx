import React, { useState } from 'react';
import { UserPlus, GraduationCap, AlertCircle, ArrowRight, ShieldCheck } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
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
      setError('Please enter your full name or chosen display name.');
      return;
    }
    if (password.length < 6) {
      setError('Password must be at least 6 characters long.');
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
      setError('Please accept community guidelines and privacy policy.');
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
        setError(res.error || 'Failed to create account.');
      }
    } catch (err: any) {
      setError(err.message || 'Error occurred during registration.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-[85vh] flex items-center justify-center p-4 bg-slate-50">
      <div className="bg-white rounded-3xl max-w-lg w-full p-8 shadow-card border border-slate-200/80 space-y-6">
        
        {/* Header */}
        <div className="text-center space-y-2">
          <div className="w-12 h-12 rounded-2xl bg-navy-900 text-white mx-auto flex items-center justify-center shadow-md">
            <UserPlus className="w-6 h-6 text-amber-300" />
          </div>
          <h2 className="text-2xl font-extrabold text-navy-950">Student Registration</h2>
          <p className="text-xs text-slate-500">
            Join the SRM DEALINGS NPTEL buddy network
          </p>
        </div>

        {error && (
          <div className="p-3.5 text-xs bg-rose-50 text-rose-700 border border-rose-200 rounded-xl flex items-start gap-2">
            <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
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
                className="w-full text-xs font-mono uppercase p-2.5 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-navy-700"
                required
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Display Name / Full Name *
              </label>
              <input
                type="text"
                value={fullName}
                onChange={e => {
                  setFullName(e.target.value);
                  if (error) setError(null);
                }}
                placeholder="e.g. Karthik Varma"
                className="w-full text-xs p-2.5 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-navy-700 font-medium"
                required
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Branch *
              </label>
              <select
                value={branch}
                onChange={e => setBranch(e.target.value as Branch)}
                className="w-full text-xs p-2.5 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-navy-700 bg-white"
              >
                <option value="CSE">CSE</option>
                <option value="ECE">ECE</option>
                <option value="EEE">EEE</option>
                <option value="AI_ML">AI & ML</option>
                <option value="DATA_SCIENCE">Data Science</option>
                <option value="CYBER_SECURITY">Cyber Security</option>
                <option value="MECH">Mechanical</option>
                <option value="CIVIL">Civil</option>
                <option value="OTHER">Other Branch</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Academic Year *
              </label>
              <select
                value={academicYear}
                onChange={e => setAcademicYear(e.target.value as AcademicYear)}
                className="w-full text-xs p-2.5 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-navy-700 bg-white"
              >
                <option value="1st Year">1st Year</option>
                <option value="2nd Year">2nd Year</option>
                <option value="3rd Year">3rd Year</option>
                <option value="4th Year">4th Year</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Section *
              </label>
              <input
                type="text"
                value={section}
                onChange={e => setSection(e.target.value)}
                placeholder="CSE-A"
                className="w-full text-xs uppercase p-2.5 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-navy-700"
                required
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Password *
              </label>
              <input
                type="password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                placeholder="Min 6 characters"
                className="w-full text-xs p-2.5 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-navy-700"
                required
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Confirm Password *
              </label>
              <input
                type="password"
                value={confirmPassword}
                onChange={e => setConfirmPassword(e.target.value)}
                placeholder="Re-enter password"
                className="w-full text-xs p-2.5 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-navy-700"
                required
              />
            </div>
          </div>

          {/* Privacy & Guidelines Checkbox */}
          <div className="flex items-start gap-2.5 pt-1">
            <input
              type="checkbox"
              id="consent"
              checked={consent}
              onChange={e => setConsent(e.target.checked)}
              className="mt-1 rounded text-navy-900 focus:ring-navy-700"
            />
            <label htmlFor="consent" className="text-[11px] text-slate-600 leading-normal">
              I am an enrolled student at SRM University–AP. I agree to keep community WhatsApp groups respectful and adhere to student privacy norms.
            </label>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full py-3 text-xs font-bold text-white bg-navy-900 hover:bg-navy-800 disabled:opacity-50 rounded-xl transition-all shadow-md flex items-center justify-center gap-2"
          >
            {loading ? (
              <span>Creating Account...</span>
            ) : (
              <>
                <span>Complete Registration</span>
                <ArrowRight className="w-4 h-4 text-amber-300" />
              </>
            )}
          </button>
        </form>

        <div className="text-center pt-2 border-t border-slate-100">
          <p className="text-xs text-slate-500">
            Already registered?{' '}
            <button
              onClick={onGoToSignIn}
              className="font-bold text-navy-900 hover:underline"
            >
              Sign In
            </button>
          </p>
        </div>
      </div>
    </div>
  );
};
