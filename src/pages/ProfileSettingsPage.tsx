import React, { useState, useEffect } from 'react';
import {
  CheckCircle2,
  Save,
  LogOut,
  User,
  AlertCircle,
  MessageCircle,
  Mail,
  HelpCircle,
  ExternalLink
} from 'lucide-react';
import { InstagramIcon } from '../components/InstagramIcon';
import { useAuth } from '../context/AuthContext';
import { Branch, AcademicYear } from '../types';

export const ProfileSettingsPage: React.FC = () => {
  const { user, updateProfile, signOut } = useAuth();

  const [fullName, setFullName] = useState(user?.full_name || '');
  const [branch, setBranch] = useState<Branch>(user?.branch || 'CSE');
  const [academicYear, setAcademicYear] = useState<AcademicYear>(user?.academic_year || '3rd Year');
  const [section, setSection] = useState(user?.section || '');

  const [saving, setSaving] = useState(false);
  const [success, setSuccess] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Synchronize local form fields with current authenticated user profile
  useEffect(() => {
    if (user) {
      setFullName(user.full_name || '');
      setBranch(user.branch || 'CSE');
      setAcademicYear(user.academic_year || '3rd Year');
      setSection(user.section || '');
    }
  }, [user]);

  if (!user) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanName = fullName.trim();
    const cleanSection = section.trim().toUpperCase();

    if (cleanName.length < 2) {
      setErrorMessage('Full name must be at least 2 characters.');
      return;
    }

    if (cleanSection.length < 1) {
      setErrorMessage('Section cannot be empty (e.g. CSE A or A).');
      return;
    }

    setSaving(true);
    setSuccess(false);
    setErrorMessage(null);

    try {
      await updateProfile({
        full_name: cleanName,
        branch,
        academic_year: academicYear,
        section: cleanSection,
      });
      setSuccess(true);
      setTimeout(() => setSuccess(false), 3500);
    } catch (err: any) {
      // Retain last confirmed profile data on error and display clear message
      setErrorMessage(err.message || 'Failed to save profile changes. Please try again.');
      setSuccess(false);
      if (user) {
        setFullName(user.full_name || '');
        setBranch(user.branch || 'CSE');
        setAcademicYear(user.academic_year || '3rd Year');
        setSection(user.section || '');
      }
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="max-w-xl mx-auto px-3.5 sm:px-6 py-6 sm:py-10 space-y-6 animate-fade-in">

      {/* Title */}
      <div className="space-y-1">
        <h1 className="text-xl sm:text-2xl font-bold text-white tracking-tight flex items-center gap-2">
          <User className="w-5 h-5 sm:w-6 sm:h-6 text-brand-accent shrink-0" />
          <span>Profile & Account</span>
        </h1>
        <p className="text-xs text-subtle-text">
          Manage your student profile details
        </p>
      </div>

      <div className="bg-dark-800 border border-subtle-border rounded-2xl p-5 sm:p-7 shadow-card space-y-5">
        {errorMessage && (
          <div className="p-3 text-xs bg-rose-500/10 text-rose-300 border border-rose-500/20 rounded-xl flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0 text-rose-400" />
              <span>{errorMessage}</span>
            </div>
            <button
              type="button"
              onClick={() => setErrorMessage(null)}
              className="text-[11px] underline hover:text-white shrink-0"
            >
              Dismiss
            </button>
          </div>
        )}

        {success && (
          <div className="p-3 text-xs bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 rounded-xl flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 shrink-0" />
            <span>Profile successfully updated.</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-slate-300 mb-1">
              Registration Number (Permanent)
            </label>
            <div className="px-3.5 py-2.5 rounded-xl bg-dark-850 border border-subtle-border text-xs font-mono text-slate-300">
              {user.reg_no}
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-300 mb-1">
              Display Name *
            </label>
            <input
              type="text"
              value={fullName}
              onChange={e => setFullName(e.target.value)}
              className="w-full text-xs px-3.5 py-2.5 rounded-xl bg-dark-850 border border-subtle-border text-white focus:outline-none focus:border-brand-violet"
              required
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
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
                <option value="DATA_SCIENCE">Data Science</option>
                <option value="CYBER_SECURITY">Cyber Security</option>
                <option value="MECH">Mechanical</option>
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
                className="w-full text-xs uppercase px-2.5 py-2 rounded-xl bg-dark-850 border border-subtle-border text-white focus:outline-none focus:border-brand-violet"
                required
              />
            </div>
          </div>

          <div className="flex items-center justify-between pt-4 border-t border-white/5">
            <button
              type="button"
              onClick={() => signOut()}
              className="flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-rose-400 hover:text-rose-300 hover:bg-rose-500/10 rounded-xl transition-colors"
            >
              <LogOut className="w-3.5 h-3.5" />
              <span>Log Out</span>
            </button>

            <button
              type="submit"
              disabled={saving}
              className="inline-flex items-center gap-1.5 px-5 py-2 text-xs font-semibold text-white bg-brand-violet hover:bg-purple-700 disabled:opacity-50 rounded-xl transition-all shadow-glow"
            >
              <Save className="w-3.5 h-3.5" />
              <span>{saving ? 'Saving...' : 'Save Profile'}</span>
            </button>
          </div>
        </form>
      </div>

      {/* Official SRM DEALINGS Contact & Help Section */}
      <div className="bg-dark-800 border border-subtle-border rounded-2xl p-6 shadow-card space-y-4">
        <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-brand-accent">
          <HelpCircle className="w-4 h-4 text-brand-purple" />
          <span>Report a Bug / Get Help</span>
        </div>

        <p className="text-xs text-subtle-text leading-relaxed">
          Need assistance or want to report an issue with course matching or slot discovery? Reach out to the student community team via official SRM DEALINGS channels:
        </p>

        <div className="space-y-2.5 pt-1">
          <a
            href="mailto:srmdealings@gmail.com"
            className="flex items-center justify-between p-3 rounded-xl bg-dark-850 border border-subtle-border hover:border-rose-500/30 group transition-all"
          >
            <div className="flex items-center gap-2.5">
              <div className="w-7 h-7 rounded-lg bg-rose-500/10 text-rose-400 flex items-center justify-center">
                <Mail className="w-3.5 h-3.5" />
              </div>
              <div>
                <p className="text-xs font-semibold text-white group-hover:text-rose-300 transition-colors">
                  Contact us via Gmail
                </p>
                <p className="text-[11px] text-subtle-text font-mono">srmdealings@gmail.com</p>
              </div>
            </div>
            <ExternalLink className="w-3.5 h-3.5 text-subtle-text group-hover:text-white transition-colors" />
          </a>

          <a
            href="https://www.instagram.com/srm_dealings?stkn=ajV0ZHYxcDFqNXM4"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center justify-between p-3 rounded-xl bg-dark-850 border border-subtle-border hover:border-purple-500/30 group transition-all"
          >
            <div className="flex items-center gap-2.5">
              <div className="w-7 h-7 rounded-lg bg-purple-500/10 text-purple-400 flex items-center justify-center">
                <InstagramIcon className="w-3.5 h-3.5" />
              </div>
              <div>
                <p className="text-xs font-semibold text-white group-hover:text-purple-300 transition-colors">
                  Follow or DM us on Instagram
                </p>
                <p className="text-[11px] text-subtle-text font-mono">@srm_dealings</p>
              </div>
            </div>
            <ExternalLink className="w-3.5 h-3.5 text-subtle-text group-hover:text-white transition-colors" />
          </a>

          <a
            href="https://whatsapp.com/channel/0029VbD55TuKgsNucd0Ycf2e"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center justify-between p-3 rounded-xl bg-dark-850 border border-subtle-border hover:border-emerald-500/30 group transition-all"
          >
            <div className="flex items-center gap-2.5">
              <div className="w-7 h-7 rounded-lg bg-emerald-500/10 text-emerald-400 flex items-center justify-center">
                <MessageCircle className="w-3.5 h-3.5" />
              </div>
              <div>
                <p className="text-xs font-semibold text-white group-hover:text-emerald-300 transition-colors">
                  Follow us on WhatsApp
                </p>
                <p className="text-[11px] text-subtle-text">Official announcements channel</p>
              </div>
            </div>
            <ExternalLink className="w-3.5 h-3.5 text-subtle-text group-hover:text-white transition-colors" />
          </a>
        </div>
      </div>
    </div>
  );
};
