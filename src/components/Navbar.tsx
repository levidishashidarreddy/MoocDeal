import React, { useState } from 'react';
import { 
  Compass, 
  MapPin, 
  BookOpen, 
  User, 
  Shield, 
  LogOut, 
  Menu, 
  X, 
  ShieldCheck, 
  GraduationCap,
  Sparkles
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { DemoUserSwitcher } from './DemoUserSwitcher';
import { PrivacyNoticeModal } from './PrivacyNoticeModal';

interface NavbarProps {
  activeTab: string;
  setActiveTab: (tab: string) => void;
  onOpenOnboarding: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({ activeTab, setActiveTab, onOpenOnboarding }) => {
  const { user, signOut, isLiveSupabase } = useAuth();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [privacyModalOpen, setPrivacyModalOpen] = useState(false);

  const navItems = [
    { id: 'dashboard', label: 'My Exams', icon: Compass },
    { id: 'centre-matches', label: 'Same Centre & Time', icon: MapPin },
    { id: 'course-matches', label: 'Same Course Buddies', icon: BookOpen },
    ...(user?.is_admin ? [{ id: 'admin', label: 'Admin Portal', icon: Shield }] : []),
  ];

  return (
    <>
      {/* Top Banner for Supabase/Demo Status & Community Attribution */}
      <div className="bg-navy-950 text-slate-300 text-[11px] py-1.5 px-4 border-b border-navy-800 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-semibold bg-navy-800 text-amber-300 border border-navy-700">
            SRM DEALINGS
          </span>
          <span className="hidden sm:inline text-slate-400">
            Unofficial student cohort & buddy discovery platform for SRM University–AP
          </span>
        </div>
        <div className="flex items-center gap-3">
          <span className="inline-flex items-center gap-1">
            <span className={`w-2 h-2 rounded-full ${isLiveSupabase ? 'bg-emerald-400 animate-pulse' : 'bg-sky-400'}`} />
            <span className="text-[10px] text-slate-300">
              {isLiveSupabase ? 'Live Supabase' : 'University Sandbox Mode'}
            </span>
          </span>
          <button
            onClick={() => setPrivacyModalOpen(true)}
            className="text-[11px] text-slate-400 hover:text-white flex items-center gap-1 transition-colors"
          >
            <ShieldCheck className="w-3 h-3 text-emerald-400" />
            <span className="hidden md:inline">Privacy Notice</span>
          </button>
        </div>
      </div>

      {/* Main Navbar */}
      <header className="sticky top-0 z-40 bg-white/95 backdrop-blur-md border-b border-slate-200 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            {/* Brand Logo */}
            <div className="flex items-center gap-3 cursor-pointer" onClick={() => setActiveTab('dashboard')}>
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-navy-900 to-navy-700 text-white flex items-center justify-center shadow-md">
                <GraduationCap className="w-6 h-6 text-amber-300" />
              </div>
              <div>
                <div className="flex items-center gap-1.5">
                  <span className="text-base font-extrabold tracking-tight text-navy-950">
                    NPTEL Exam Buddy
                  </span>
                  <span className="text-[10px] uppercase font-bold px-1.5 py-0.5 rounded bg-navy-100 text-navy-800">
                    SRM AP
                  </span>
                </div>
                <p className="text-[10px] text-slate-500 font-medium">Exam Cohort & MOOC Study Group</p>
              </div>
            </div>

            {/* Desktop Navigation Links */}
            {user && (
              <nav className="hidden md:flex items-center gap-1">
                {navItems.map(item => {
                  const Icon = item.icon;
                  const isActive = activeTab === item.id;
                  return (
                    <button
                      key={item.id}
                      onClick={() => setActiveTab(item.id)}
                      className={`flex items-center gap-2 px-3.5 py-2 text-xs font-semibold rounded-xl transition-all ${
                        isActive
                          ? 'bg-navy-900 text-white shadow-sm'
                          : 'text-slate-600 hover:text-navy-900 hover:bg-slate-100'
                      }`}
                    >
                      <Icon className={`w-4 h-4 ${isActive ? 'text-amber-300' : 'text-slate-400'}`} />
                      <span>{item.label}</span>
                    </button>
                  );
                })}
              </nav>
            )}

            {/* Right Action Tools */}
            <div className="flex items-center gap-2.5">
              {user ? (
                <>
                  <button
                    onClick={onOpenOnboarding}
                    className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-emerald-700 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 rounded-xl transition-all shadow-sm"
                  >
                    <Sparkles className="w-3.5 h-3.5 text-emerald-600" />
                    <span>Upload Hall Ticket</span>
                  </button>

                  <DemoUserSwitcher />

                  {/* Profile Settings shortcut */}
                  <button
                    onClick={() => setActiveTab('profile')}
                    className={`p-2 rounded-xl border transition-all ${
                      activeTab === 'profile'
                        ? 'border-navy-900 bg-navy-50 text-navy-900'
                        : 'border-slate-200 text-slate-600 hover:bg-slate-100'
                    }`}
                    title="Profile & Privacy Settings"
                  >
                    <User className="w-4 h-4" />
                  </button>

                  <button
                    onClick={() => signOut()}
                    className="p-2 rounded-xl border border-slate-200 text-slate-500 hover:text-rose-600 hover:bg-rose-50 hover:border-rose-200 transition-all"
                    title="Sign Out"
                  >
                    <LogOut className="w-4 h-4" />
                  </button>

                  {/* Mobile hamburger */}
                  <button
                    onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
                    className="md:hidden p-2 text-slate-600 hover:bg-slate-100 rounded-xl"
                  >
                    {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
                  </button>
                </>
              ) : (
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setActiveTab('signin')}
                    className="px-4 py-2 text-xs font-semibold text-navy-900 hover:bg-slate-100 rounded-xl transition-colors"
                  >
                    Sign In
                  </button>
                  <button
                    onClick={() => setActiveTab('signup')}
                    className="px-4 py-2 text-xs font-semibold text-white bg-navy-900 hover:bg-navy-800 rounded-xl transition-colors shadow-sm"
                  >
                    Create Account
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Mobile dropdown menu */}
        {mobileMenuOpen && user && (
          <div className="md:hidden border-t border-slate-200 bg-white px-4 pt-2 pb-4 space-y-1 animate-fade-in">
            {navItems.map(item => {
              const Icon = item.icon;
              const isActive = activeTab === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => {
                    setActiveTab(item.id);
                    setMobileMenuOpen(false);
                  }}
                  className={`w-full flex items-center gap-2.5 px-3 py-2.5 text-xs font-semibold rounded-xl text-left ${
                    isActive ? 'bg-navy-900 text-white' : 'text-slate-700 hover:bg-slate-50'
                  }`}
                >
                  <Icon className="w-4 h-4" />
                  <span>{item.label}</span>
                </button>
              );
            })}
            <button
              onClick={() => {
                onOpenOnboarding();
                setMobileMenuOpen(false);
              }}
              className="w-full flex items-center gap-2.5 px-3 py-2.5 text-xs font-semibold text-emerald-800 bg-emerald-50 rounded-xl text-left"
            >
              <Sparkles className="w-4 h-4 text-emerald-600" />
              <span>Upload Hall Ticket (AI OCR)</span>
            </button>
            <button
              onClick={() => {
                setActiveTab('profile');
                setMobileMenuOpen(false);
              }}
              className="w-full flex items-center gap-2.5 px-3 py-2.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 rounded-xl text-left"
            >
              <User className="w-4 h-4" />
              <span>Profile & Privacy Settings</span>
            </button>
          </div>
        )}
      </header>

      <PrivacyNoticeModal
        isOpen={privacyModalOpen}
        onClose={() => setPrivacyModalOpen(false)}
      />
    </>
  );
};
