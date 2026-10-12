import React, { useState } from 'react';
import { 
  User, 
  ShieldCheck, 
  Eye, 
  EyeOff, 
  Save, 
  CheckCircle2, 
  Lock, 
  Info,
  GraduationCap
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { Branch, AcademicYear } from '../types';

export const ProfileSettingsPage: React.FC = () => {
  const { user, updateProfile } = useAuth();
  
  const [fullName, setFullName] = useState(user?.full_name || '');
  const [branch, setBranch] = useState<Branch>(user?.branch || 'CSE');
  const [academicYear, setAcademicYear] = useState<AcademicYear>(user?.academic_year || '3rd Year');
  const [section, setSection] = useState(user?.section || '');
  const [phoneVisible, setPhoneVisible] = useState(user?.phone_visible || false);

  const [saving, setSaving] = useState(false);
  const [success, setSuccess] = useState(false);

  if (!user) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setSuccess(false);

    try {
      await updateProfile({
        full_name: fullName.trim(),
        branch,
        academic_year: academicYear,
        section: section.trim(),
        phone_visible: phoneVisible,
      });
      setSuccess(true);
      setTimeout(() => setSuccess(false), 3000);
    } catch (err) {
      alert('Failed to save profile changes.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8 animate-fade-in">
      
      {/* Title */}
      <div className="space-y-1">
        <h1 className="text-2xl sm:text-3xl font-extrabold text-navy-950">
          Profile & Privacy Preferences
        </h1>
        <p className="text-xs text-slate-500">
          Manage your SRM AP student identity and cohort visibility settings
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        
        {/* Left Form: Profile Settings */}
        <div className="md:col-span-2 bg-white rounded-3xl border border-slate-200 p-6 sm:p-8 shadow-card space-y-6">
          {success && (
            <div className="p-3.5 text-xs bg-emerald-50 text-emerald-800 border border-emerald-200 rounded-xl flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
              <span>Profile preferences successfully saved!</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                SRMAP Registration Number (Permanent)
              </label>
              <div className="p-3 rounded-xl bg-slate-100 font-mono text-xs text-slate-700 font-bold border border-slate-200 flex items-center justify-between">
                <span>{user.reg_no}</span>
                <span className="text-[10px] uppercase font-semibold text-slate-400">Locked to Account</span>
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Full Name / Chosen Display Name *
              </label>
              <input
                type="text"
                value={fullName}
                onChange={e => setFullName(e.target.value)}
                className="w-full text-xs p-3 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-navy-700 font-medium"
                required
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Branch
                </label>
                <select
                  value={branch}
                  onChange={e => setBranch(e.target.value as Branch)}
                  className="w-full text-xs p-2.5 rounded-xl border border-slate-200 bg-white focus:outline-none focus:ring-2 focus:ring-navy-700"
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
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Academic Year
                </label>
                <select
                  value={academicYear}
                  onChange={e => setAcademicYear(e.target.value as AcademicYear)}
                  className="w-full text-xs p-2.5 rounded-xl border border-slate-200 bg-white focus:outline-none focus:ring-2 focus:ring-navy-700"
                >
                  <option value="1st Year">1st Year</option>
                  <option value="2nd Year">2nd Year</option>
                  <option value="3rd Year">3rd Year</option>
                  <option value="4th Year">4th Year</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Section
                </label>
                <input
                  type="text"
                  value={section}
                  onChange={e => setSection(e.target.value)}
                  className="w-full text-xs p-2.5 rounded-xl border border-slate-200 uppercase focus:outline-none focus:ring-2 focus:ring-navy-700"
                  required
                />
              </div>
            </div>

            {/* Privacy toggle */}
            <div className="pt-4 border-t border-slate-100">
              <label className="block text-xs font-semibold text-slate-700 mb-2">
                Registration Number Cohort Visibility
              </label>
              <div
                onClick={() => setPhoneVisible(!phoneVisible)}
                className={`p-4 rounded-2xl border cursor-pointer transition-all flex items-start gap-3.5 ${
                  phoneVisible
                    ? 'border-navy-900 bg-navy-50/50'
                    : 'border-slate-200 bg-slate-50/50 hover:bg-slate-100/50'
                }`}
              >
                <div className="mt-0.5">
                  {phoneVisible ? (
                    <Eye className="w-5 h-5 text-navy-900" />
                  ) : (
                    <EyeOff className="w-5 h-5 text-slate-400" />
                  )}
                </div>
                <div className="flex-1">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-navy-950">
                      {phoneVisible ? 'Full Registration Number Visible' : 'Masked Registration Number (Default)'}
                    </span>
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded ${
                      phoneVisible ? 'bg-navy-900 text-white' : 'bg-slate-200 text-slate-600'
                    }`}>
                      {phoneVisible ? 'Public in Cohort' : 'Masked'}
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-500 mt-1 leading-relaxed">
                    When masked, other students see your reg no as <span className="font-mono font-semibold">AP21110*****5</span> to preserve privacy while confirming you are a legitimate campus classmate.
                  </p>
                </div>
              </div>
            </div>

            <div className="flex justify-end pt-3">
              <button
                type="submit"
                disabled={saving}
                className="px-6 py-2.5 text-xs font-bold text-white bg-navy-900 hover:bg-navy-800 disabled:opacity-50 rounded-xl transition-all shadow-sm flex items-center gap-2"
              >
                <Save className="w-4 h-4 text-amber-300" />
                <span>{saving ? 'Saving...' : 'Save Preferences'}</span>
              </button>
            </div>
          </form>
        </div>

        {/* Right Info: Privacy Transparency Card */}
        <div className="space-y-4">
          <div className="bg-white rounded-3xl border border-slate-200 p-6 shadow-subtle space-y-4">
            <div className="w-10 h-10 rounded-xl bg-emerald-100 text-emerald-800 flex items-center justify-center">
              <ShieldCheck className="w-6 h-6 text-emerald-700" />
            </div>
            <h3 className="text-sm font-bold text-navy-950">
              Student Privacy Guarantee
            </h3>
            <ul className="text-xs text-slate-600 space-y-2.5 leading-relaxed">
              <li className="flex items-start gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 shrink-0 mt-1.5" />
                <span><strong>No Images Retained:</strong> Hall ticket scans are processed strictly in RAM and discarded immediately.</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 shrink-0 mt-1.5" />
                <span><strong>Row Level Security:</strong> You can only edit your own exam records.</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 shrink-0 mt-1.5" />
                <span><strong>No Personal Info:</strong> No DOB, photos, parent names, or personal mobile numbers are ever collected.</span>
              </li>
            </ul>
          </div>

          <div className="p-4 rounded-2xl bg-slate-100 border border-slate-200 text-slate-500 text-[11px] leading-relaxed">
            <p className="font-semibold text-slate-700 mb-1">SRM DEALINGS Community</p>
            An autonomous student initiative at SRM University–AP to assist peers with NPTEL exam travel and cohort coordination.
          </div>
        </div>
      </div>
    </div>
  );
};
