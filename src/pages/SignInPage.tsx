import React, { useState } from 'react';
import { LogIn, Layers, AlertCircle, CheckCircle2, ArrowRight } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { BrandedLogo } from '../components/BrandedLogo';

interface SignInPageProps {
  onGoToSignUp: () => void;
  onSuccess: () => void;
}

export const SignInPage: React.FC<SignInPageProps> = ({ onGoToSignUp, onSuccess }) => {
  const { signIn, requestPasswordReset } = useAuth();
  const [regNo, setRegNo] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Account Recovery Modal
  const [showRecovery, setShowRecovery] = useState(false);
  const [recoveryRegNo, setRecoveryRegNo] = useState('');
  const [recoveryLoading, setRecoveryLoading] = useState(false);
  const [recoveryMessage, setRecoveryMessage] = useState<string | null>(null);
  const [recoveryError, setRecoveryError] = useState<string | null>(null);

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
        setError(res.error || 'Invalid credentials.');
      }
    } catch (err: any) {
      setError(err.message || 'An error occurred during sign in.');
    } finally {
      setLoading(false);
    }
  };

  const handleAccountRecovery = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!recoveryRegNo.trim()) {
      setRecoveryError('Please enter your registration number.');
      return;
    }
    setRecoveryLoading(true);
    setRecoveryError(null);
    setRecoveryMessage(null);
    try {
      const res = await requestPasswordReset(recoveryRegNo.trim());
      if (res.success) {
        setRecoveryMessage(res.message || 'Password reset link sent to your institutional mailbox.');
      } else {
        setRecoveryError(res.error || 'Failed to send recovery instructions.');
      }
    } catch (err: any) {
      setRecoveryError(err.message || 'Failed to process account recovery.');
    } finally {
      setRecoveryLoading(false);
    }
  };

  return (
    <div className="min-h-[80vh] flex items-center justify-center px-3.5 py-8 sm:py-12 animate-fade-in">
      <div className="w-full max-w-sm bg-dark-800 border border-subtle-border rounded-2xl p-5 sm:p-7 shadow-card space-y-6">

        {/* Header */}
        <div className="text-center space-y-2">
          <BrandedLogo size="lg" className="mx-auto" />
          <h2 className="text-lg sm:text-xl font-bold text-white tracking-tight">Sign In to MoocDeal</h2>
          <p className="text-xs text-subtle-text">
            Enter your SRMAP registration number and password
          </p>
        </div>

        {error && (
          <div className="p-3 text-xs bg-rose-500/10 border border-rose-500/20 text-rose-300 rounded-xl flex items-start gap-2">
            <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-rose-400" />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-slate-300 mb-1.5">
              Registration Number
            </label>
            <input
              type="text"
              value={regNo}
              onChange={e => {
                setRegNo(e.target.value);
                if (error) setError(null);
              }}
              placeholder="e.g. AP21110010145"
              className="w-full text-xs font-mono uppercase px-3.5 py-2.5 rounded-xl bg-dark-850 border border-subtle-border text-white placeholder-slate-500 focus:outline-none focus:border-brand-violet min-h-[42px]"
              required
            />
          </div>

          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="block text-xs font-medium text-slate-300">
                Password
              </label>
              <button
                type="button"
                onClick={() => {
                  setRecoveryRegNo(regNo);
                  setShowRecovery(true);
                }}
                className="text-[11px] text-brand-accent hover:underline py-0.5"
              >
                Forgot Password?
              </button>
            </div>
            <input
              type="password"
              value={password}
              onChange={e => {
                setPassword(e.target.value);
                if (error) setError(null);
              }}
              placeholder="••••••••"
              className="w-full text-xs px-3.5 py-2.5 rounded-xl bg-dark-850 border border-subtle-border text-white placeholder-slate-500 focus:outline-none focus:border-brand-violet min-h-[42px]"
              required
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full py-3 text-xs font-semibold text-white bg-brand-violet hover:bg-purple-700 disabled:opacity-50 rounded-xl transition-all shadow-glow flex items-center justify-center gap-2 min-h-[44px]"
          >
            {loading ? (
              <span>Authenticating...</span>
            ) : (
              <>
                <LogIn className="w-3.5 h-3.5" />
                <span>Sign In</span>
              </>
            )}
          </button>
        </form>

        <div className="text-center pt-2 border-t border-white/5">
          <p className="text-xs text-subtle-text">
            Don't have an account?{' '}
            <button
              onClick={onGoToSignUp}
              className="font-medium text-brand-accent hover:underline py-1"
            >
              Create Account
            </button>
          </p>
        </div>
      </div>

      {/* Account Recovery Modal */}
      {showRecovery && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-fade-in">
          <div className="bg-dark-800 border border-subtle-border rounded-2xl max-w-sm w-full p-6 space-y-4 shadow-card">
            <h3 className="text-sm font-bold text-white">Account Recovery</h3>
            <p className="text-xs text-subtle-text leading-relaxed">
              Enter your SRM AP registration number to receive password reset instructions at your official student email.
            </p>

            {recoveryMessage && (
              <div className="p-3 text-xs bg-emerald-500/10 border border-emerald-500/20 text-emerald-300 rounded-xl flex items-start gap-2">
                <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5 text-emerald-400" />
                <span>{recoveryMessage}</span>
              </div>
            )}

            {recoveryError && (
              <div className="p-3 text-xs bg-rose-500/10 border border-rose-500/20 text-rose-300 rounded-xl flex items-start gap-2">
                <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-rose-400" />
                <span>{recoveryError}</span>
              </div>
            )}

            <form onSubmit={handleAccountRecovery} className="space-y-3">
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">
                  Registration Number
                </label>
                <input
                  type="text"
                  value={recoveryRegNo}
                  onChange={e => {
                    setRecoveryRegNo(e.target.value);
                    if (recoveryError) setRecoveryError(null);
                    if (recoveryMessage) setRecoveryMessage(null);
                  }}
                  placeholder="AP21110010145"
                  className="w-full text-xs font-mono uppercase px-3 py-2 rounded-xl bg-dark-850 border border-subtle-border text-white focus:outline-none focus:border-brand-violet"
                  required
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => {
                    setShowRecovery(false);
                    setRecoveryMessage(null);
                    setRecoveryError(null);
                  }}
                  className="px-3.5 py-1.5 text-xs text-subtle-text hover:text-white"
                >
                  Close
                </button>
                <button
                  type="submit"
                  disabled={recoveryLoading}
                  className="px-4 py-1.5 text-xs font-semibold text-white bg-brand-violet hover:bg-purple-700 disabled:opacity-50 rounded-xl transition-colors shadow-glow"
                >
                  {recoveryLoading ? 'Sending...' : 'Send Recovery Link'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
