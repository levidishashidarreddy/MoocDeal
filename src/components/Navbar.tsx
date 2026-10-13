import React from 'react';
import {
  Compass,
  Users,
  LogOut
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { BrandedLogo } from './BrandedLogo';

interface NavbarProps {
  activeTab: string;
  setActiveTab: (tab: string) => void;
}

export const Navbar: React.FC<NavbarProps> = ({ activeTab, setActiveTab }) => {
  const { user, signOut } = useAuth();

  const handleTabClick = (tab: string) => {
    if (activeTab === tab) return; // Guard against rapid duplicate clicks
    setActiveTab(tab);
  };

  // Reusable Apple-inspired glass segmented control
  const renderSegmentedControl = (wrapperClasses: string = '') => (
    <nav
      className={`relative inline-flex items-center p-1 rounded-full bg-[#0c0d14]/90 backdrop-blur-2xl border border-white/[0.08] shadow-[0_4px_24px_rgba(0,0,0,0.45)] select-none transition-all ${wrapperClasses}`}
      aria-label="Main Navigation"
    >
      {/* Smooth sliding active-tab indicator pill */}
      <div
        className={`absolute top-1 bottom-1 w-[calc(50%-4px)] rounded-full bg-white/[0.12] border border-white/20 shadow-[0_2px_10px_rgba(0,0,0,0.35)] transition-all duration-300 ease-out pointer-events-none ${
          activeTab === 'find-buddies'
            ? 'left-[calc(50%+2px)]'
            : activeTab === 'dashboard'
            ? 'left-1'
            : 'opacity-0'
        }`}
        aria-hidden="true"
      />

      {/* Tab 1: My Exam */}
      <button
        type="button"
        onClick={() => handleTabClick('dashboard')}
        className={`relative z-10 flex-1 flex items-center justify-center gap-2 py-2 px-3 sm:px-5 rounded-full text-xs font-semibold transition-colors duration-200 min-h-[42px] sm:min-h-[38px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-violet ${
          activeTab === 'dashboard'
            ? 'text-white'
            : 'text-slate-400 hover:text-slate-200'
        }`}
        aria-current={activeTab === 'dashboard' ? 'page' : undefined}
      >
        <Compass className={`w-4 h-4 transition-colors shrink-0 ${activeTab === 'dashboard' ? 'text-brand-accent' : 'text-slate-400'}`} />
        <span className="truncate">My Exam</span>
      </button>

      {/* Tab 2: Find Buddies */}
      <button
        type="button"
        onClick={() => handleTabClick('find-buddies')}
        className={`relative z-10 flex-1 flex items-center justify-center gap-2 py-2 px-3 sm:px-5 rounded-full text-xs font-semibold transition-colors duration-200 min-h-[42px] sm:min-h-[38px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-violet ${
          activeTab === 'find-buddies'
            ? 'text-white'
            : 'text-slate-400 hover:text-slate-200'
        }`}
        aria-current={activeTab === 'find-buddies' ? 'page' : undefined}
      >
        <Users className={`w-4 h-4 transition-colors shrink-0 ${activeTab === 'find-buddies' ? 'text-brand-accent' : 'text-slate-400'}`} />
        <span className="truncate">Find Buddies</span>
      </button>
    </nav>
  );

  return (
    <header className="sticky top-0 z-40 bg-dark-900/90 backdrop-blur-xl border-b border-subtle-border/80">
      <div className="max-w-6xl mx-auto px-3.5 sm:px-6">
        <div className="flex items-center justify-between h-16">

          {/* Brand Logo & Community Identity */}
          <div
            className="flex items-center gap-2 cursor-pointer select-none group min-w-0"
            onClick={() => setActiveTab(user ? 'dashboard' : 'landing')}
            role="button"
            tabIndex={0}
            onKeyDown={(e) => e.key === 'Enter' && setActiveTab(user ? 'dashboard' : 'landing')}
          >
            <BrandedLogo size="sm" className="shrink-0" />
            <div className="flex items-baseline gap-1.5 truncate">
              <span className="text-sm sm:text-base font-bold tracking-tight text-white group-hover:text-slate-100 transition-colors">
                MoocDeal
              </span>
              <span className="text-[11px] sm:text-xs text-subtle-text font-normal truncate">
                - SRM DEALINGS
              </span>
            </div>
          </div>

          {/* Desktop Center Apple Glass Navigation Control */}
          {user && (
            <div className="hidden md:flex items-center justify-center">
              {renderSegmentedControl('w-[320px]')}
            </div>
          )}

          {/* Right Action Tools: Profile & Authentication */}
          <div className="flex items-center gap-2 shrink-0">
            {user ? (
              <>
                <button
                  type="button"
                  onClick={() => handleTabClick('profile')}
                  className={`flex items-center gap-2 px-2.5 sm:px-3 py-1.5 rounded-full text-xs font-medium border transition-all duration-200 min-h-[38px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-violet ${
                    activeTab === 'profile'
                      ? 'bg-white/10 border-brand-violet/60 text-white'
                      : 'bg-white/[0.04] border-white/[0.08] text-slate-300 hover:text-white hover:bg-white/[0.08]'
                  }`}
                  title="Profile settings"
                >
                  <div className="w-5 h-5 rounded-full bg-brand-violet/25 text-brand-accent flex items-center justify-center text-[10px] font-bold shrink-0">
                    {user.full_name ? user.full_name.charAt(0).toUpperCase() : 'U'}
                  </div>
                  <span className="hidden sm:inline max-w-[110px] truncate">{user.full_name}</span>
                </button>

                <button
                  type="button"
                  onClick={() => signOut()}
                  className="p-2 rounded-full bg-white/[0.04] border border-white/[0.08] text-subtle-text hover:text-rose-400 hover:border-rose-500/30 transition-all min-h-[38px] min-w-[38px] flex items-center justify-center focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-500"
                  title="Sign Out"
                >
                  <LogOut className="w-4 h-4" />
                </button>
              </>
            ) : (
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setActiveTab('signin')}
                  className="px-3 py-1.5 text-xs font-medium text-slate-300 hover:text-white rounded-full transition-colors"
                >
                  Sign In
                </button>
                <button
                  type="button"
                  onClick={() => setActiveTab('signup')}
                  className="px-3.5 py-1.5 text-xs font-semibold text-white bg-brand-violet hover:bg-purple-700 rounded-full transition-all shadow-glow"
                >
                  Register
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Mobile Glass Segmented Control Bar (Prominently visible on mobile, zero hamburger clicks) */}
      {user && (
        <div className="md:hidden px-3.5 pb-2.5 pt-0.5 max-w-sm mx-auto w-full">
          {renderSegmentedControl('w-full')}
        </div>
      )}
    </header>
  );
};
