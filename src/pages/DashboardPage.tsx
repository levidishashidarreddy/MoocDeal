import React, { useState, useEffect } from 'react';
import {
  Compass,
  MapPin,
  Calendar,
  Clock,
  Users,
  Sparkles,
  Edit3,
  ArrowRight,
  CheckCircle2,
  AlertCircle
} from 'lucide-react';
import { StudentExam } from '../types';
import { dataService } from '../services/dataService';
import { useAuth } from '../context/AuthContext';

interface DashboardPageProps {
  onOpenOnboarding: () => void;
  onNavigateToFindBuddies: () => void;
  refreshTrigger?: number;
  isActive?: boolean;
}

export const DashboardPage: React.FC<DashboardPageProps> = ({
  onOpenOnboarding,
  onNavigateToFindBuddies,
  refreshTrigger,
  isActive = true,
}) => {
  const { user } = useAuth();
  const [exam, setExam] = useState<StudentExam | null>(null);
  const [loading, setLoading] = useState(true);

  const loadExam = async (showLoadingSpinner: boolean = true) => {
    if (!user) return;
    try {
      if (showLoadingSpinner && !exam) {
        setLoading(true);
      }
      const studentExam = await dataService.getStudentExam(user.id);
      setExam(studentExam);
    } catch (err) {
      console.error('Failed to load exam:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadExam(true);

    const handleProfileUpdated = () => {
      loadExam(false);
    };
    window.addEventListener('moocdeal_profile_updated', handleProfileUpdated);
    return () => window.removeEventListener('moocdeal_profile_updated', handleProfileUpdated);
  }, [user, refreshTrigger]);

  // When returning to this view (isActive turns true), recheck latest exam details smoothly in background
  useEffect(() => {
    if (isActive && user) {
      loadExam(false);
    }
  }, [isActive]);

  if (!user) return null;

  return (
    <div className="max-w-4xl mx-auto px-3.5 sm:px-6 py-6 sm:py-10 space-y-6 sm:space-y-8 animate-fade-in">

      {/* Compact Welcome Line with Student Name & Registration Details */}
      <div className="space-y-1.5">
        <h1 className="text-xl sm:text-2xl md:text-3xl font-extrabold text-white tracking-tight flex flex-wrap items-center gap-2">
          <span className="break-words">Welcome, {user.full_name}</span>
          <span className="text-xl sm:text-2xl">👋</span>
        </h1>
        <p className="text-xs text-subtle-text flex flex-wrap items-center gap-1.5">
          <span>{user.branch}</span>
          <span className="text-white/20">·</span>
          <span>{user.academic_year}</span>
          <span className="text-white/20">·</span>
          <span>Sec {user.section}</span>
          <span className="text-white/20">·</span>
          <span className="font-mono text-slate-300 break-all">{user.reg_no}</span>
        </p>
      </div>

      {/* Section Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-brand-accent">
          <Compass className="w-3.5 h-3.5 text-brand-purple" />
          <span>My Exam</span>
        </div>

        {exam && (
          <button
            onClick={onOpenOnboarding}
            className="flex items-center gap-1.5 text-xs text-subtle-text hover:text-white transition-colors py-1 px-2 rounded-lg hover:bg-white/5 min-h-[36px]"
          >
            <Edit3 className="w-3.5 h-3.5" />
            <span>Edit Exam</span>
          </button>
        )}
      </div>

      {/* Single My Exam Card */}
      {loading ? (
        <div className="bg-dark-800 border border-subtle-border rounded-2xl p-8 text-center text-xs text-subtle-text">
          Loading exam details...
        </div>
      ) : !exam ? (
        /* Empty state: Clean, minimal and centered */
        <div className="bg-dark-800 border border-subtle-border rounded-2xl p-6 sm:p-10 text-center space-y-4">
          <div className="w-12 h-12 rounded-xl bg-white/5 border border-white/10 text-brand-accent mx-auto flex items-center justify-center">
            <Compass className="w-6 h-6" />
          </div>
          <div className="space-y-1.5 max-w-sm mx-auto">
            <h3 className="text-sm sm:text-base font-bold text-white">No Exam Registered Yet</h3>
            <p className="text-xs text-subtle-text leading-relaxed">
              Upload your NPTEL hall ticket to automatically extract your slot, or register your course name manually.
            </p>
          </div>
          <button
            onClick={onOpenOnboarding}
            className="inline-flex items-center justify-center gap-2 px-6 py-3 rounded-xl bg-brand-violet hover:bg-purple-700 text-white text-xs font-semibold transition-all shadow-glow min-h-[44px]"
          >
            <Sparkles className="w-3.5 h-3.5" />
            <span>Set Up My Exam</span>
          </button>
        </div>
      ) : (
        /* The Single Compact My Exam Card */
        <div className="bg-dark-800 border border-subtle-border rounded-2xl p-5 sm:p-7 shadow-card space-y-5 sm:space-y-6 hover:border-white/15 transition-all">

          {/* Card Top: Course Name & Status */}
          <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
            <div className="space-y-1.5 min-w-0">
              <span className="inline-block text-[10px] font-mono uppercase px-2 py-0.5 rounded bg-white/5 text-brand-accent border border-white/10 font-medium">
                {exam.course?.code || 'MOOC'}
              </span>
              <h2 className="text-base sm:text-xl font-bold text-white break-words">
                {exam.course?.name}
              </h2>
            </div>

            {/* Status Indicator */}
            <div className="shrink-0">
              {exam.status === 'CONFIRMED' ? (
                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                  <span>Confirmed Slot</span>
                </span>
              ) : (
                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold bg-amber-500/10 text-amber-400 border border-amber-500/20">
                  <AlertCircle className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                  <span>Admit Card Pending</span>
                </span>
              )}
            </div>
          </div>

          {/* Card Middle: Venue & Schedule */}
          {exam.status === 'CONFIRMED' ? (
            <div className="space-y-4 pt-4 border-t border-white/5 text-xs">
              {/* Centre Details */}
              <div className="flex items-start gap-2.5">
                <MapPin className="w-4 h-4 text-brand-accent shrink-0 mt-0.5" />
                <div className="min-w-0">
                  <p className="font-semibold text-white break-words">
                    {exam.centre?.name || 'Assigned Test Centre'}
                  </p>
                  <p className="text-[11px] text-subtle-text mt-0.5 break-words">
                    {exam.centre?.address}, {exam.centre?.city} {exam.centre?.pincode ? `- ${exam.centre.pincode}` : ''}
                  </p>
                </div>
              </div>

              {/* Timing Grid: Responsive 1 col on mobile, 3 cols on desktop */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 sm:gap-3 bg-dark-850 p-3 sm:p-3.5 rounded-xl border border-subtle-border">
                <div className="flex items-center gap-2">
                  <Calendar className="w-3.5 h-3.5 text-subtle-text shrink-0" />
                  <div className="min-w-0">
                    <span className="text-[10px] text-subtle-text block">Exam Date</span>
                    <span className="font-medium text-white truncate block">{exam.exam_date}</span>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <Clock className="w-3.5 h-3.5 text-brand-accent shrink-0" />
                  <div className="min-w-0">
                    <span className="text-[10px] text-subtle-text block">Reporting Time</span>
                    <span className="font-bold text-white truncate block">{exam.reporting_time} ({exam.shift || 'FN'})</span>
                  </div>
                </div>

                {exam.exam_start_time && (
                  <div className="flex items-center gap-2">
                    <Clock className="w-3.5 h-3.5 text-subtle-text shrink-0" />
                    <div className="min-w-0">
                      <span className="text-[10px] text-subtle-text block">Exam Start Time</span>
                      <span className="font-medium text-white truncate block">{exam.exam_start_time}</span>
                    </div>
                  </div>
                )}
              </div>
            </div>
          ) : (
            /* Hall ticket pending prompt */
            <div className="pt-4 border-t border-white/5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3.5">
              <p className="text-xs text-subtle-text leading-relaxed">
                Exam centre and reporting slot are unconfirmed. You can discover peers in this course now, and add hall ticket details when available.
              </p>

              {/* Exactly one unobtrusive upload action */}
              <button
                onClick={onOpenOnboarding}
                className="w-full sm:w-auto shrink-0 inline-flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-xl bg-white/5 hover:bg-white/10 text-white border border-white/10 text-xs font-medium transition-colors min-h-[42px]"
              >
                <Sparkles className="w-3.5 h-3.5 text-brand-accent" />
                <span>Upload Hall Ticket</span>
              </button>
            </div>
          )}
        </div>
      )}

      {/* Primary Action: Find Buddies */}
      <div>
        <button
          onClick={onNavigateToFindBuddies}
          className="w-full sm:w-auto inline-flex items-center justify-center gap-2.5 px-6 py-3.5 rounded-xl bg-brand-violet hover:bg-purple-700 text-white text-xs font-semibold tracking-wide transition-all shadow-glow min-h-[44px]"
        >
          <Users className="w-4 h-4" />
          <span>Find Buddies</span>
          <ArrowRight className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
};
