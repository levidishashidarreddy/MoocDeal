import React from 'react';
import {
  MapPin,
  BookOpen,
  ArrowRight,
  CheckCircle2,
  ShieldCheck,
  Layers
} from 'lucide-react';
import { BrandedLogo } from '../components/BrandedLogo';

interface LandingPageProps {
  onGoToSignIn: () => void;
  onGoToSignUp: () => void;
  onOpenPrivacyNotice: () => void;
}

export const LandingPage: React.FC<LandingPageProps> = ({
  onGoToSignIn,
  onGoToSignUp,
  onOpenPrivacyNotice,
}) => {
  return (
    <div className="min-h-[85vh] flex flex-col justify-center max-w-5xl mx-auto px-3.5 sm:px-6 py-10 sm:py-16 animate-fade-in space-y-10 sm:space-y-16">

      {/* Hero Section */}
      <div className="text-center space-y-5 sm:space-y-6 max-w-3xl mx-auto">
        <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full text-xs font-semibold bg-white/5 border border-white/10 text-white">
          <BrandedLogo size="xs" />
          <span>MoocDeal - SRM DEALINGS</span>
        </div>

        <h1 className="text-2xl sm:text-4xl md:text-5xl font-extrabold text-white tracking-tight leading-tight">
          Find Your <span className="text-transparent bg-clip-text bg-gradient-to-r from-brand-accent to-brand-violet">NPTEL Exam</span> & Course Buddies
        </h1>

        <p className="text-xs sm:text-base text-subtle-text max-w-xl mx-auto leading-relaxed">
          Connect with SRM AP students traveling to the same exam centre at the exact same reporting time, or study together with peers taking the same MOOC course.
        </p>

        {/* CTA Buttons */}
        <div className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-2">
          <button
            onClick={onGoToSignUp}
            className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-6 py-3.5 rounded-xl bg-brand-violet hover:bg-purple-700 text-white text-xs font-semibold tracking-wide transition-all shadow-glow min-h-[44px]"
          >
            <span>Create Student Account</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>

          <button
            onClick={onGoToSignIn}
            className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-6 py-3.5 rounded-xl bg-dark-800 hover:bg-dark-750 text-slate-200 border border-subtle-border text-xs font-semibold transition-all min-h-[44px]"
          >
            Sign In with Reg No
          </button>
        </div>

        <div className="flex flex-wrap items-center justify-center gap-3 sm:gap-6 pt-2 text-[11px] text-subtle-text">
          <span className="flex items-center gap-1.5">
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
            <span>In-Memory AI Admit Card OCR</span>
          </span>
          <span className="flex items-center gap-1.5">
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
            <span>Student-Managed WhatsApp Groups</span>
          </span>
        </div>
      </div>

      {/* Two Simple Feature Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
        <div className="bg-dark-800 border border-subtle-border rounded-2xl p-6 sm:p-7 space-y-4 hover:border-white/15 transition-all shadow-card">
          <div className="w-10 h-10 rounded-xl bg-brand-violet/10 text-brand-accent border border-brand-violet/20 flex items-center justify-center">
            <MapPin className="w-5 h-5" />
          </div>
          <div>
            <span className="text-[10px] font-semibold uppercase tracking-wider text-brand-accent">
              Logistics & Travel
            </span>
            <h3 className="text-base font-bold text-white mt-1">
              Same Centre & Reporting Slot
            </h3>
            <p className="text-xs text-subtle-text mt-1.5 leading-relaxed">
              Coordinate auto-sharing and morning arrival with classmates entering the exact same exam venue at the same hour.
            </p>
          </div>
        </div>

        <div className="bg-dark-800 border border-subtle-border rounded-2xl p-6 sm:p-7 space-y-4 hover:border-white/15 transition-all shadow-card">
          <div className="w-10 h-10 rounded-xl bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 flex items-center justify-center">
            <BookOpen className="w-5 h-5" />
          </div>
          <div>
            <span className="text-[10px] font-semibold uppercase tracking-wider text-emerald-400">
              Academics & Doubts
            </span>
            <h3 className="text-base font-bold text-white mt-1">
              Same MOOC Course
            </h3>
            <p className="text-xs text-subtle-text mt-1.5 leading-relaxed">
              Connect with peers enrolled in the same online course for study resources and assignment discussions across all venues.
            </p>
          </div>
        </div>
      </div>

      {/* Privacy Notice Link */}
      <div className="text-center pt-4">
        <button
          onClick={onOpenPrivacyNotice}
          className="text-[11px] text-subtle-text hover:text-white transition-colors underline flex items-center gap-1.5 mx-auto"
        >
          <ShieldCheck className="w-3.5 h-3.5 text-brand-accent" />
          <span>Zero permanent image retention policy</span>
        </button>
      </div>
    </div>
  );
};
