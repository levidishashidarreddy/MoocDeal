import React from 'react';
import { 
  Compass, 
  MapPin, 
  BookOpen, 
  ShieldCheck, 
  Sparkles, 
  Users, 
  Clock, 
  ArrowRight, 
  CheckCircle2, 
  Lock, 
  MessageSquare,
  HelpCircle
} from 'lucide-react';

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
    <div className="min-h-screen bg-slate-50 text-slate-800 flex flex-col">
      {/* Hero Section */}
      <section className="relative overflow-hidden bg-gradient-to-b from-navy-950 via-navy-900 to-navy-800 text-white pt-20 pb-24 px-4 sm:px-6 lg:px-8">
        <div className="absolute inset-0 bg-[linear-gradient(to_right,#1f293708_1px,transparent_1px),linear-gradient(to_bottom,#1f293708_1px,transparent_1px)] bg-[size:24px_24px] pointer-events-none" />
        
        <div className="max-w-4xl mx-auto text-center relative z-10 space-y-6">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-semibold bg-navy-800/80 border border-navy-700 text-amber-300 shadow-sm">
            <span className="w-2 h-2 rounded-full bg-amber-400 animate-ping" />
            Unofficial SRM DEALINGS Student Platform · SRM University–AP
          </div>

          <h1 className="text-3xl sm:text-5xl lg:text-6xl font-extrabold tracking-tight text-white leading-tight">
            Find Your <span className="text-amber-300">NPTEL Exam</span> Cohort & Study Buddies
          </h1>

          <p className="text-sm sm:text-base text-slate-300 max-w-2xl mx-auto leading-relaxed">
            Discover fellow SRM AP students traveling to the same exam centre at the exact same reporting time, or connect with peers taking the same MOOC course.
          </p>

          {/* Call to Actions */}
          <div className="flex flex-col sm:flex-row items-center justify-center gap-3.5 pt-4">
            <button
              onClick={onGoToSignUp}
              className="w-full sm:w-auto px-7 py-3.5 text-xs font-bold text-navy-950 bg-amber-300 hover:bg-amber-400 rounded-xl transition-all shadow-lg hover:shadow-xl flex items-center justify-center gap-2 group"
            >
              <span>Create Student Account</span>
              <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
            </button>
            <button
              onClick={onGoToSignIn}
              className="w-full sm:w-auto px-7 py-3.5 text-xs font-bold text-white bg-navy-800/90 hover:bg-navy-700/90 border border-navy-600 rounded-xl transition-all shadow-sm"
            >
              Sign In with Reg No
            </button>
          </div>

          {/* Quick guarantees */}
          <div className="pt-8 flex flex-wrap items-center justify-center gap-6 text-xs text-slate-400">
            <span className="flex items-center gap-1.5">
              <CheckCircle2 className="w-4 h-4 text-emerald-400" />
              Zero Image Retention (In-Memory OCR)
            </span>
            <span className="flex items-center gap-1.5">
              <CheckCircle2 className="w-4 h-4 text-emerald-400" />
              Verified Unique SRMAP Registration
            </span>
            <span className="flex items-center gap-1.5">
              <CheckCircle2 className="w-4 h-4 text-emerald-400" />
              Independent Student WhatsApp Groups
            </span>
          </div>
        </div>
      </section>

      {/* Two Discovery Modes */}
      <section className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 -mt-10 relative z-20">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Mode 1: Same Centre & Reporting Time */}
          <div className="bg-white rounded-2xl p-7 shadow-card border border-slate-200/80 hover:shadow-hover transition-all space-y-4">
            <div className="w-12 h-12 rounded-xl bg-navy-100 text-navy-900 flex items-center justify-center">
              <MapPin className="w-6 h-6 text-navy-800" />
            </div>
            <div>
              <span className="text-[10px] font-bold uppercase tracking-wider text-navy-700 bg-navy-50 px-2 py-0.5 rounded border border-navy-200">
                Logistics & Travel Match
              </span>
              <h3 className="text-lg font-bold text-navy-950 mt-2">
                1. Same Exam Centre & Reporting Time
              </h3>
              <p className="text-xs text-slate-600 mt-1 leading-relaxed">
                Coordinate morning rides, auto-sharing from Vijayawada or Guntur, and travel safety with students entering the same examination centre at the exact same shift reporting slot.
              </p>
            </div>
            <ul className="text-xs text-slate-600 space-y-2 pt-2 border-t border-slate-100">
              <li className="flex items-center gap-2">
                <Clock className="w-4 h-4 text-slate-400 shrink-0" />
                <span>Strictly separates Reporting Time from Writing Start Time</span>
              </li>
              <li className="flex items-center gap-2">
                <Users className="w-4 h-4 text-slate-400 shrink-0" />
                <span>Matches students across different courses taking the same slot</span>
              </li>
            </ul>
          </div>

          {/* Mode 2: Same MOOC Course */}
          <div className="bg-white rounded-2xl p-7 shadow-card border border-slate-200/80 hover:shadow-hover transition-all space-y-4">
            <div className="w-12 h-12 rounded-xl bg-emerald-100 text-emerald-800 flex items-center justify-center">
              <BookOpen className="w-6 h-6 text-emerald-700" />
            </div>
            <div>
              <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-800 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                Peer Study & Academics
              </span>
              <h3 className="text-lg font-bold text-navy-950 mt-2">
                2. Same MOOC Course
              </h3>
              <p className="text-xs text-slate-600 mt-1 leading-relaxed">
                Connect with campus peers enrolled in the same NPTEL course (e.g. Deep Learning, Cloud Computing, C Programming) even when their test dates and venues differ.
              </p>
            </div>
            <ul className="text-xs text-slate-600 space-y-2 pt-2 border-t border-slate-100">
              <li className="flex items-center gap-2">
                <Users className="w-4 h-4 text-slate-400 shrink-0" />
                <span>Join course-level peer discussion WhatsApp groups</span>
              </li>
              <li className="flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-slate-400 shrink-0" />
                <span>Available immediately even before receiving your hall ticket</span>
              </li>
            </ul>
          </div>
        </div>
      </section>

      {/* How It Works */}
      <section className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-20 space-y-12">
        <div className="text-center max-w-2xl mx-auto space-y-2">
          <span className="text-[11px] font-bold uppercase tracking-wider text-navy-700">
            Streamlined Workflow
          </span>
          <h2 className="text-2xl sm:text-3xl font-extrabold text-navy-950">
            How NPTEL Exam Buddy Works
          </h2>
          <p className="text-xs text-slate-500">
            From hall ticket upload to meeting your exam buddies in 3 simple steps
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="p-6 rounded-2xl bg-white border border-slate-200 shadow-subtle space-y-3">
            <div className="w-10 h-10 rounded-xl bg-navy-900 text-white font-bold text-sm flex items-center justify-center">
              1
            </div>
            <h4 className="text-sm font-bold text-navy-900">Sign Up with Reg No</h4>
            <p className="text-xs text-slate-600 leading-relaxed">
              Register with your unique SRM AP registration number (AP21110010xxx), branch, academic year, and section.
            </p>
          </div>

          <div className="p-6 rounded-2xl bg-white border border-slate-200 shadow-subtle space-y-3">
            <div className="w-10 h-10 rounded-xl bg-navy-900 text-amber-300 font-bold text-sm flex items-center justify-center">
              2
            </div>
            <h4 className="text-sm font-bold text-navy-900">Upload or Select Course</h4>
            <p className="text-xs text-slate-600 leading-relaxed">
              Upload your admit card for automated AI extraction, or select your course code manually if your hall ticket is not yet released.
            </p>
          </div>

          <div className="p-6 rounded-2xl bg-white border border-slate-200 shadow-subtle space-y-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-600 text-white font-bold text-sm flex items-center justify-center">
              3
            </div>
            <h4 className="text-sm font-bold text-navy-900">Discover Cohort & WhatsApp</h4>
            <p className="text-xs text-slate-600 leading-relaxed">
              See who else is traveling to your test centre at that hour. Share or join the student-managed WhatsApp group with one click.
            </p>
          </div>
        </div>
      </section>

      {/* Privacy & Safety Highlights */}
      <section className="bg-navy-900 text-white py-16 px-4 sm:px-6 lg:px-8">
        <div className="max-w-4xl mx-auto space-y-8">
          <div className="text-center space-y-2">
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-navy-800 text-emerald-400 text-xs font-semibold">
              <ShieldCheck className="w-4 h-4" />
              Student Privacy First
            </div>
            <h2 className="text-2xl sm:text-3xl font-extrabold">
              Engineered with Zero Data Retention
            </h2>
            <p className="text-xs text-slate-300 max-w-xl mx-auto leading-relaxed">
              We know your hall ticket contains sensitive personal information. Here is how we protect you:
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
            <div className="p-4 rounded-xl bg-navy-800/80 border border-navy-700 space-y-1.5">
              <h5 className="font-bold text-white flex items-center gap-2">
                <Lock className="w-4 h-4 text-emerald-400" /> No Image Storage
              </h5>
              <p className="text-slate-300">
                Admit card images are parsed strictly in server RAM and immediately discarded. Never stored in disks or cloud buckets.
              </p>
            </div>

            <div className="p-4 rounded-xl bg-navy-800/80 border border-navy-700 space-y-1.5">
              <h5 className="font-bold text-white flex items-center gap-2">
                <Lock className="w-4 h-4 text-emerald-400" /> No Personal Metadata Stored
              </h5>
              <p className="text-slate-300">
                We never extract or save photos, date of birth, parent names, home addresses, or private mobile numbers.
              </p>
            </div>

            <div className="p-4 rounded-xl bg-navy-800/80 border border-navy-700 space-y-1.5">
              <h5 className="font-bold text-white flex items-center gap-2">
                <Lock className="w-4 h-4 text-emerald-400" /> Maskable Registration Numbers
              </h5>
              <p className="text-slate-300">
                You can toggle privacy in your settings to mask your registration number from general cohort listings.
              </p>
            </div>

            <div className="p-4 rounded-xl bg-navy-800/80 border border-navy-700 space-y-1.5">
              <h5 className="font-bold text-white flex items-center gap-2">
                <Lock className="w-4 h-4 text-emerald-400" /> Verified WhatsApp Links
              </h5>
              <p className="text-slate-300">
                Only valid WhatsApp invite links are accepted, with community reporting to rapidly remove spam or expired links.
              </p>
            </div>
          </div>

          <div className="text-center pt-2">
            <button
              onClick={onOpenPrivacyNotice}
              className="text-xs font-semibold text-emerald-400 hover:text-emerald-300 underline"
            >
              Read Full Privacy & Data Architecture Notice
            </button>
          </div>
        </div>
      </section>

      {/* Frequently Asked Questions */}
      <section className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-16 space-y-8">
        <div className="text-center space-y-1.5">
          <h2 className="text-xl sm:text-2xl font-bold text-navy-950">Frequently Asked Questions</h2>
          <p className="text-xs text-slate-500">Quick answers regarding community coordination</p>
        </div>

        <div className="space-y-3 text-xs">
          <div className="p-4 rounded-xl bg-white border border-slate-200">
            <h4 className="font-bold text-navy-900 mb-1">Is this an official SRM University–AP application?</h4>
            <p className="text-slate-600">
              No. This is an independent peer utility created for the unofficial SRM DEALINGS student community to help students travel together safely to exam centres in Vijayawada, Guntur, and surrounding areas.
            </p>
          </div>

          <div className="p-4 rounded-xl bg-white border border-slate-200">
            <h4 className="font-bold text-navy-900 mb-1">Does this app create WhatsApp groups automatically?</h4>
            <p className="text-slate-600">
              No. Students independently create their own WhatsApp groups and paste the invite link into their cohort or course page.
            </p>
          </div>

          <div className="p-4 rounded-xl bg-white border border-slate-200">
            <h4 className="font-bold text-navy-900 mb-1">What if my exam centre is not listed yet?</h4>
            <p className="text-slate-600">
              Centres are dynamically extracted and suggested. If your admit card specifies a new venue, our system automatically creates a suggestion for administrative verification.
            </p>
          </div>
        </div>
      </section>
    </div>
  );
};
