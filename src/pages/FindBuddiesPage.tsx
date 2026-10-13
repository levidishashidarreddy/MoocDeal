import React, { useState, useEffect } from 'react';
import {
  MapPin,
  BookOpen,
  Clock,
  Calendar,
  ExternalLink,
  MessageSquare,
  Share2,
  AlertCircle,
  Users,
  Lock,
  Search,
  ArrowLeft,
  CheckCircle2,
  Sparkles,
  HelpCircle,
  Compass
} from 'lucide-react';
import { ExamCohort, Course, StudentExam, CourseBuddiesResult } from '../types';
import { dataService } from '../services/dataService';
import { useAuth } from '../context/AuthContext';
import { WhatsAppLinkModal } from '../components/WhatsAppLinkModal';
import { ReportLinkModal } from '../components/ReportLinkModal';
import { BrandedLoadingLogo } from '../components/BrandedLoadingLogo';

interface FindBuddiesPageProps {
  onGoToMyExam?: () => void;
  isActive?: boolean;
}

export const FindBuddiesPage: React.FC<FindBuddiesPageProps> = ({ onGoToMyExam, isActive = true }) => {
  const { user } = useAuth();
  const [activeSubTab, setActiveSubTab] = useState<'centre' | 'course'>('centre');

  // Student's own exam
  const [studentExam, setStudentExam] = useState<StudentExam | null>(null);

  // Cohorts & Courses
  const [cohorts, setCohorts] = useState<ExamCohort[]>([]);
  const [courses, setCourses] = useState<Course[]>([]);

  // Course Mode: 'my-course' by default, or 'explore'
  const [courseViewMode, setCourseViewMode] = useState<'my-course' | 'explore'>('my-course');
  const [selectedCourseId, setSelectedCourseId] = useState<string>('');
  const [courseSearchQuery, setCourseSearchQuery] = useState<string>('');

  // Pagination State
  const [coursePage, setCoursePage] = useState(1);
  const [cohortPage, setCohortPage] = useState(1);
  const cohortPageSize = 10;

  // Dismissed organiser prompt state (persisted per session)
  const [dismissedCohortOrganiser, setDismissedCohortOrganiser] = useState<Record<string, boolean>>(() => {
    try {
      const saved = localStorage.getItem('moocdeal_dismissed_cohorts');
      return saved ? JSON.parse(saved) : {};
    } catch { return {}; }
  });
  const [dismissedCourseOrganiser, setDismissedCourseOrganiser] = useState<Record<string, boolean>>(() => {
    try {
      const saved = localStorage.getItem('moocdeal_dismissed_courses');
      return saved ? JSON.parse(saved) : {};
    } catch { return {}; }
  });

  const handleDismissCohortOrganiser = (cohortId: string) => {
    const next = { ...dismissedCohortOrganiser, [cohortId]: true };
    setDismissedCohortOrganiser(next);
    try { localStorage.setItem('moocdeal_dismissed_cohorts', JSON.stringify(next)); } catch {}
  };

  const handleDismissCourseOrganiser = (courseId: string) => {
    const next = { ...dismissedCourseOrganiser, [courseId]: true };
    setDismissedCourseOrganiser(next);
    try { localStorage.setItem('moocdeal_dismissed_courses', JSON.stringify(next)); } catch {}
  };

  // Course study data
  const [courseData, setCourseData] = useState<CourseBuddiesResult>({
    course: null,
    students: [],
    groupLink: null,
    hasGroupLink: false,
    isEligible: false,
    canEditLink: false,
    total: 0,
    page: 1,
    pageSize: 10,
    totalPages: 1,
    hasMore: false,
  });

  const [loading, setLoading] = useState(true);

  // Inline link submission states for organisers
  const [inlineCohortLink, setInlineCohortLink] = useState('');
  const [inlineCourseLink, setInlineCourseLink] = useState('');
  const [submittingLink, setSubmittingLink] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  // Modals (for edit/replace or report)
  const [isLinkModalOpen, setIsLinkModalOpen] = useState(false);
  const [isReportModalOpen, setIsReportModalOpen] = useState(false);
  const [modalType, setModalType] = useState<'COHORT' | 'COURSE'>('COHORT');

  const loadData = async (showLoadingSpinner: boolean = true) => {
    if (!user) return;
    try {
      if (showLoadingSpinner && cohorts.length === 0 && !studentExam) {
        setLoading(true);
      }
      const [myExam, allCohorts, allCourses] = await Promise.all([
        dataService.getStudentExam(user.id),
        dataService.getCohorts(undefined, user.id),
        dataService.getCourses(),
      ]);

      setStudentExam(myExam);
      setCohorts(allCohorts);
      setCourses(allCourses);

      // Default course is the student's enrolled course
      if (myExam?.course_id) {
        setSelectedCourseId(myExam.course_id);
      } else if (allCourses.length > 0 && !selectedCourseId) {
        setSelectedCourseId(allCourses[0].id);
      }
    } catch (err) {
      console.error('Failed to load buddy matching data:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData(true);

    const handleProfileUpdated = () => {
      loadData(false);
      if (selectedCourseId && user) {
        dataService.getStudentsByCourse(selectedCourseId, { page: coursePage, pageSize: 10 }, user.id)
          .then(data => setCourseData(data))
          .catch(err => console.error('Failed to reload course students on profile sync:', err));
      }
    };

    window.addEventListener('moocdeal_profile_updated', handleProfileUpdated);
    return () => window.removeEventListener('moocdeal_profile_updated', handleProfileUpdated);
  }, [user]);

  // When returning to this view (isActive turns true), recheck data smoothly in background
  useEffect(() => {
    if (isActive && user) {
      loadData(false);
    }
  }, [isActive]);


  // Load course data whenever selectedCourseId, coursePage, or user changes
  useEffect(() => {
    if (selectedCourseId && user) {
      dataService.getStudentsByCourse(selectedCourseId, { page: coursePage, pageSize: 10 }, user.id)
        .then(data => {
          setCourseData(data);
        })
        .catch(err => {
          console.error('Failed to load course students:', err);
        });
    }
  }, [selectedCourseId, coursePage, user]);

  // Exact matching cohort for Same Centre & Time:
  // Must match ALL THREE: same verified centre, same exam date, same reporting time.
  const matchingCohort = (studentExam && studentExam.status === 'CONFIRMED')
    ? cohorts.find(
        c => c.centre_id === studentExam.centre_id &&
             c.exam_date === studentExam.exam_date &&
             c.reporting_time === studentExam.reporting_time
      )
    : null;

  // Organiser Claim Action for Cohort
  const handleClaimCohortOrganiser = async () => {
    if (!matchingCohort || !user) return;
    setActionError(null);
    try {
      await dataService.claimCohortOrganiser(matchingCohort.id, user.id);
      const updated = await dataService.getCohorts(undefined, user.id);
      setCohorts(updated);
    } catch (err: any) {
      setActionError(err.message || 'Failed to volunteer as cohort group organiser.');
    }
  };

  // Inline submit for Cohort Link
  const handleSubmitInlineCohortLink = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!matchingCohort || !user) return;
    setActionError(null);
    setSubmittingLink(true);
    try {
      await dataService.updateCohortWhatsAppLink(matchingCohort.id, inlineCohortLink, user.id);
      setInlineCohortLink('');
      const updated = await dataService.getCohorts(undefined, user.id);
      setCohorts(updated);
    } catch (err: any) {
      setActionError(err.message || 'Failed to submit WhatsApp invite link.');
    } finally {
      setSubmittingLink(false);
    }
  };

  // Organiser Claim Action for Course
  const handleClaimCourseOrganiser = async () => {
    if (!selectedCourseId || !user) return;
    setActionError(null);
    try {
      await dataService.claimCourseOrganiser(selectedCourseId, user.id);
      const updated = await dataService.getStudentsByCourse(selectedCourseId, { page: coursePage, pageSize: 10 }, user.id);
      setCourseData(updated);
    } catch (err: any) {
      setActionError(err.message || 'Failed to volunteer as course group organiser.');
    }
  };

  // Inline submit for Course Link
  const handleSubmitInlineCourseLink = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedCourseId || !user) return;
    setActionError(null);
    setSubmittingLink(true);
    try {
      await dataService.updateCourseWhatsAppLink(selectedCourseId, inlineCourseLink, user.id);
      setInlineCourseLink('');
      const updated = await dataService.getStudentsByCourse(selectedCourseId, { page: coursePage, pageSize: 10 }, user.id);
      setCourseData(updated);
    } catch (err: any) {
      setActionError(err.message || 'Failed to submit WhatsApp invite link.');
    } finally {
      setSubmittingLink(false);
    }
  };

  // Release / Cancel Organiser Claim for Cohort
  const handleReleaseCohortOrganiser = async () => {
    if (!matchingCohort || !user) return;
    setActionError(null);
    try {
      await dataService.releaseCohortOrganiser(matchingCohort.id, user.id);
      const updated = await dataService.getCohorts(undefined, user.id);
      setCohorts(updated);
    } catch (err: any) {
      setActionError(err.message || 'Failed to release organiser volunteer status.');
    }
  };

  // Release / Cancel Organiser Claim for Course
  const handleReleaseCourseOrganiser = async () => {
    if (!selectedCourseId || !user) return;
    setActionError(null);
    try {
      await dataService.releaseCourseOrganiser(selectedCourseId, user.id);
      const updated = await dataService.getStudentsByCourse(selectedCourseId, { page: coursePage, pageSize: 10 }, user.id);
      setCourseData(updated);
    } catch (err: any) {
      setActionError(err.message || 'Failed to release organiser volunteer status.');
    }
  };

  // Modal Submit Handlers
  const handleSaveCohortLink = async (link: string) => {
    if (!matchingCohort || !user) return;
    await dataService.updateCohortWhatsAppLink(matchingCohort.id, link, user.id);
    const updated = await dataService.getCohorts(undefined, user.id);
    setCohorts(updated);
  };

  const handleSaveCourseLink = async (link: string) => {
    if (!selectedCourseId || !user) return;
    await dataService.updateCourseWhatsAppLink(selectedCourseId, link, user.id);
    const updated = await dataService.getStudentsByCourse(selectedCourseId, { page: coursePage, pageSize: 10 }, user.id);
    setCourseData(updated);
  };

  if (loading) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-20 flex items-center justify-center">
        <BrandedLoadingLogo message="Discovering peer buddies..." size="md" />
      </div>
    );
  }

  if (!user) return null;

  // Filter other courses for Explore Mode
  const filteredCourses = courses.filter(crs => {
    const q = courseSearchQuery.toLowerCase().trim();
    if (!q) return true;
    return crs.name.toLowerCase().includes(q) || crs.code.toLowerCase().includes(q);
  });


  return (
    <div className="max-w-4xl mx-auto px-3.5 sm:px-6 py-6 sm:py-10 space-y-6 sm:space-y-8 animate-fade-in">

      {/* Page Header */}
      <div className="space-y-1.5">
        <h1 className="text-xl sm:text-2xl md:text-3xl font-extrabold text-white tracking-tight">
          Find Buddies
        </h1>
        <p className="text-xs text-subtle-text">
          Connect with peers attending your exact exam centre & reporting slot, or studying the same MOOC course.
        </p>
      </div>

      {/* Global Error Banner if any */}
      {actionError && (
        <div className="p-3.5 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-300 text-xs flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0 text-rose-400" />
            <span>{actionError}</span>
          </div>
          <button
            onClick={() => setActionError(null)}
            className="text-[11px] underline hover:text-white"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Navigation Sub-Tabs */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 border-b border-subtle-border pb-3">
        <button
          onClick={() => {
            setActiveSubTab('centre');
            setActionError(null);
          }}
          className={`flex items-center justify-center gap-2 px-4 py-2.5 text-xs font-semibold rounded-xl transition-all min-h-[42px] ${
            activeSubTab === 'centre'
              ? 'bg-brand-violet text-white shadow-glow'
              : 'text-subtle-text hover:text-white hover:bg-white/5'
          }`}
        >
          <MapPin className="w-3.5 h-3.5 shrink-0" />
          <span>Same Exam Centre & Time</span>
        </button>

        <button
          onClick={() => {
            setActiveSubTab('course');
            setActionError(null);
          }}
          className={`flex items-center justify-center gap-2 px-4 py-2.5 text-xs font-semibold rounded-xl transition-all min-h-[42px] ${
            activeSubTab === 'course'
              ? 'bg-brand-violet text-white shadow-glow'
              : 'text-subtle-text hover:text-white hover:bg-white/5'
          }`}
        >
          <BookOpen className="w-3.5 h-3.5 shrink-0" />
          <span>Same MOOC Course</span>
        </button>
      </div>

      {/* ==================================================================== */}
      {/* SUB-TAB 1: SAME EXAM CENTRE & TIME                                    */}
      {/* ==================================================================== */}
      {activeSubTab === 'centre' && (
        <div className="space-y-6">

          {/* CASE A: Student does NOT have a confirmed admit card / venue slot */}
          {(!studentExam || studentExam.status !== 'CONFIRMED' || !studentExam.centre_id) ? (
            <div className="bg-dark-800 border border-subtle-border rounded-2xl p-7 space-y-4 shadow-card">
              <div className="flex items-start gap-3.5">
                <div className="w-10 h-10 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-400 flex items-center justify-center shrink-0">
                  <AlertCircle className="w-5 h-5" />
                </div>
                <div className="space-y-1.5 text-xs">
                  <h3 className="text-sm font-bold text-white">Admit Card Details Pending</h3>
                  <p className="text-subtle-text leading-relaxed">
                    You have not registered or confirmed your examination venue, date, and official reporting time yet.
                    To maintain strict cohort privacy and avoid mixing unrelated cohorts, centre buddy lists are locked until your hall ticket details are confirmed.
                  </p>
                </div>
              </div>

              {onGoToMyExam && (
                <div className="pt-2">
                  <button
                    onClick={onGoToMyExam}
                    className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-brand-violet hover:bg-purple-700 text-white text-xs font-semibold transition-all shadow-glow"
                  >
                    <Compass className="w-3.5 h-3.5" />
                    <span>Go to My Exam to Confirm Details</span>
                  </button>
                </div>
              )}
            </div>
          ) : !matchingCohort ? (
            /* CASE B: Student has confirmed details, but no cohort record yet */
            <div className="bg-dark-800 border border-subtle-border rounded-2xl p-7 space-y-3 shadow-card">
              <div className="flex items-start gap-3">
                <MapPin className="w-5 h-5 text-brand-accent shrink-0 mt-0.5" />
                <div className="space-y-1 text-xs">
                  <h3 className="text-sm font-bold text-white">Your Exam Slot</h3>
                  <p className="text-subtle-text leading-relaxed">
                    Centre: <span className="text-white font-medium">{studentExam.centre?.name}</span> · Date: <span className="text-white font-medium">{studentExam.exam_date}</span> · Reporting: <span className="text-white font-medium">{studentExam.reporting_time}</span>
                  </p>
                  <p className="text-subtle-text text-[11px] pt-1">
                    You are the first registered student in this slot! Once peers with the same centre, date, and reporting time register, they will appear here automatically.
                  </p>
                </div>
              </div>
            </div>
          ) : (
            /* CASE C: Verified Matching Cohort Card */
            <div className="space-y-6">

              {/* Cohort Header & Coordination Card */}
              <div className="bg-dark-800 border border-subtle-border rounded-2xl p-6 shadow-card space-y-5">
                <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
                  <div className="space-y-1">
                    <span className="text-[10px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded bg-white/5 text-brand-accent border border-white/10">
                      Your Matching Exam Slot
                    </span>
                    <h2 className="text-lg font-bold text-white mt-1">
                      {matchingCohort.centre?.name}
                    </h2>
                    <p className="text-xs text-subtle-text">
                      {matchingCohort.centre?.address}, {matchingCohort.centre?.city}
                    </p>
                  </div>

                  <div className="flex items-center gap-4 bg-dark-850 px-3.5 py-2.5 rounded-xl border border-subtle-border shrink-0 text-xs">
                    <div className="flex items-center gap-1.5 text-white">
                      <Calendar className="w-3.5 h-3.5 text-subtle-text" />
                      <span>{matchingCohort.exam_date}</span>
                    </div>
                    <span className="text-white/20">•</span>
                    <div className="flex items-center gap-1.5 font-bold text-brand-accent">
                      <Clock className="w-3.5 h-3.5" />
                      <span>{matchingCohort.reporting_time} Reporting</span>
                    </div>
                  </div>
                </div>

                {/* WhatsApp Group Widget / Organiser Workflow */}
                <div className="p-4 rounded-xl bg-dark-850 border border-subtle-border space-y-3">
                  <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${
                        matchingCohort.whatsapp_group_link
                          ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                          : 'bg-brand-violet/10 text-brand-accent border border-brand-violet/20'
                      }`}>
                        <MessageSquare className="w-4 h-4" />
                      </div>
                      <div className="text-xs">
                        <div className="flex items-center gap-2">
                          <p className="font-semibold text-white">Cohort WhatsApp Group</p>
                          {matchingCohort.whatsapp_group_link ? (
                            <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 font-medium">
                              Group available
                            </span>
                          ) : (
                            <span className="text-[10px] px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-400 border border-amber-500/20 font-medium">
                              Awaiting organiser
                            </span>
                          )}
                        </div>
                        <p className="text-[11px] text-subtle-text">
                          {matchingCohort.whatsapp_group_link
                            ? 'Available to students attending this exact venue and reporting slot.'
                            : matchingCohort.organiser_status === 'CLAIMED'
                              ? (matchingCohort.organiser_id === user.id
                                  ? 'You volunteered to organise this group. Submit your invite link below.'
                                  : 'A peer has volunteered to create this group. Awaiting organiser to post invite link.')
                              : 'No WhatsApp group has been created yet.'}
                        </p>
                      </div>
                    </div>

                    {/* Action buttons when link already exists */}
                    {matchingCohort.whatsapp_group_link ? (
                      <div className="flex items-center gap-2 shrink-0">
                        <a
                          href={matchingCohort.whatsapp_group_link}
                          target="_blank"
                          rel="noopener noreferrer nofollow"
                          className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold transition-colors"
                        >
                          <span>Join Group</span>
                          <ExternalLink className="w-3 h-3" />
                        </a>
                        {matchingCohort.can_edit_link && (
                          <button
                            onClick={() => {
                              setModalType('COHORT');
                              setIsLinkModalOpen(true);
                            }}
                            className="px-2.5 py-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-slate-300 text-xs transition-colors"
                            title="Edit or replace group link"
                          >
                            Edit / Replace
                          </button>
                        )}
                        <button
                          onClick={() => {
                            setModalType('COHORT');
                            setIsReportModalOpen(true);
                          }}
                          className="px-2 py-1.5 text-xs text-subtle-text hover:text-rose-400 transition-colors"
                          title="Report broken or invalid link"
                        >
                          Report
                        </button>
                      </div>
                    ) : matchingCohort.organiser_status !== 'CLAIMED' ? (
                      /* When no link and no organiser yet */
                      dismissedCohortOrganiser[matchingCohort.id] ? (
                        <button
                          type="button"
                          onClick={() => {
                            const next = { ...dismissedCohortOrganiser };
                            delete next[matchingCohort.id];
                            setDismissedCohortOrganiser(next);
                            handleClaimCohortOrganiser();
                          }}
                          className="text-xs text-subtle-text hover:text-brand-accent underline shrink-0"
                        >
                          Volunteer to create group
                        </button>
                      ) : (
                        <div className="flex items-center gap-2 shrink-0">
                          <button
                            type="button"
                            onClick={handleClaimCohortOrganiser}
                            className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-brand-violet hover:bg-purple-700 text-white text-xs font-semibold transition-all shadow-glow"
                          >
                            <Sparkles className="w-3.5 h-3.5" />
                            <span>I'll create the group</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDismissCohortOrganiser(matchingCohort.id)}
                            className="px-2.5 py-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-slate-400 hover:text-white text-xs transition-colors"
                          >
                            Not now
                          </button>
                        </div>
                      )
                    ) : null}
                  </div>

                  {/* Organiser Submission Form: shown when current user claimed the organiser role */}
                  {!matchingCohort.whatsapp_group_link && matchingCohort.organiser_status === 'CLAIMED' && matchingCohort.organiser_id === user.id && (
                    <form onSubmit={handleSubmitInlineCohortLink} className="pt-2 border-t border-subtle-border space-y-2">
                      <p className="text-[11px] text-slate-300">
                        Create the WhatsApp group manually in WhatsApp, copy the invite link, and paste it here:
                      </p>
                      <div className="flex flex-col sm:flex-row items-center gap-2">
                        <input
                          type="url"
                          placeholder="https://chat.whatsapp.com/AbCdEfGhIjKlMnOpQrSt"
                          value={inlineCohortLink}
                          onChange={e => setInlineCohortLink(e.target.value)}
                          required
                          className="w-full flex-1 px-3 py-2 rounded-xl bg-dark-900 border border-subtle-border text-white text-xs placeholder-subtle-text focus:outline-none focus:border-brand-violet font-mono"
                        />
                        <button
                          type="submit"
                          disabled={submittingLink || !inlineCohortLink.trim()}
                          className="w-full sm:w-auto px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white text-xs font-semibold transition-colors shrink-0"
                        >
                          {submittingLink ? 'Submitting...' : 'Submit Group Link'}
                        </button>
                        <button
                          type="button"
                          onClick={handleReleaseCohortOrganiser}
                          className="w-full sm:w-auto px-3 py-2 rounded-xl bg-white/5 hover:bg-white/10 text-slate-400 hover:text-rose-400 text-xs transition-colors shrink-0"
                        >
                          Cancel volunteer
                        </button>
                      </div>
                    </form>
                  )}
                </div>
              </div>

              {/* Matching Students List */}
              <div className="space-y-3">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1">
                  <h3 className="text-xs font-semibold uppercase tracking-wider text-subtle-text">
                    Matching Students in This Slot ({matchingCohort.members?.length || 0})
                  </h3>
                  <span className="text-[11px] text-subtle-text">
                    Same venue, date & reporting time
                  </span>
                </div>

                <div className="bg-dark-800 border border-subtle-border rounded-2xl overflow-hidden shadow-card">
                  {/* Mobile Stacked Card View (< sm) */}
                  <div className="block sm:hidden divide-y divide-subtle-border">
                    {(matchingCohort.members || []).map(member => {
                      const student = member.student;
                      const isMe = student?.id === user?.id;

                      return (
                        <div key={member.id} className="p-3.5 space-y-1.5 hover:bg-white/5 transition-colors">
                          <div className="flex items-center justify-between gap-2">
                            <span className="font-semibold text-white text-xs">{student?.full_name}</span>
                            {isMe && (
                              <span className="text-[10px] px-1.5 py-0.5 rounded bg-brand-violet text-white font-bold shrink-0">
                                You
                              </span>
                            )}
                          </div>
                          <div className="flex items-center justify-between text-[11px] gap-2">
                            <span className="font-mono font-medium text-brand-accent break-all">{student?.reg_no}</span>
                            <span className="text-subtle-text shrink-0">{student?.branch} · Sec {student?.section} · {student?.academic_year}</span>
                          </div>
                          <div className="text-[11px] text-slate-300 break-words">
                            {member.course?.name || 'NPTEL Course'}
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  {/* Desktop Table View (>= sm) */}
                  <div className="hidden sm:block overflow-x-auto">
                    <table className="w-full text-left text-xs">
                      <thead className="bg-dark-850 border-b border-subtle-border text-[11px] font-semibold uppercase tracking-wider text-subtle-text">
                        <tr>
                          <th className="py-3 px-4">Student</th>
                          <th className="py-3 px-4">Registration Number</th>
                          <th className="py-3 px-4">Course</th>
                          <th className="py-3 px-4">Branch & Section</th>
                          <th className="py-3 px-4">Year</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-subtle-border text-slate-200">
                        {(matchingCohort.members || []).map(member => {
                          const student = member.student;
                          const isMe = student?.id === user?.id;

                          return (
                            <tr key={member.id} className="hover:bg-white/5 transition-colors">
                              <td className="py-3 px-4">
                                <span className="font-semibold text-white">{student?.full_name}</span>
                                {isMe && (
                                  <span className="ml-2 text-[10px] px-1.5 py-0.5 rounded bg-brand-violet text-white font-bold">
                                    You
                                  </span>
                                )}
                              </td>
                              <td className="py-3 px-4 font-mono font-medium text-brand-accent">
                                {student?.reg_no}
                              </td>
                              <td className="py-3 px-4 text-slate-300">
                                {member.course?.name || 'NPTEL Course'}
                              </td>
                              <td className="py-3 px-4 text-subtle-text">
                                {student?.branch} · Sec {student?.section}
                              </td>
                              <td className="py-3 px-4 text-subtle-text">
                                {student?.academic_year}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>

                  {(!matchingCohort.members || matchingCohort.members.length === 0) && (
                    <div className="p-8 text-center text-xs text-subtle-text">
                      No other students in this cohort yet.
                    </div>
                  )}


                  {/* Pagination Controls */}
                  {matchingCohort.members && matchingCohort.members.length > cohortPageSize && (
                    <div className="flex items-center justify-between px-4 py-3 bg-dark-850 border-t border-subtle-border text-xs text-subtle-text">
                      <span>
                        Page {cohortPage} of {Math.ceil(matchingCohort.members.length / cohortPageSize)} ({matchingCohort.members.length} cohort peers)
                      </span>
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          disabled={cohortPage <= 1}
                          onClick={() => setCohortPage(p => Math.max(1, p - 1))}
                          className="px-2.5 py-1 rounded-lg bg-dark-800 border border-subtle-border hover:text-white disabled:opacity-40"
                        >
                          Previous
                        </button>
                        <button
                          type="button"
                          disabled={cohortPage >= Math.ceil(matchingCohort.members.length / cohortPageSize)}
                          onClick={() => setCohortPage(p => p + 1)}
                          className="px-2.5 py-1 rounded-lg bg-dark-800 border border-subtle-border hover:text-white disabled:opacity-40"
                        >
                          Next
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ==================================================================== */}
      {/* SUB-TAB 2: SAME MOOC COURSE                                           */}
      {/* ==================================================================== */}
      {activeSubTab === 'course' && (
        <div className="space-y-6">

          {/* Mode 1: Default - My Course View */}
          {courseViewMode === 'my-course' ? (
            <div className="space-y-6">

              {/* Header Action: Switch to Explore Other Courses */}
              <div className="flex items-center justify-between">
                <div>
                  <span className="text-[10px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded bg-white/5 text-brand-accent border border-white/10">
                    My Course
                  </span>
                </div>

                <button
                  onClick={() => {
                    setCourseViewMode('explore');
                    setActionError(null);
                  }}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-dark-850 hover:bg-dark-750 border border-subtle-border hover:border-brand-violet text-slate-300 hover:text-white text-xs font-medium transition-all"
                >
                  <Search className="w-3.5 h-3.5 text-brand-accent" />
                  <span>Explore Other Courses</span>
                </button>
              </div>

              {/* Active Course Card */}
              {courseData.course ? (
                <div className="bg-dark-800 border border-subtle-border rounded-2xl p-6 shadow-card space-y-5">
                  <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
                    <div className="space-y-1">
                      <span className="text-[10px] font-mono uppercase px-2 py-0.5 rounded bg-white/5 text-brand-accent border border-white/10 font-medium">
                        {courseData.course.code}
                      </span>
                      <h2 className="text-lg font-bold text-white mt-1">
                        {courseData.course.name}
                      </h2>
                      <p className="text-xs text-subtle-text">
                        Course-wide peer discussion group for all enrolled SRM AP students, across all exam venues and shifts.
                      </p>
                    </div>

                    <div className="bg-dark-850 px-3.5 py-2 rounded-xl border border-subtle-border text-xs text-white shrink-0 font-medium">
                      {courseData.total} Enrolled Students
                    </div>
                  </div>

                  {/* Course Group WhatsApp Widget / Organiser Workflow */}
                  <div className="p-4 rounded-xl bg-dark-850 border border-subtle-border space-y-3">
                    <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                      <div className="flex items-center gap-3">
                        <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${
                          courseData.groupLink
                            ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                            : 'bg-brand-violet/10 text-brand-accent border border-brand-violet/20'
                        }`}>
                          <MessageSquare className="w-4 h-4" />
                        </div>
                        <div className="text-xs">
                          <div className="flex items-center gap-2">
                            <p className="font-semibold text-white">Course WhatsApp Study Group</p>
                            {courseData.groupLink ? (
                              <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 font-medium">
                                Group available
                              </span>
                            ) : (
                              <span className="text-[10px] px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-400 border border-amber-500/20 font-medium">
                                Awaiting organiser
                              </span>
                            )}
                          </div>
                          <p className="text-[11px] text-subtle-text">
                            {courseData.groupLink
                              ? 'Active study group link submitted by enrolled peers.'
                              : courseData.organiser_status === 'CLAIMED'
                                ? (courseData.organiser_id === user.id
                                    ? 'You volunteered to organise this course group. Submit your invite link below.'
                                    : 'A peer has volunteered to create this group. Awaiting organiser to post invite link.')
                                : 'No WhatsApp group has been created yet.'}
                          </p>
                        </div>
                      </div>

                      {/* Action buttons when link already exists */}
                      {courseData.groupLink ? (
                        <div className="flex items-center gap-2 shrink-0">
                          <a
                            href={courseData.groupLink.whatsapp_group_link}
                            target="_blank"
                            rel="noopener noreferrer nofollow"
                            className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold transition-colors"
                          >
                            <span>Join Study Group</span>
                            <ExternalLink className="w-3 h-3" />
                          </a>
                          {courseData.canEditLink && (
                            <button
                              onClick={() => {
                                setModalType('COURSE');
                                setIsLinkModalOpen(true);
                              }}
                              className="px-2.5 py-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-slate-300 text-xs transition-colors"
                              title="Edit or replace group link"
                            >
                              Edit / Replace
                            </button>
                          )}
                          <button
                            onClick={() => {
                              setModalType('COURSE');
                              setIsReportModalOpen(true);
                            }}
                            className="px-2 py-1.5 text-xs text-subtle-text hover:text-rose-400 transition-colors"
                            title="Report broken or invalid link"
                          >
                            Report
                          </button>
                        </div>
                      ) : courseData.organiser_status !== 'CLAIMED' ? (
                        /* When no link and no organiser yet */
                        courseData.course && dismissedCourseOrganiser[courseData.course.id] ? (
                          <button
                            type="button"
                            onClick={() => {
                              if (!courseData.course) return;
                              const next = { ...dismissedCourseOrganiser };
                              delete next[courseData.course.id];
                              setDismissedCourseOrganiser(next);
                              handleClaimCourseOrganiser();
                            }}
                            className="text-xs text-subtle-text hover:text-brand-accent underline shrink-0"
                          >
                            Volunteer to create group
                          </button>
                        ) : (
                          <div className="flex items-center gap-2 shrink-0">
                            <button
                              type="button"
                              onClick={handleClaimCourseOrganiser}
                              className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-brand-violet hover:bg-purple-700 text-white text-xs font-semibold transition-all shadow-glow"
                            >
                              <Sparkles className="w-3.5 h-3.5" />
                              <span>I'll create the group</span>
                            </button>
                            <button
                              type="button"
                              onClick={() => courseData.course && handleDismissCourseOrganiser(courseData.course.id)}
                              className="px-2.5 py-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-slate-400 hover:text-white text-xs transition-colors"
                            >
                              Not now
                            </button>
                          </div>
                        )
                      ) : null}
                    </div>

                    {/* Organiser Submission Form: shown when current user claimed course organiser role */}
                    {!courseData.groupLink && courseData.organiser_status === 'CLAIMED' && courseData.organiser_id === user.id && (
                      <form onSubmit={handleSubmitInlineCourseLink} className="pt-2 border-t border-subtle-border space-y-2">
                        <p className="text-[11px] text-slate-300">
                          Create the WhatsApp study group in WhatsApp, copy the invite link, and paste it here:
                        </p>
                        <div className="flex flex-col sm:flex-row items-center gap-2">
                          <input
                            type="url"
                            placeholder="https://chat.whatsapp.com/AbCdEfGhIjKlMnOpQrSt"
                            value={inlineCourseLink}
                            onChange={e => setInlineCourseLink(e.target.value)}
                            required
                            className="w-full flex-1 px-3 py-2 rounded-xl bg-dark-900 border border-subtle-border text-white text-xs placeholder-subtle-text focus:outline-none focus:border-brand-violet font-mono"
                          />
                          <button
                            type="submit"
                            disabled={submittingLink || !inlineCourseLink.trim()}
                            className="w-full sm:w-auto px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white text-xs font-semibold transition-colors shrink-0"
                          >
                            {submittingLink ? 'Submitting...' : 'Submit Study Link'}
                          </button>
                          <button
                            type="button"
                            onClick={handleReleaseCourseOrganiser}
                            className="w-full sm:w-auto px-3 py-2 rounded-xl bg-white/5 hover:bg-white/10 text-slate-400 hover:text-rose-400 text-xs transition-colors shrink-0"
                          >
                            Cancel volunteer
                          </button>
                        </div>
                      </form>
                    )}
                  </div>
                </div>
              ) : null}

              {/* Enrolled Students Table */}
              <div className="space-y-3">
                <h3 className="text-xs font-semibold uppercase tracking-wider text-subtle-text">
                  Enrolled Students in {courseData.course?.name} ({courseData.total})
                </h3>

                <div className="bg-dark-800 border border-subtle-border rounded-2xl overflow-hidden shadow-card">
                  {/* Mobile Stacked Card View (< sm) */}
                  <div className="block sm:hidden divide-y divide-subtle-border">
                    {courseData.students.map(item => {
                      const s = item.profile;
                      const exam = item.exam;
                      const isMe = s.id === user?.id;

                      return (
                        <div key={exam.id} className="p-3.5 space-y-1.5 hover:bg-white/5 transition-colors">
                          <div className="flex items-center justify-between gap-2">
                            <span className="font-semibold text-white text-xs">{s.full_name}</span>
                            {isMe && (
                              <span className="text-[10px] px-1.5 py-0.5 rounded bg-brand-violet text-white font-bold shrink-0">
                                You
                              </span>
                            )}
                          </div>
                          <div className="flex items-center justify-between text-[11px] gap-2">
                            <span className="font-mono font-medium text-brand-accent break-all">{s.reg_no}</span>
                            <span className="text-subtle-text shrink-0">{s.branch} · Sec {s.section} · {s.academic_year}</span>
                          </div>
                          <div className="text-[11px] text-slate-300">
                            {exam.status === 'CONFIRMED' && item.centre ? (
                              <span className="text-emerald-400 flex items-center gap-1">
                                <CheckCircle2 className="w-3 h-3 shrink-0" />
                                <span className="truncate">{item.centre.city} · {exam.exam_date} ({exam.reporting_time})</span>
                              </span>
                            ) : (
                              <span className="text-amber-400/80 italic">Admit Card Pending</span>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  {/* Desktop Table View (>= sm) */}
                  <div className="hidden sm:block overflow-x-auto">
                    <table className="w-full text-left text-xs">
                      <thead className="bg-dark-850 border-b border-subtle-border text-[11px] font-semibold uppercase tracking-wider text-subtle-text">
                        <tr>
                          <th className="py-3 px-4">Student</th>
                          <th className="py-3 px-4">Registration Number</th>
                          <th className="py-3 px-4">Branch & Section</th>
                          <th className="py-3 px-4">Year</th>
                          <th className="py-3 px-4">Exam Venue Slot</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-subtle-border text-slate-200">
                        {courseData.students.map(item => {
                          const s = item.profile;
                          const exam = item.exam;
                          const isMe = s.id === user?.id;

                          return (
                            <tr key={exam.id} className="hover:bg-white/5 transition-colors">
                              <td className="py-3 px-4">
                                <span className="font-semibold text-white">{s.full_name}</span>
                                {isMe && (
                                  <span className="ml-2 text-[10px] px-1.5 py-0.5 rounded bg-brand-violet text-white font-bold">
                                    You
                                  </span>
                                )}
                              </td>
                              {/* Full unmasked registration number as explicitly requested */}
                              <td className="py-3 px-4 font-mono font-medium text-brand-accent">
                                {s.reg_no}
                              </td>
                              <td className="py-3 px-4 text-subtle-text">
                                {s.branch} · Sec {s.section}
                              </td>
                              <td className="py-3 px-4 text-subtle-text">
                                {s.academic_year}
                              </td>
                              <td className="py-3 px-4 text-slate-300">
                                {exam.status === 'CONFIRMED' && item.centre ? (
                                  <span className="text-[11px]">
                                    {item.centre.city} · {exam.exam_date} ({exam.reporting_time})
                                  </span>
                                ) : (
                                  <span className="text-[11px] text-amber-400/80">
                                    Admit Card Pending
                                  </span>
                                )}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>


                  {courseData.students.length === 0 && (
                    <div className="p-8 text-center text-xs text-subtle-text">
                      No students enrolled in this course yet.
                    </div>
                  )}

                  {/* Course Pagination Controls */}
                  {courseData.totalPages > 1 && (
                    <div className="flex items-center justify-between px-4 py-3 bg-dark-850 border-t border-subtle-border text-xs text-subtle-text">
                      <span>
                        Page {courseData.page} of {courseData.totalPages} ({courseData.total} students)
                      </span>
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          disabled={courseData.page <= 1}
                          onClick={() => setCoursePage(p => Math.max(1, p - 1))}
                          className="px-2.5 py-1 rounded-lg bg-dark-800 border border-subtle-border hover:text-white disabled:opacity-40"
                        >
                          Previous
                        </button>
                        <button
                          type="button"
                          disabled={!courseData.hasMore}
                          onClick={() => setCoursePage(p => p + 1)}
                          className="px-2.5 py-1 rounded-lg bg-dark-800 border border-subtle-border hover:text-white disabled:opacity-40"
                        >
                          Next
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          ) : (
            /* Mode 2: Optional - Explore Other Courses */
            <div className="space-y-6">

              {/* Back to My Course Action */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <button
                  onClick={() => {
                    if (studentExam?.course_id) {
                      setSelectedCourseId(studentExam.course_id);
                    }
                    setCourseViewMode('my-course');
                    setActionError(null);
                  }}
                  className="inline-flex items-center gap-2 text-xs font-semibold text-brand-accent hover:text-purple-300 transition-colors"
                >
                  <ArrowLeft className="w-3.5 h-3.5" />
                  <span>Back to My Course</span>
                </button>

                {/* Search Bar */}
                <div className="relative w-full sm:w-72">
                  <Search className="w-3.5 h-3.5 text-subtle-text absolute left-3 top-2.5" />
                  <input
                    type="text"
                    placeholder="Search courses by name or code..."
                    value={courseSearchQuery}
                    onChange={e => setCourseSearchQuery(e.target.value)}
                    className="w-full pl-9 pr-3 py-1.5 rounded-xl bg-dark-850 border border-subtle-border text-white text-xs placeholder-subtle-text focus:outline-none focus:border-brand-violet"
                  />
                </div>
              </div>

              {/* Course Catalog Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {filteredCourses.map(crs => {
                  const isCurrent = crs.id === selectedCourseId;
                  const isMine = crs.id === studentExam?.course_id;

                  return (
                    <div
                      key={crs.id}
                      onClick={() => {
                        setSelectedCourseId(crs.id);
                        setCoursePage(1);
                      }}
                      className={`p-4 rounded-xl border cursor-pointer transition-all ${
                        isCurrent
                          ? 'bg-dark-750 border-brand-violet shadow-card'
                          : 'bg-dark-800 border-subtle-border hover:border-white/20 hover:bg-dark-750'
                      }`}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <span className="text-[10px] font-mono uppercase px-2 py-0.5 rounded bg-white/5 text-brand-accent border border-white/10 font-medium">
                            {crs.code}
                          </span>
                          <h4 className="text-sm font-bold text-white mt-1.5">
                            {crs.name}
                          </h4>
                        </div>
                        {isMine && (
                          <span className="text-[10px] px-1.5 py-0.5 rounded bg-brand-violet text-white font-semibold shrink-0">
                            Your Course
                          </span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Selected Course Details and Peer List in Explore Mode */}
              {courseData.course && (
                <div className="pt-4 border-t border-subtle-border space-y-5">
                  <div className="bg-dark-800 border border-subtle-border rounded-2xl p-6 shadow-card space-y-5">
                    <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
                      <div className="space-y-1">
                        <span className="text-[10px] font-mono uppercase px-2 py-0.5 rounded bg-white/5 text-brand-accent border border-white/10 font-medium">
                          {courseData.course.code}
                        </span>
                        <h2 className="text-lg font-bold text-white mt-1">
                          {courseData.course.name}
                        </h2>
                      </div>
                      <div className="bg-dark-850 px-3.5 py-2 rounded-xl border border-subtle-border text-xs text-white shrink-0 font-medium">
                        {courseData.total} Students
                      </div>
                    </div>

                    {/* WhatsApp Group Coordination Widget */}
                    <div className="p-4 rounded-xl bg-dark-850 border border-subtle-border space-y-3">
                      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                        <div className="flex items-center gap-3">
                          <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${
                            courseData.groupLink
                              ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                              : 'bg-brand-violet/10 text-brand-accent border border-brand-violet/20'
                          }`}>
                            <MessageSquare className="w-4 h-4" />
                          </div>
                          <div className="text-xs">
                            <p className="font-semibold text-white">Course Discussion Group</p>
                            <p className="text-[11px] text-subtle-text">
                              {courseData.groupLink
                                ? 'Active study group link shared by enrolled students.'
                                : courseData.organiser_status === 'CLAIMED'
                                  ? (courseData.organiser_id === user.id
                                      ? 'You volunteered to organise this group. Submit your invite link below.'
                                      : 'A peer has volunteered to create this group. Awaiting organiser.')
                                  : 'No WhatsApp study group yet for this course.'}
                            </p>
                          </div>
                        </div>

                        {courseData.groupLink ? (
                          <div className="flex items-center gap-2 shrink-0">
                            <a
                              href={courseData.groupLink.whatsapp_group_link}
                              target="_blank"
                              rel="noopener noreferrer nofollow"
                              className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold transition-colors"
                            >
                              <span>Join Group</span>
                              <ExternalLink className="w-3 h-3" />
                            </a>
                            {courseData.canEditLink && (
                              <button
                                onClick={() => {
                                  setModalType('COURSE');
                                  setIsLinkModalOpen(true);
                                }}
                                className="px-2.5 py-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-slate-300 text-xs transition-colors"
                              >
                                Edit / Replace
                              </button>
                            )}
                            <button
                              onClick={() => {
                                setModalType('COURSE');
                                setIsReportModalOpen(true);
                              }}
                              className="px-2 py-1.5 text-xs text-subtle-text hover:text-rose-400 transition-colors"
                            >
                              Report
                            </button>
                          </div>
                        ) : courseData.organiser_status !== 'CLAIMED' ? (
                          <button
                            onClick={handleClaimCourseOrganiser}
                            className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-brand-violet hover:bg-purple-700 text-white text-xs font-semibold transition-all shadow-glow shrink-0"
                          >
                            <Sparkles className="w-3.5 h-3.5" />
                            <span>I'll create the group</span>
                          </button>
                        ) : null}
                      </div>

                      {/* Organiser Submission Form */}
                      {!courseData.groupLink && courseData.organiser_status === 'CLAIMED' && courseData.organiser_id === user.id && (
                        <form onSubmit={handleSubmitInlineCourseLink} className="pt-2 border-t border-subtle-border space-y-2">
                          <p className="text-[11px] text-slate-300">
                            Create the WhatsApp study group in WhatsApp, copy the invite link, and paste it here:
                          </p>
                          <div className="flex flex-col sm:flex-row items-center gap-2">
                            <input
                              type="url"
                              placeholder="https://chat.whatsapp.com/AbCdEfGhIjKlMnOpQrSt"
                              value={inlineCourseLink}
                              onChange={e => setInlineCourseLink(e.target.value)}
                              required
                              className="w-full flex-1 px-3 py-2 rounded-xl bg-dark-900 border border-subtle-border text-white text-xs placeholder-subtle-text focus:outline-none focus:border-brand-violet font-mono"
                            />
                            <button
                              type="submit"
                              disabled={submittingLink || !inlineCourseLink.trim()}
                              className="w-full sm:w-auto px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white text-xs font-semibold transition-colors shrink-0"
                            >
                              {submittingLink ? 'Submitting...' : 'Submit Study Link'}
                            </button>
                          </div>
                        </form>
                      )}
                    </div>
                  </div>

                  {/* Student Rows Table */}
                  <div className="space-y-3">
                    <h3 className="text-xs font-semibold uppercase tracking-wider text-subtle-text">
                      Enrolled Students ({courseData.total})
                    </h3>

                    <div className="bg-dark-800 border border-subtle-border rounded-2xl overflow-hidden shadow-card">
                      <div className="overflow-x-auto">
                        <table className="w-full text-left text-xs">
                          <thead className="bg-dark-850 border-b border-subtle-border text-[11px] font-semibold uppercase tracking-wider text-subtle-text">
                            <tr>
                              <th className="py-3 px-4">Student</th>
                              <th className="py-3 px-4">Registration Number</th>
                              <th className="py-3 px-4">Branch & Section</th>
                              <th className="py-3 px-4">Year</th>
                              <th className="py-3 px-4">Exam Slot</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-subtle-border text-slate-200">
                            {courseData.students.map(item => {
                              const s = item.profile;
                              const exam = item.exam;
                              const isMe = s.id === user?.id;

                              return (
                                <tr key={exam.id} className="hover:bg-white/5 transition-colors">
                                  <td className="py-3 px-4">
                                    <span className="font-semibold text-white">{s.full_name}</span>
                                    {isMe && (
                                      <span className="ml-2 text-[10px] px-1.5 py-0.5 rounded bg-brand-violet text-white font-bold">
                                        You
                                      </span>
                                    )}
                                  </td>
                                  <td className="py-3 px-4 font-mono font-medium text-brand-accent">
                                    {s.reg_no}
                                  </td>
                                  <td className="py-3 px-4 text-subtle-text">
                                    {s.branch} · Sec {s.section}
                                  </td>
                                  <td className="py-3 px-4 text-subtle-text">
                                    {s.academic_year}
                                  </td>
                                  <td className="py-3 px-4 text-slate-300">
                                    {exam.status === 'CONFIRMED' && item.centre ? (
                                      <span className="text-[11px]">
                                        {item.centre.city} · {exam.exam_date} ({exam.reporting_time})
                                      </span>
                                    ) : (
                                      <span className="text-[11px] text-amber-400/80">
                                        Admit Card Pending
                                      </span>
                                    )}
                                  </td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Edit/Replace Link Modal */}
      <WhatsAppLinkModal
        isOpen={isLinkModalOpen}
        onClose={() => setIsLinkModalOpen(false)}
        onSubmit={modalType === 'COHORT' ? handleSaveCohortLink : handleSaveCourseLink}
        title={modalType === 'COHORT' ? 'Edit Cohort WhatsApp Group' : 'Edit Course Study Group'}
        subtitle={modalType === 'COHORT' ? 'Update your group invite link for this venue & slot' : 'Update your course study group invite link'}
        currentLink={modalType === 'COHORT' ? matchingCohort?.whatsapp_group_link : courseData.groupLink?.whatsapp_group_link}
      />

      {/* Report Broken Link Modal */}
      <ReportLinkModal
        isOpen={isReportModalOpen}
        onClose={() => setIsReportModalOpen(false)}
        linkType={modalType}
        targetId={modalType === 'COHORT' ? (matchingCohort?.id || '') : selectedCourseId}
        whatsappLink={modalType === 'COHORT' ? (matchingCohort?.whatsapp_group_link || '') : (courseData.groupLink?.whatsapp_group_link || '')}
        targetTitle={modalType === 'COHORT' ? (matchingCohort?.centre?.name || 'Cohort Group') : (courseData.course?.name || 'Course Group')}
      />
    </div>
  );
};
