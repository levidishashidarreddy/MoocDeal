import React, { useState, useEffect } from 'react';
import { 
  Plus, 
  MapPin, 
  Calendar, 
  Clock, 
  BookOpen, 
  Users, 
  Sparkles, 
  AlertCircle, 
  CheckCircle2, 
  Trash2, 
  ArrowRight,
  Shield,
  Eye,
  EyeOff,
  ExternalLink
} from 'lucide-react';
import { StudentExam, ExamCohort } from '../types';
import { dataService } from '../services/dataService';
import { useAuth } from '../context/AuthContext';

interface DashboardPageProps {
  onOpenOnboarding: () => void;
  onNavigateToCentreMatches: (cohortId?: string) => void;
  onNavigateToCourseMatches: (courseId?: string) => void;
}

export const DashboardPage: React.FC<DashboardPageProps> = ({
  onOpenOnboarding,
  onNavigateToCentreMatches,
  onNavigateToCourseMatches,
}) => {
  const { user, updateProfile } = useAuth();
  const [exams, setExams] = useState<StudentExam[]>([]);
  const [cohorts, setCohorts] = useState<ExamCohort[]>([]);
  const [loading, setLoading] = useState(true);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const loadDashboardData = async () => {
    if (!user) return;
    try {
      setLoading(true);
      const studentExams = await dataService.getStudentExams(user.id);
      const allCohorts = await dataService.getCohorts();
      setExams(studentExams);
      setCohorts(allCohorts);
    } catch (err) {
      console.error('Failed to load dashboard:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadDashboardData();
  }, [user]);

  const handleDeleteExam = async (examId: string) => {
    if (!confirm('Are you sure you want to remove this exam entry?')) return;
    setDeletingId(examId);
    try {
      await dataService.deleteStudentExam(examId);
      await loadDashboardData();
    } catch (err) {
      alert('Failed to remove exam.');
    } finally {
      setDeletingId(null);
    }
  };

  const handleTogglePrivacy = async () => {
    if (!user) return;
    await updateProfile({ phone_visible: !user.phone_visible });
  };

  // Calculate matching stats
  const confirmedExams = exams.filter(e => e.status === 'CONFIRMED');
  const matchedBuddiesCount = cohorts
    .filter(c => confirmedExams.some(e => e.centre_id === c.centre_id && e.exam_date === c.exam_date && e.reporting_time === c.reporting_time))
    .reduce((sum, c) => sum + Math.max(0, (c.member_count || 1) - 1), 0);

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8 animate-fade-in">
      
      {/* Student Welcome Header & Stats */}
      <div className="bg-gradient-to-r from-navy-950 via-navy-900 to-navy-800 rounded-3xl p-6 sm:p-8 text-white shadow-card flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
        <div className="space-y-2">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-[11px] font-bold bg-navy-800 border border-navy-700 text-amber-300">
            <span>SRM University–AP</span>
            <span>·</span>
            <span>{user?.branch}</span>
            <span>·</span>
            <span>{user?.academic_year}</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight">
            Welcome back, {user?.full_name}!
          </h1>
          <p className="text-xs text-slate-300 font-mono">
            Registration No: {user?.reg_no} · Section: {user?.section}
          </p>
        </div>

        {/* Quick Action */}
        <div className="flex flex-wrap items-center gap-3">
          <button
            onClick={onOpenOnboarding}
            className="px-5 py-3 text-xs font-bold text-navy-950 bg-amber-300 hover:bg-amber-400 rounded-xl transition-all shadow-md flex items-center gap-2"
          >
            <Sparkles className="w-4 h-4 text-navy-900" />
            <span>Upload Hall Ticket</span>
          </button>
        </div>
      </div>

      {/* Stats Bar */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-subtle flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">My Exams</p>
            <p className="text-2xl font-black text-navy-950 mt-1">{exams.length}</p>
          </div>
          <div className="w-10 h-10 rounded-xl bg-navy-50 text-navy-800 flex items-center justify-center">
            <BookOpen className="w-5 h-5" />
          </div>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-subtle flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Confirmed Slots</p>
            <p className="text-2xl font-black text-emerald-700 mt-1">{confirmedExams.length}</p>
          </div>
          <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-700 flex items-center justify-center">
            <CheckCircle2 className="w-5 h-5" />
          </div>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-subtle flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Matched Cohort Buddies</p>
            <p className="text-2xl font-black text-navy-950 mt-1">{matchedBuddiesCount}</p>
          </div>
          <div className="w-10 h-10 rounded-xl bg-amber-50 text-amber-700 flex items-center justify-center">
            <Users className="w-5 h-5" />
          </div>
        </div>
      </div>

      {/* Privacy Setting Card */}
      <div className="bg-white p-4 sm:p-5 rounded-2xl border border-slate-200 shadow-subtle flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-navy-100 text-navy-800 flex items-center justify-center shrink-0">
            <Shield className="w-5 h-5" />
          </div>
          <div>
            <h4 className="text-xs font-bold text-navy-900">
              Registration Number Cohort Visibility
            </h4>
            <p className="text-[11px] text-slate-500">
              {user?.phone_visible
                ? 'Your full registration number is visible to fellow matching students.'
                : 'Registration number is masked in public cohort tables for enhanced privacy.'}
            </p>
          </div>
        </div>
        <button
          onClick={handleTogglePrivacy}
          className={`px-4 py-2 text-xs font-semibold rounded-xl border transition-all flex items-center gap-2 ${
            user?.phone_visible
              ? 'bg-slate-100 border-slate-300 text-slate-700 hover:bg-slate-200'
              : 'bg-emerald-50 border-emerald-300 text-emerald-800 hover:bg-emerald-100'
          }`}
        >
          {user?.phone_visible ? (
            <>
              <EyeOff className="w-3.5 h-3.5" />
              <span>Mask Reg Number</span>
            </>
          ) : (
            <>
              <Eye className="w-3.5 h-3.5" />
              <span>Show Full Reg Number</span>
            </>
          )}
        </button>
      </div>

      {/* Enrolled Exams List */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-bold text-navy-950">My Registered NPTEL Exams</h2>
            <p className="text-xs text-slate-500">
              Your registered courses and examination logistics
            </p>
          </div>
          <button
            onClick={onOpenOnboarding}
            className="px-3.5 py-1.5 text-xs font-semibold text-navy-900 bg-white hover:bg-slate-50 border border-slate-200 rounded-xl transition-all shadow-subtle flex items-center gap-1.5"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Add Another Exam</span>
          </button>
        </div>

        {loading ? (
          <div className="p-12 text-center text-xs text-slate-400">Loading your exam records...</div>
        ) : exams.length === 0 ? (
          <div className="bg-white rounded-3xl p-12 text-center border border-dashed border-slate-300 space-y-4">
            <div className="w-14 h-14 rounded-2xl bg-navy-50 text-navy-800 mx-auto flex items-center justify-center">
              <BookOpen className="w-7 h-7" />
            </div>
            <div className="max-w-sm mx-auto space-y-1">
              <h3 className="text-sm font-bold text-navy-900">No Exams Registered Yet</h3>
              <p className="text-xs text-slate-500 leading-relaxed">
                Upload your NPTEL admit card to automatically discover your exam cohort, or register your course name manually.
              </p>
            </div>
            <button
              onClick={onOpenOnboarding}
              className="px-6 py-2.5 text-xs font-bold text-white bg-navy-900 hover:bg-navy-800 rounded-xl transition-all shadow-md inline-flex items-center gap-2"
            >
              <Sparkles className="w-3.5 h-3.5 text-amber-300" />
              <span>Start Onboarding</span>
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            {exams.map(exam => {
              const isConfirmed = exam.status === 'CONFIRMED';
              
              // Find matching cohort for this exam
              const matchingCohort = isConfirmed
                ? cohorts.find(
                    c =>
                      c.centre_id === exam.centre_id &&
                      c.exam_date === exam.exam_date &&
                      c.reporting_time === exam.reporting_time
                  )
                : undefined;

              return (
                <div
                  key={exam.id}
                  className="bg-white rounded-2xl border border-slate-200 p-6 shadow-subtle hover:shadow-card transition-all flex flex-col justify-between space-y-5"
                >
                  <div className="space-y-4">
                    {/* Status Badge & Course Header */}
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <span className="text-[10px] font-mono uppercase px-2 py-0.5 rounded bg-slate-100 text-slate-700 font-semibold">
                          {exam.course?.code || 'NPTEL-MOOC'}
                        </span>
                        <h3 className="text-base font-bold text-navy-950 mt-1">
                          {exam.course?.name}
                        </h3>
                      </div>
                      <span
                        className={`text-[10px] font-bold px-2.5 py-1 rounded-full uppercase tracking-wider shrink-0 ${
                          isConfirmed
                            ? 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                            : 'bg-amber-100 text-amber-800 border border-amber-200'
                        }`}
                      >
                        {isConfirmed ? 'Confirmed Slot' : 'Admit Card Pending'}
                      </span>
                    </div>

                    {/* Logistics details */}
                    {isConfirmed ? (
                      <div className="space-y-2.5 text-xs text-slate-700 bg-slate-50/80 p-3.5 rounded-xl border border-slate-100">
                        <div className="flex items-start gap-2">
                          <MapPin className="w-4 h-4 text-navy-700 shrink-0 mt-0.5" />
                          <div>
                            <span className="font-semibold text-navy-950">{exam.centre?.name}</span>
                            <p className="text-[11px] text-slate-500">
                              {exam.centre?.address}, {exam.centre?.city}
                            </p>
                          </div>
                        </div>

                        <div className="grid grid-cols-2 gap-2 pt-1 border-t border-slate-200/60">
                          <div className="flex items-center gap-1.5">
                            <Calendar className="w-3.5 h-3.5 text-slate-400" />
                            <span className="font-medium">{exam.exam_date}</span>
                          </div>
                          <div className="flex items-center gap-1.5">
                            <Clock className="w-3.5 h-3.5 text-emerald-600" />
                            <span className="font-bold text-emerald-900">
                              Report: {exam.reporting_time} ({exam.shift || 'FN'})
                            </span>
                          </div>
                        </div>
                      </div>
                    ) : (
                      <div className="p-3.5 rounded-xl bg-amber-50 border border-amber-200 text-amber-900 text-xs space-y-1">
                        <div className="flex items-center gap-1.5 font-bold">
                          <AlertCircle className="w-4 h-4 text-amber-600" />
                          <span>Hall ticket details needed for centre cohort</span>
                        </div>
                        <p className="text-[11px] text-amber-800">
                          You are currently matched with peers taking this course. Once your admit card arrives, upload it to discover venue ride buddies.
                        </p>
                      </div>
                    )}
                  </div>

                  {/* Actions Bar */}
                  <div className="pt-3 border-t border-slate-100 flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      {isConfirmed ? (
                        <button
                          onClick={() => onNavigateToCentreMatches(matchingCohort?.id)}
                          className="px-3 py-1.5 text-xs font-semibold text-white bg-navy-900 hover:bg-navy-800 rounded-xl transition-colors flex items-center gap-1.5 shadow-2xs"
                        >
                          <Users className="w-3.5 h-3.5 text-amber-300" />
                          <span>View Centre Cohort ({matchingCohort?.member_count || 1})</span>
                        </button>
                      ) : (
                        <button
                          onClick={onOpenOnboarding}
                          className="px-3 py-1.5 text-xs font-semibold text-white bg-navy-900 hover:bg-navy-800 rounded-xl transition-colors flex items-center gap-1.5"
                        >
                          <Sparkles className="w-3.5 h-3.5 text-amber-300" />
                          <span>Upload Admit Card</span>
                        </button>
                      )}

                      <button
                        onClick={() => onNavigateToCourseMatches(exam.course_id)}
                        className="px-3 py-1.5 text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-xl transition-colors flex items-center gap-1"
                      >
                        <BookOpen className="w-3.5 h-3.5 text-slate-500" />
                        <span>Course Study Group</span>
                      </button>
                    </div>

                    <button
                      onClick={() => handleDeleteExam(exam.id)}
                      disabled={deletingId === exam.id}
                      className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors"
                      title="Remove exam"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};
