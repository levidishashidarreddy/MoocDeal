import React, { useState, useRef, useEffect } from 'react';
import {
  Sparkles,
  Upload,
  BookOpen,
  X,
  Clock,
  MapPin,
  Calendar,
  CheckCircle2,
  AlertTriangle,
  ArrowRight,
  ShieldCheck,
  RotateCcw,
  Edit3,
  Search,
  Check
} from 'lucide-react';
import { HallTicketExtractionResult, Course, StudentExam, ExamCentre } from '../types';
import { dataService } from '../services/dataService';
import {
  calculateCourseMatch,
  CourseMatchResult,
  resolveCanonicalCourseMatch,
  CanonicalCourseResolution,
  normalizeCourseText,
  normalizeCourseCode
} from '../services/courseMatcher';
import {
  searchAndRankCentres,
  CentreMatchResult
} from '../services/centreMatcher';
import { useAuth } from '../context/AuthContext';
import confetti from 'canvas-confetti';

export type UploadProgressStage =
  | 'IDLE'
  | 'PREPARING_IMAGE'          // Stage 1: Preparing image...
  | 'READING_DETAILS'          // Stage 2: Reading hall-ticket details...
  | 'MATCHING_LOGISTICS'       // Stage 3: Matching your course and exam centre...
  | 'SAVING_DETAILS'           // Stage 4: Saving your confirmed exam details...
  | 'COMPLETE';                // Stage 5: Complete — review your details

interface OnboardingModalProps {
  isOpen: boolean;
  onClose: () => void;
  onExamSaved: () => void;
}

export const OnboardingModal: React.FC<OnboardingModalProps> = ({
  isOpen,
  onClose,
  onExamSaved,
}) => {
  const { user } = useAuth();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  // Existing exam record for single-exam verification
  const [existingExam, setExistingExam] = useState<StudentExam | null>(null);
  const [allCourses, setAllCourses] = useState<Course[]>([]);
  const [allCentres, setAllCentres] = useState<ExamCentre[]>([]);

  // Modal Steps
  const [step, setStep] = useState<'CHOICE' | 'UPLOAD_AI' | 'NO_HALL_TICKET' | 'REVIEW_AI' | 'MANUAL_ENTRY'>('CHOICE');

  // File upload state (Strictly in-memory zero retention)
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [filePreview, setFilePreview] = useState<string | null>(null);
  const [extracting, setExtracting] = useState(false);
  const [progressStage, setProgressStage] = useState<UploadProgressStage>('IDLE');
  const [extractionError, setExtractionError] = useState<string | null>(null);

  // Form / Review state
  const [formData, setFormData] = useState<HallTicketExtractionResult>({
    course_name: '',
    course_code: '',
    exam_date: '',
    reporting_time: '',
    exam_start_time: '',
    shift: 'FN',
    centre_name: '',
    centre_address: '',
    city: 'Vijayawada',
    state: 'Andhra Pradesh',
    pincode: '',
    ambiguous_fields: [],
    confidence_score: 95,
  });

  // Time sequence validation warning state
  const [timeWarning, setTimeWarning] = useState<string | null>(null);

  // Course difference detected when verifying hall ticket later
  const [courseDiffNotice, setCourseDiffNotice] = useState<{
    oldCourseName: string;
    newCourseName: string;
  } | null>(null);

  // No hall ticket state (Course only with autocomplete & deduplication)
  const [noTicketCourseCode, setNoTicketCourseCode] = useState('');
  const [noTicketCourseName, setNoTicketCourseName] = useState('');
  const [selectedCanonicalCourse, setSelectedCanonicalCourse] = useState<Course | null>(null);
  const [courseResolution, setCourseResolution] = useState<CanonicalCourseResolution | null>(null);
  const [courseSuggestions, setCourseSuggestions] = useState<CourseMatchResult[]>([]);
  const [aiMatchSuggestion, setAiMatchSuggestion] = useState<{ course: Course; reason: string } | null>(null);
  const [isAutocompleteOpen, setIsAutocompleteOpen] = useState(false);
  const [_duplicateWarning, setDuplicateWarning] = useState<CourseMatchResult | null>(null);

  // Manual entry autocomplete & matching states
  const [manualCourseResolution, setManualCourseResolution] = useState<CanonicalCourseResolution | null>(null);
  const [manualCourseSuggestions, setManualCourseSuggestions] = useState<CourseMatchResult[]>([]);
  const [isManualCourseDropdownOpen, setIsManualCourseDropdownOpen] = useState(false);
  const [manualCentreSuggestions, setManualCentreSuggestions] = useState<CentreMatchResult[]>([]);
  const [isManualCentreDropdownOpen, setIsManualCentreDropdownOpen] = useState(false);

  // Submission state
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  // Load existing exam and catalogue when modal opens
  useEffect(() => {
    if (isOpen && user) {
      dataService.getStudentExam(user.id).then(exam => {
        setExistingExam(exam);
        if (exam && exam.status === 'PENDING_DETAILS' && exam.course) {
          // If already in pending mode, initialize with their pending course
          setNoTicketCourseName(exam.course.name);
          setNoTicketCourseCode(exam.course.code);
          setSelectedCanonicalCourse(exam.course);
        }
      });

      dataService.getCourses().then(courses => {
        setAllCourses(courses);
      });

      dataService.getCentres().then(centres => {
        setAllCentres(centres);
      });
    }
  }, [isOpen, user]);

  // Autocomplete search as user types course title (shared courseMatcher service)
  useEffect(() => {
    if (!noTicketCourseName.trim()) {
      setCourseSuggestions([]);
      setCourseResolution(null);
      setAiMatchSuggestion(null);
      setIsAutocompleteOpen(false);
      return;
    }

    if (allCourses.length > 0) {
      const res = resolveCanonicalCourseMatch(
        { title: noTicketCourseName, code: noTicketCourseCode },
        allCourses
      );
      setCourseResolution(res);
      setCourseSuggestions(res.candidates);
      setIsAutocompleteOpen(res.candidates.length > 0 && !selectedCanonicalCourse);
    }

    // Debounced AI-assisted candidate evaluation for abbreviations/typos
    const timer = setTimeout(async () => {
      if (noTicketCourseName.trim().length >= 3 && !selectedCanonicalCourse && allCourses.length > 0) {
        try {
          const res = await fetch('/api/ai-match-course', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              query: noTicketCourseName.trim(),
              candidates: allCourses.map(c => ({ id: c.id, name: c.name, code: c.code })),
            }),
          });
          const json = await res.json();
          if (json.success && json.data?.matchedCourseId && (json.data.confidence === 'HIGH' || json.data.confidence === 'MEDIUM')) {
            const matched = allCourses.find(c => c.id === json.data.matchedCourseId);
            if (matched) {
              setAiMatchSuggestion({ course: matched, reason: json.data.reason });
              setIsAutocompleteOpen(true);
            }
          } else {
            setAiMatchSuggestion(null);
          }
        } catch {
          setAiMatchSuggestion(null);
        }
      }
    }, 450);

    return () => clearTimeout(timer);
  }, [noTicketCourseName, noTicketCourseCode, allCourses, selectedCanonicalCourse]);

  // Manual entry course matching
  useEffect(() => {
    if (step !== 'MANUAL_ENTRY') return;
    if (!formData.course_name.trim()) {
      setManualCourseResolution(null);
      setManualCourseSuggestions([]);
      setIsManualCourseDropdownOpen(false);
      return;
    }
    if (allCourses.length > 0) {
      const res = resolveCanonicalCourseMatch(
        { title: formData.course_name, code: formData.course_code },
        allCourses
      );
      setManualCourseResolution(res);
      setManualCourseSuggestions(res.candidates);
      setIsManualCourseDropdownOpen(res.candidates.length > 0);
    }
  }, [formData.course_name, formData.course_code, allCourses, step]);

  // Manual entry centre matching
  useEffect(() => {
    if (step !== 'MANUAL_ENTRY') return;
    if (!formData.centre_name.trim()) {
      setManualCentreSuggestions([]);
      setIsManualCentreDropdownOpen(false);
      return;
    }
    if (allCentres.length > 0) {
      const results = searchAndRankCentres(formData.centre_name, allCentres, formData.city, { minScore: 0.35, limit: 5 });
      setManualCentreSuggestions(results);
      setIsManualCentreDropdownOpen(results.length > 0);
    }
  }, [formData.centre_name, formData.city, allCentres, step]);

  if (!isOpen) return null;

  // Check timing relationship: reporting_time vs exam_start_time
  const validateTimes = (repTime: string, startTime: string) => {
    if (!repTime || !startTime) {
      setTimeWarning(null);
      return;
    }
    const [repHours, repMins] = repTime.split(':').map(Number);
    const [startHours, startMins] = startTime.split(':').map(Number);
    if (isNaN(repHours) || isNaN(repMins) || isNaN(startHours) || isNaN(startMins)) {
      setTimeWarning(null);
      return;
    }
    const repTotal = repHours * 60 + repMins;
    const startTotal = startHours * 60 + startMins;

    if (repTotal >= startTotal) {
      setTimeWarning('Reporting time must be earlier than exam start time. Reporting time is your venue arrival hour.');
    } else {
      setTimeWarning(null);
    }
  };

  const handleCancelExtraction = () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
    setExtracting(false);
    setProgressStage('IDLE');
    setSelectedFile(null);
    setFilePreview(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const executeExtraction = async (base64Payload: string, mime: string) => {
    setExtracting(true);
    setProgressStage('READING_DETAILS');
    setExtractionError(null);

    const controller = new AbortController();
    abortControllerRef.current = controller;

    try {
      const response = await fetch('/api/extract-hallticket', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Cache-Control': 'no-store, no-cache',
        },
        signal: controller.signal,
        body: JSON.stringify({
          imageBase64: base64Payload,
          mimeType: mime,
        }),
      });

      const resJson = await response.json();
      if (!resJson.success) {
        throw new Error(resJson.error || 'Failed to extract hall ticket data.');
      }

      const extracted: HallTicketExtractionResult = resJson.data;

      // Check if document was classified as unreadable or non-hall-ticket
      if (extracted.is_hall_ticket === false) {
        setExtractionError('The uploaded image could not be verified as an NPTEL admit card, or the text was unreadable. You can try a clearer image or enter details manually.');
        setExtracting(false);
        setProgressStage('IDLE');
        return;
      }

      // Stage 3: Matching your course and exam centre...
      setProgressStage('MATCHING_LOGISTICS');

      // Canonical Course Matching with Official SRM AP MOOC Catalogue
      const courseRes = resolveCanonicalCourseMatch(
        { title: extracted.course_name, code: extracted.course_code },
        allCourses
      );

      let matchedCourse: Course | null = null;
      if (courseRes.matchedCourse) {
        matchedCourse = courseRes.matchedCourse;
      } else if (courseRes.candidates.length > 0 && courseRes.candidates[0].isStrongMatch) {
        matchedCourse = courseRes.candidates[0].course;
      }

      if (matchedCourse) {
        extracted.course_name = matchedCourse.name;
        extracted.course_code = matchedCourse.code;
        extracted.course_id = matchedCourse.id;
        setSelectedCanonicalCourse(matchedCourse);
      } else {
        if (!extracted.ambiguous_fields.includes('course_name')) {
          extracted.ambiguous_fields.push('course_name');
        }
        setSelectedCanonicalCourse(null);
      }

      // Check if verifying an existing course-only exam: compare extracted course with pending course
      if (existingExam?.course) {
        const match = calculateCourseMatch(extracted.course_name, existingExam.course);
        if (!match.isStrongMatch) {
          setCourseDiffNotice({
            oldCourseName: existingExam.course.name,
            newCourseName: extracted.course_name,
          });
        } else {
          setCourseDiffNotice(null);
        }
      } else {
        setCourseDiffNotice(null);
      }

      setFormData(extracted);
      validateTimes(extracted.reporting_time, extracted.exam_start_time);

      // Discard in-memory image reference immediately for strict privacy
      setSelectedFile(null);
      setFilePreview(null);
      if (fileInputRef.current) fileInputRef.current.value = '';

      // Stage 5: Complete — review your details
      setProgressStage('COMPLETE');
      setTimeout(() => {
        setExtracting(false);
        setProgressStage('IDLE');
        setStep('REVIEW_AI');
      }, 400);

    } catch (err: any) {
      if (err.name === 'AbortError') {
        setExtractionError('Hall-ticket processing cancelled.');
      } else {
        setExtractionError(err.message || 'Error communicating with AI extraction service.');
      }
      setExtracting(false);
      setProgressStage('IDLE');
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const validTypes = ['image/jpeg', 'image/png', 'image/webp'];
    if (!validTypes.includes(file.type)) {
      setExtractionError('Please upload a valid image file (JPEG, PNG, or WebP).');
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      setExtractionError('File size exceeds 5MB limit. Please crop or compress your hall ticket.');
      return;
    }

    setExtractionError(null);
    setSelectedFile(file);

    // Stage 1: Preparing image...
    setExtracting(true);
    setProgressStage('PREPARING_IMAGE');

    const reader = new FileReader();
    reader.onload = () => {
      const base64 = reader.result as string;
      setFilePreview(base64);
      executeExtraction(base64, file.type);
    };
    reader.onerror = () => {
      setExtractionError('Failed to read image file into memory.');
      setExtracting(false);
      setProgressStage('IDLE');
    };
    reader.readAsDataURL(file);
  };

  const handleStartExtraction = async () => {
    if (!filePreview || !selectedFile) {
      setExtractionError('Please select a hall ticket image first.');
      return;
    }
    executeExtraction(filePreview, selectedFile.type);
  };

  const handleLoadSampleHallTicket = () => {
    const sampleOfficial = allCourses.find(c => c.code === 'MOOC 495') || allCourses[0];
    const sample = {
      course_id: sampleOfficial?.id,
      course_name: sampleOfficial?.name || 'INTRODUCTION TO MACHINE LEARNING',
      course_code: sampleOfficial?.code || 'MOOC 495',
      exam_date: '2026-10-25',
      reporting_time: '07:30',
      exam_start_time: '09:00',
      shift: 'FN' as const,
      centre_name: 'iON Digital Zone iDZ Patamata',
      centre_address: 'Near Benz Circle, High School Road, Patamata',
      city: 'Vijayawada',
      state: 'Andhra Pradesh',
      pincode: '520010',
      ambiguous_fields: ['pincode'],
      confidence_score: 95,
      notes: 'Sample SRM AP admit card parsed. Reporting arrival: 07:30 AM (FN). Exam writing commences: 09:00 AM.',
      is_hall_ticket: true,
    };

    if (existingExam?.course) {
      const match = calculateCourseMatch(sample.course_name, existingExam.course);
      if (!match.isStrongMatch) {
        setCourseDiffNotice({
          oldCourseName: existingExam.course.name,
          newCourseName: sample.course_name,
        });
      } else {
        setCourseDiffNotice(null);
      }
    }

    setSelectedCanonicalCourse(sampleOfficial || null);
    setFormData(sample);
    setTimeWarning(null);
    setStep('REVIEW_AI');
  };

  const handleOpenManualEntry = () => {
    setFormData({
      course_name: existingExam?.course?.name || '',
      course_code: existingExam?.course?.code || '',
      exam_date: '',
      reporting_time: '07:30',
      exam_start_time: '09:00',
      shift: 'FN',
      centre_name: '',
      centre_address: '',
      city: 'Vijayawada',
      state: 'Andhra Pradesh',
      pincode: '',
      ambiguous_fields: [],
      confidence_score: 100,
    });
    setTimeWarning(null);
    setExtractionError(null);
    setSaveError(null);
    setCourseDiffNotice(null);
    setStep('MANUAL_ENTRY');
  };

  const handleSaveConfirmedExam = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;

    if (!formData.course_name.trim()) {
      setSaveError('Please enter a valid MOOC course name.');
      return;
    }

    // Strict validation against Official SRM AP Course Catalogue
    const matchedOfficial = allCourses.find(
      c => c.id === formData.course_id ||
           c.normalized_name === normalizeCourseText(formData.course_name) ||
           (formData.course_code && normalizeCourseCode(c.code) === normalizeCourseCode(formData.course_code))
    );

    if (!matchedOfficial) {
      setSaveError('Course not found in the official SRM AP course list. Please check the name or contact SRM DEALINGS.');
      return;
    }

    if (!formData.exam_date) {
      setSaveError('Please select a valid exam date.');
      return;
    }
    if (!formData.reporting_time) {
      setSaveError('Please enter your official reporting arrival time.');
      return;
    }
    if (!formData.centre_name.trim()) {
      setSaveError('Please enter your test centre name.');
      return;
    }

    setSaving(true);
    setSaveError(null);
    setProgressStage('SAVING_DETAILS');

    try {
      // Atomic all-in-one save operation using server-side RPC (prevents partial records and concurrency collisions)
      await dataService.saveStudentExamAtomic({
        student_id: user.id,
        course_id: matchedOfficial.id,
        course_name: matchedOfficial.name,
        course_code: matchedOfficial.code,
        centre_name: formData.centre_name.trim(),
        centre_address: formData.centre_address.trim() || 'Assigned Test Centre',
        city: formData.city.trim() || 'Vijayawada',
        state: formData.state.trim() || 'Andhra Pradesh',
        pincode: formData.pincode.trim() || '',
        exam_date: formData.exam_date,
        reporting_time: formData.reporting_time,
        exam_start_time: formData.exam_start_time || null,
        shift: formData.shift,
        status: 'CONFIRMED',
      });

      try {
        confetti({ particleCount: 50, spread: 60, origin: { y: 0.6 } });
      } catch {}

      onExamSaved();
      onClose();
    } catch (err: any) {
      setSaveError(err.message || 'Failed to save confirmed exam details.');
    } finally {
      setSaving(false);
      setProgressStage('IDLE');
    }
  };

  const handleSelectAutocompleteCourse = (cand: Course) => {
    setSelectedCanonicalCourse(cand);
    setNoTicketCourseName(cand.name);
    setNoTicketCourseCode(cand.code);
    setIsAutocompleteOpen(false);
    setDuplicateWarning(null);
    setSaveError(null);
  };

  const handleSaveCourseOnlyExam = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!user) return;
    if (!noTicketCourseName.trim()) {
      setSaveError('Please enter your MOOC course title.');
      return;
    }

    // Strict validation against Official SRM AP Course Catalogue
    const matchedOfficial = selectedCanonicalCourse || allCourses.find(
      c => c.normalized_name === normalizeCourseText(noTicketCourseName) ||
           (noTicketCourseCode && normalizeCourseCode(c.code) === normalizeCourseCode(noTicketCourseCode))
    );

    if (!matchedOfficial) {
      setSaveError('Course not found in the official SRM AP course list. Please check the name or contact SRM DEALINGS.');
      return;
    }

    setSaving(true);
    setSaveError(null);
    setProgressStage('SAVING_DETAILS');

    try {
      await dataService.saveStudentExamAtomic({
        student_id: user.id,
        course_id: matchedOfficial.id,
        course_name: matchedOfficial.name,
        course_code: matchedOfficial.code,
        status: 'PENDING_DETAILS',
      });

      try {
        confetti({ particleCount: 30, spread: 50, origin: { y: 0.6 } });
      } catch {}

      onExamSaved();
      onClose();
    } catch (err: any) {
      setSaveError(err.message || 'Failed to register course.');
    } finally {
      setSaving(false);
      setProgressStage('IDLE');
    }
  };

  const isFieldAmbiguous = (fieldKey: string) => {
    return formData.ambiguous_fields?.includes(fieldKey);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/85 backdrop-blur-md animate-fade-in">
      <div className="bg-dark-800 border border-subtle-border rounded-2xl max-w-xl w-full max-h-[90dvh] overflow-y-auto shadow-card">

        {/* Modal Header */}
        <div className="flex items-center justify-between px-4 sm:px-6 py-3.5 sm:py-4 border-b border-subtle-border">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-brand-violet/20 text-brand-accent flex items-center justify-center shrink-0">
              <Sparkles className="w-4 h-4" />
            </div>
            <div className="min-w-0">
              <h2 className="text-xs sm:text-sm font-bold text-white truncate">
                {step === 'CHOICE' && (existingExam ? 'Update My Exam' : 'Set Up My Exam')}
                {step === 'UPLOAD_AI' && 'Upload Hall Ticket (AI OCR)'}
                {step === 'REVIEW_AI' && 'Review & Confirm Extracted Details'}
                {step === 'MANUAL_ENTRY' && 'Enter Exam Details Manually'}
                {step === 'NO_HALL_TICKET' && 'Join via MOOC Course Title'}
              </h2>
              <p className="text-[10px] sm:text-[11px] text-subtle-text truncate">MoocDeal - SRM DEALINGS</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-subtle-text hover:text-white hover:bg-white/5 transition-colors shrink-0"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* STEP 1: CHOICE SCREEN */}
        {step === 'CHOICE' && (
          <div className="p-4 sm:p-6 space-y-5 sm:space-y-6">
            <div className="text-center max-w-md mx-auto space-y-1">
              <h3 className="text-base font-bold text-white">
                {existingExam?.status === 'PENDING_DETAILS'
                  ? 'Verify your pending hall ticket'
                  : 'Set up your MOOC exam details'}
              </h3>
              <p className="text-xs text-subtle-text leading-relaxed">
                Connect with SRM AP peers attending the same exam centre slot, or find classmates studying the same course.
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {/* Option 1: Upload Hall Ticket (PRIMARY / RECOMMENDED) */}
              <div
                onClick={() => setStep('UPLOAD_AI')}
                className="group p-5 rounded-2xl border border-subtle-border hover:border-brand-violet bg-dark-850 hover:bg-dark-750 transition-all cursor-pointer flex flex-col justify-between"
              >
                <div>
                  <div className="w-10 h-10 rounded-xl bg-brand-violet/10 text-brand-accent flex items-center justify-center mb-3">
                    <Sparkles className="w-5 h-5" />
                  </div>
                  <span className="text-[9px] font-bold uppercase tracking-wider text-brand-accent bg-brand-violet/20 px-2 py-0.5 rounded">
                    Recommended
                  </span>
                  <h4 className="text-xs font-bold text-white mt-2">
                    Upload Hall Ticket
                  </h4>
                  <p className="text-[11px] text-subtle-text mt-1 leading-relaxed">
                    AI automatically extracts your exam venue, date, and reporting slot with in-memory zero retention.
                  </p>
                </div>
                <div className="mt-4 flex items-center text-xs font-semibold text-brand-accent group-hover:translate-x-1 transition-transform">
                  <span>Upload Admit Card</span>
                  <ArrowRight className="w-3.5 h-3.5 ml-1" />
                </div>
              </div>

              {/* Option 2: I Don't Have Hall Ticket Yet */}
              <div
                onClick={() => setStep('NO_HALL_TICKET')}
                className="group p-5 rounded-2xl border border-subtle-border hover:border-slate-500 bg-dark-850 hover:bg-dark-750 transition-all cursor-pointer flex flex-col justify-between"
              >
                <div>
                  <div className="w-10 h-10 rounded-xl bg-white/5 text-slate-300 flex items-center justify-center mb-3">
                    <BookOpen className="w-5 h-5" />
                  </div>
                  <span className="text-[9px] font-bold uppercase tracking-wider text-slate-400 bg-white/5 px-2 py-0.5 rounded">
                    Admit Card Pending
                  </span>
                  <h4 className="text-xs font-bold text-white mt-2">
                    I Don't Have Hall Ticket Yet
                  </h4>
                  <p className="text-[11px] text-subtle-text mt-1 leading-relaxed">
                    Don't have your hall ticket yet? Enter your course details manually and connect with study peers. You can upload your hall ticket later to verify your exam centre and reporting slot.
                  </p>
                </div>
                <div className="mt-4 space-y-2">
                  <div className="flex items-center text-xs font-semibold text-slate-400 group-hover:translate-x-1 transition-transform">
                    <span>Course Only</span>
                    <ArrowRight className="w-3.5 h-3.5 ml-1" />
                  </div>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleOpenManualEntry();
                    }}
                    className="text-[11px] text-subtle-text hover:text-white underline inline-flex items-center gap-1.5 text-left transition-colors"
                  >
                    <Edit3 className="w-3.5 h-3.5 shrink-0" />
                    <span>Prefer to enter all exam details manually? Click here</span>
                  </button>
                </div>
              </div>
            </div>

            <div className="p-3 rounded-xl bg-white/5 border border-white/5 text-[11px] text-subtle-text flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-emerald-400 shrink-0" />
              <span>Zero-Storage Guarantee: Hall tickets are processed in RAM and discarded immediately.</span>
            </div>
          </div>
        )}

        {/* STEP 2: UPLOAD SCREEN */}
        {step === 'UPLOAD_AI' && (
          <div className="p-6 space-y-5">
            <div className="flex items-center justify-between">
              <button
                type="button"
                onClick={() => setStep('CHOICE')}
                className="text-xs text-subtle-text hover:text-white"
              >
                ← Back
              </button>
              <button
                type="button"
                onClick={handleLoadSampleHallTicket}
                className="text-xs font-medium text-brand-accent bg-white/5 hover:bg-white/10 px-2.5 py-1 rounded-lg border border-white/10 transition-colors"
              >
                ⚡ Use Sample Admit Card
              </button>
            </div>

            {/* Zero-Storage & Ephemeral Privacy Notice */}
            <div className="p-3.5 rounded-xl bg-dark-850 border border-subtle-border text-[11px] text-subtle-text flex items-start gap-2.5">
              <ShieldCheck className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
              <div className="space-y-0.5 leading-relaxed">
                <span className="text-white font-medium block">Zero-Storage Privacy Notice</span>
                <span>
                  Your admit card image is processed entirely in RAM to extract venue and reporting logistics, and is discarded immediately. No image bytes or files are stored in databases, logs, or persistent file stores.
                </span>
              </div>
            </div>

            {existingExam?.status === 'PENDING_DETAILS' && (
              <div className="p-3 text-xs bg-brand-violet/10 border border-brand-violet/20 text-brand-accent rounded-xl">
                Verifying your previously registered course: <strong>{existingExam.course?.name}</strong>. Uploading your hall ticket will unlock your matching centre and slot.
              </div>
            )}

            {extractionError && (
              <div className="p-4 text-xs bg-rose-500/10 border border-rose-500/20 text-rose-300 rounded-xl space-y-2">
                <div className="flex items-start gap-2">
                  <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5 text-rose-400" />
                  <span className="leading-relaxed">{extractionError}</span>
                </div>
                <div className="flex items-center gap-3 pt-1">
                  <button
                    type="button"
                    onClick={() => {
                      setExtractionError(null);
                      setSelectedFile(null);
                      setFilePreview(null);
                      if (fileInputRef.current) fileInputRef.current.value = '';
                    }}
                    className="text-[11px] font-semibold text-white underline hover:text-brand-accent"
                  >
                    Retry with another image
                  </button>
                  <button
                    type="button"
                    onClick={handleOpenManualEntry}
                    className="text-[11px] text-subtle-text underline hover:text-white"
                  >
                    Switch to manual entry
                  </button>
                </div>
              </div>
            )}

            {extracting ? (
              /* 5-Stage Animated Progress Feedback */
              <div className="p-6 rounded-2xl bg-dark-850 border border-brand-violet/30 space-y-5 text-center">
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-[11px] font-semibold text-slate-300 mb-1">
                    <span className="flex items-center gap-1.5 text-brand-accent">
                      <Sparkles className="w-3.5 h-3.5 animate-spin" style={{ animationDuration: '3s' }} />
                      Processing Admit Card
                    </span>
                    <span className="text-subtle-text font-mono">
                      {progressStage === 'PREPARING_IMAGE' && 'Stage 1 of 5'}
                      {progressStage === 'READING_DETAILS' && 'Stage 2 of 5'}
                      {progressStage === 'MATCHING_LOGISTICS' && 'Stage 3 of 5'}
                      {progressStage === 'SAVING_DETAILS' && 'Stage 4 of 5'}
                      {progressStage === 'COMPLETE' && 'Stage 5 of 5'}
                    </span>
                  </div>

                  {/* Animated Progress Bar */}
                  <div className="w-full bg-white/5 rounded-full h-2.5 overflow-hidden border border-white/10">
                    <div
                      className="bg-gradient-to-r from-purple-500 via-brand-violet to-emerald-400 h-full transition-all duration-500 ease-out rounded-full"
                      style={{
                        width: progressStage === 'PREPARING_IMAGE' ? '20%' :
                               progressStage === 'READING_DETAILS' ? '50%' :
                               progressStage === 'MATCHING_LOGISTICS' ? '80%' :
                               progressStage === 'SAVING_DETAILS' ? '90%' : '100%'
                      }}
                    />
                  </div>

                  {/* 5 Stages Labels */}
                  <div className="grid grid-cols-5 text-[9px] text-center pt-1 font-medium">
                    <span className={progressStage === 'PREPARING_IMAGE' ? 'text-brand-accent font-bold' : 'text-subtle-text'}>1. Prepare</span>
                    <span className={progressStage === 'READING_DETAILS' ? 'text-brand-accent font-bold' : 'text-subtle-text'}>2. Read</span>
                    <span className={progressStage === 'MATCHING_LOGISTICS' ? 'text-brand-accent font-bold' : 'text-subtle-text'}>3. Match</span>
                    <span className={progressStage === 'SAVING_DETAILS' ? 'text-brand-accent font-bold' : 'text-subtle-text'}>4. Save</span>
                    <span className={progressStage === 'COMPLETE' ? 'text-emerald-400 font-bold' : 'text-subtle-text'}>5. Review</span>
                  </div>
                </div>

                {/* Status Message */}
                <div className="py-2 space-y-1">
                  <h4 className="text-sm font-bold text-white flex items-center justify-center gap-2">
                    <div className="w-3.5 h-3.5 border-2 border-brand-accent border-t-transparent rounded-full animate-spin" />
                    {progressStage === 'PREPARING_IMAGE' && 'Preparing image...'}
                    {progressStage === 'READING_DETAILS' && 'Reading hall-ticket details...'}
                    {progressStage === 'MATCHING_LOGISTICS' && 'Matching your course and exam centre...'}
                    {progressStage === 'SAVING_DETAILS' && 'Saving your confirmed exam details...'}
                    {progressStage === 'COMPLETE' && 'Complete — review your details'}
                  </h4>
                  <p className="text-xs text-subtle-text max-w-sm mx-auto">
                    {progressStage === 'PREPARING_IMAGE' && 'Loading admit card strictly in memory without persistent storage.'}
                    {progressStage === 'READING_DETAILS' && 'Parsing course title, exam date, reporting arrival time, and venue.'}
                    {progressStage === 'MATCHING_LOGISTICS' && 'Deduplicating against canonical courses and exam centre cohorts.'}
                    {progressStage === 'SAVING_DETAILS' && 'Synchronizing verified database record atomically.'}
                    {progressStage === 'COMPLETE' && 'Logistics parsed successfully! Moving to confirmation screen.'}
                  </p>
                </div>

                {/* Cancel Action */}
                <div className="pt-1">
                  <button
                    type="button"
                    onClick={handleCancelExtraction}
                    className="text-xs text-rose-400 hover:text-rose-300 px-4 py-2 rounded-xl bg-rose-500/10 border border-rose-500/20 hover:bg-rose-500/20 transition-all font-medium"
                  >
                    Cancel Processing
                  </button>
                </div>
              </div>
            ) : (
              /* Dropzone when idle */
              <>
                <div
                  onClick={() => fileInputRef.current?.click()}
                  className={`border-2 border-dashed rounded-2xl p-8 text-center cursor-pointer transition-all ${
                    filePreview
                      ? 'border-emerald-500/50 bg-emerald-500/5'
                      : 'border-subtle-border hover:border-brand-violet bg-dark-850 hover:bg-dark-750'
                  }`}
                >
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/jpeg,image/png,image/webp"
                    onChange={handleFileChange}
                    className="hidden"
                  />

                  {filePreview ? (
                    <div className="space-y-3">
                      <div className="w-12 h-12 rounded-xl bg-emerald-500/10 text-emerald-400 mx-auto flex items-center justify-center">
                        <CheckCircle2 className="w-6 h-6" />
                      </div>
                      <div>
                        <p className="text-xs font-semibold text-white">
                          Admit card loaded in RAM: {selectedFile?.name}
                        </p>
                        <p className="text-[11px] text-subtle-text mt-1">
                          Click to extract exam centre, reporting slot, and course logistics.
                        </p>
                      </div>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      <div className="w-12 h-12 rounded-xl bg-brand-violet/10 text-brand-accent mx-auto flex items-center justify-center">
                        <Upload className="w-6 h-6" />
                      </div>
                      <div>
                        <p className="text-xs font-semibold text-white">
                          Click to upload NPTEL Hall Ticket
                        </p>
                        <p className="text-[11px] text-subtle-text mt-1">
                          PNG, JPEG, or WebP (max 5MB). Processed strictly in RAM.
                        </p>
                      </div>
                    </div>
                  )}
                </div>

                <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-2">
                  <button
                    type="button"
                    onClick={handleOpenManualEntry}
                    className="w-full sm:w-auto text-xs text-subtle-text hover:text-white py-1 text-center sm:text-left min-h-[36px]"
                  >
                    Or enter details manually →
                  </button>

                  <button
                    type="button"
                    onClick={handleStartExtraction}
                    disabled={!filePreview || extracting}
                    className="w-full sm:w-auto px-5 py-2.5 text-xs font-semibold text-white bg-brand-violet hover:bg-purple-700 disabled:opacity-50 rounded-xl transition-all shadow-glow flex items-center justify-center gap-2 min-h-[44px]"
                  >
                    <Sparkles className="w-3.5 h-3.5" />
                    <span>Extract Logistics with AI</span>
                  </button>
                </div>
              </>
            )}
          </div>
        )}

        {/* STEP 3: EDITABLE CONFIRMATION FORM (AI REVIEW OR MANUAL ENTRY) */}
        {(step === 'REVIEW_AI' || step === 'MANUAL_ENTRY') && (
          <form onSubmit={handleSaveConfirmedExam} className="p-4 sm:p-6 space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                {step === 'REVIEW_AI' ? (
                  <span className="text-xs font-semibold text-emerald-400 flex items-center gap-1.5">
                    <CheckCircle2 className="w-4 h-4" /> AI Extracted Logistics
                  </span>
                ) : (
                  <span className="text-xs font-semibold text-brand-accent flex items-center gap-1.5">
                    <Edit3 className="w-4 h-4" /> Manual Exam Entry
                  </span>
                )}
                {step === 'REVIEW_AI' && formData.confidence_score && (
                  <span className="text-[10px] px-2 py-0.5 rounded-full bg-white/5 border border-white/10 text-subtle-text font-mono">
                    {formData.confidence_score}% confidence
                  </span>
                )}
              </div>

              {step === 'REVIEW_AI' ? (
                <button
                  type="button"
                  onClick={() => setStep('UPLOAD_AI')}
                  className="text-xs text-subtle-text hover:text-white flex items-center gap-1"
                >
                  <RotateCcw className="w-3 h-3" /> Re-upload Image
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => setStep('UPLOAD_AI')}
                  className="text-xs text-brand-accent hover:underline flex items-center gap-1"
                >
                  <Upload className="w-3 h-3" /> Use AI Upload Instead
                </button>
              )}
            </div>

            {/* Course difference review banner when verifying hall ticket later */}
            {courseDiffNotice && (
              <div className="p-3.5 text-xs bg-amber-500/10 border border-amber-500/30 text-amber-300 rounded-xl space-y-1.5">
                <div className="flex items-center gap-2 font-semibold text-amber-200">
                  <AlertTriangle className="w-4 h-4 shrink-0" />
                  <span>Course Update Notice</span>
                </div>
                <p className="text-[11px] text-amber-200/90 leading-relaxed">
                  Your hall ticket indicates <strong>"{courseDiffNotice.newCourseName}"</strong>, which differs from your pending course <strong>"{courseDiffNotice.oldCourseName}"</strong>. Please confirm the course title below to update your record and match with the correct exam centre cohort.
                </p>
              </div>
            )}

            {/* Banner for Flagged / Ambiguous Fields */}
            {step === 'REVIEW_AI' && formData.ambiguous_fields && formData.ambiguous_fields.length > 0 && (
              <div className="p-3 text-xs bg-amber-500/10 border border-amber-500/20 text-amber-300 rounded-xl space-y-1">
                <div className="flex items-center gap-1.5 font-semibold">
                  <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0" />
                  <span>Uncertain Fields Flagged for Verification</span>
                </div>
                <p className="text-[11px] text-amber-200/80 leading-relaxed">
                  The model flagged the following fields as ambiguous: <strong className="font-mono">{formData.ambiguous_fields.join(', ')}</strong>. Please review before confirming.
                </p>
              </div>
            )}

            {/* Time warning banner */}
            {timeWarning && (
              <div className="p-3 text-xs bg-amber-500/10 border border-amber-500/20 text-amber-300 rounded-xl flex items-start gap-2">
                <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                <span className="leading-relaxed">{timeWarning}</span>
              </div>
            )}

            {saveError && (
              <div className="p-3 text-xs bg-rose-500/10 border border-rose-500/20 text-rose-300 rounded-xl">
                {saveError}
              </div>
            )}

            {/* Candidate & Registration Verification Card */}
            {(formData.candidate_name || formData.reg_no) && (
              <div className="p-3.5 rounded-xl bg-dark-850 border border-subtle-border flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
                <div className="space-y-1">
                  <span className="text-[10px] text-emerald-400 uppercase font-semibold flex items-center gap-1.5">
                    <CheckCircle2 className="w-3.5 h-3.5" /> Candidate Verified from Admit Card
                  </span>
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-white font-medium">{formData.candidate_name || user?.full_name || 'SRM Student'}</span>
                    {formData.reg_no && (
                      <span className="text-slate-300 font-mono text-[11px] bg-white/5 px-2 py-0.5 rounded border border-white/10">
                        NPTEL Roll: <span className="text-brand-accent font-semibold">{formData.reg_no}</span>
                      </span>
                    )}
                  </div>
                </div>
                {user && (
                  <div className="sm:text-right shrink-0">
                    <span className="text-[10px] text-subtle-text uppercase block font-medium">SRM AP Reg No</span>
                    <span className="text-white font-mono font-medium text-[11px] bg-white/5 px-2 py-0.5 rounded border border-white/10 inline-block mt-0.5">{user.reg_no}</span>
                  </div>
                )}
              </div>
            )}

            <div className="space-y-3.5">

              {/* One-tap Course Suggestion Banner: e.g. "Did you mean Human Physiology (BT79)?" */}
              {manualCourseResolution?.suggestion && (
                <div className="p-3.5 rounded-xl bg-brand-violet/15 border border-brand-violet/40 text-xs flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 animate-fade-in">
                  <div className="flex items-center gap-2">
                    <Sparkles className="w-4 h-4 text-brand-accent shrink-0" />
                    <div>
                      <p className="font-semibold text-white">{manualCourseResolution.suggestion.text}</p>
                      <p className="text-[11px] text-subtle-text">Matches verified canonical course from confirmed hall tickets.</p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setFormData({
                        ...formData,
                        course_name: manualCourseResolution.suggestion!.course.name,
                        course_code: manualCourseResolution.suggestion!.course.code,
                      });
                      setManualCourseResolution(null);
                      setIsManualCourseDropdownOpen(false);
                    }}
                    className="px-3 py-1.5 rounded-lg bg-brand-violet hover:bg-purple-600 text-white font-semibold text-xs transition-colors shrink-0 flex items-center justify-center gap-1 shadow-glow"
                  >
                    <Check className="w-3.5 h-3.5" />
                    <span>Confirm & Use</span>
                  </button>
                </div>
              )}

              {/* Course Name & Code */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className={`sm:col-span-2 p-2 rounded-xl relative transition-all ${
                  isFieldAmbiguous('course_name') ? 'bg-amber-500/5 border border-amber-500/30' : ''
                }`}>
                  <div className="flex items-center justify-between mb-1">
                    <label className="block text-[11px] font-medium text-slate-300">
                      MOOC Course Name *
                    </label>
                    {isFieldAmbiguous('course_name') && (
                      <span className="text-[10px] text-amber-400 font-semibold">Flagged</span>
                    )}
                  </div>
                  <input
                    type="text"
                    value={formData.course_name}
                    onChange={e => {
                      setFormData({ ...formData, course_name: e.target.value });
                      setIsManualCourseDropdownOpen(true);
                    }}
                    onFocus={() => {
                      if (manualCourseSuggestions.length > 0) setIsManualCourseDropdownOpen(true);
                    }}
                    placeholder="e.g. Deep Learning"
                    className="w-full text-xs px-3 py-2 rounded-xl bg-dark-850 border border-subtle-border text-white focus:outline-none focus:border-brand-violet"
                    required
                  />

                  {/* Course Dropdown */}
                  {isManualCourseDropdownOpen && manualCourseSuggestions.length > 0 && (
                    <div className="absolute left-2 right-2 mt-1 z-30 bg-dark-850 border border-white/15 rounded-xl shadow-2xl max-h-48 overflow-y-auto divide-y divide-white/5">
                      {manualCourseSuggestions.map(item => (
                        <div
                          key={item.course.id}
                          onClick={() => {
                            setFormData({
                              ...formData,
                              course_name: item.course.name,
                              course_code: item.course.code,
                            });
                            setSelectedCanonicalCourse(item.course);
                            setIsManualCourseDropdownOpen(false);
                            setManualCourseResolution(null);
                            setSaveError(null);
                          }}
                          className="p-2.5 hover:bg-white/5 cursor-pointer transition-colors flex items-center justify-between text-xs"
                        >
                          <div>
                            <p className="font-semibold text-white">{item.course.name}</p>
                            <p className="text-[10px] font-mono text-subtle-text">{item.course.code}</p>
                          </div>
                          {item.isStrongMatch ? (
                            <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
                              Verified
                            </span>
                          ) : (
                            <span className="text-[10px] px-1.5 py-0.5 rounded bg-white/5 text-slate-400">
                              Similar
                            </span>
                          )}
                        </div>
                      ))}
                    </div>
                  )}

                  {selectedCanonicalCourse && (
                    <div className="mt-1.5 flex items-center gap-1.5 text-[11px] text-emerald-400 font-medium">
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      <span>Official SRM AP MOOC: {selectedCanonicalCourse.name} ({selectedCanonicalCourse.code})</span>
                    </div>
                  )}

                  {formData.course_name.trim().length >= 2 && manualCourseSuggestions.length === 0 && !selectedCanonicalCourse && (
                    <div className="mt-2 p-2.5 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-300 text-xs flex items-start gap-2">
                      <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
                      <span>Course not found in the official SRM AP course list. Please check the name or contact SRM DEALINGS.</span>
                    </div>
                  )}
                </div>

                <div className={`p-2 rounded-xl transition-all ${
                  isFieldAmbiguous('course_code') ? 'bg-amber-500/5 border border-amber-500/30' : ''
                }`}>
                  <label className="block text-[11px] font-medium text-slate-300 mb-1">
                    Course Code
                  </label>
                  <input
                    type="text"
                    value={formData.course_code}
                    onChange={e => setFormData({ ...formData, course_code: e.target.value })}
                    placeholder="noc24-cs101"
                    className="w-full text-xs font-mono px-3 py-2 rounded-xl bg-dark-850 border border-subtle-border text-white focus:outline-none focus:border-brand-violet"
                  />
                </div>
              </div>

              {/* Schedule Details */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className={`p-2 rounded-xl transition-all ${
                  isFieldAmbiguous('exam_date') ? 'bg-amber-500/5 border border-amber-500/30' : ''
                }`}>
                  <label className="block text-[11px] font-medium text-slate-300 mb-1 flex items-center gap-1">
                    <Calendar className="w-3 h-3 text-subtle-text" />
                    <span>Exam Date *</span>
                  </label>
                  <input
                    type="date"
                    value={formData.exam_date}
                    onChange={e => setFormData({ ...formData, exam_date: e.target.value })}
                    className="w-full text-xs px-3 py-2 rounded-xl bg-dark-850 border border-subtle-border text-white focus:outline-none focus:border-brand-violet"
                    required
                  />
                </div>

                <div className={`p-2 rounded-xl transition-all ${
                  isFieldAmbiguous('reporting_time') ? 'bg-amber-500/5 border border-amber-500/30' : ''
                }`}>
                  <label className="block text-[11px] font-medium text-brand-accent mb-1 flex items-center gap-1">
                    <Clock className="w-3 h-3 text-brand-accent" />
                    <span>Reporting Time *</span>
                  </label>
                  <input
                    type="time"
                    value={formData.reporting_time}
                    onChange={e => {
                      setFormData({ ...formData, reporting_time: e.target.value });
                      validateTimes(e.target.value, formData.exam_start_time);
                    }}
                    className="w-full text-xs font-mono px-3 py-2 rounded-xl bg-dark-850 border border-brand-violet/50 text-white focus:outline-none focus:border-brand-violet"
                    required
                  />
                </div>

                <div className={`p-2 rounded-xl transition-all ${
                  isFieldAmbiguous('shift') ? 'bg-amber-500/5 border border-amber-500/30' : ''
                }`}>
                  <label className="block text-[11px] font-medium text-slate-300 mb-1">
                    Shift
                  </label>
                  <select
                    value={formData.shift}
                    onChange={e => setFormData({ ...formData, shift: e.target.value as 'FN' | 'AN' })}
                    className="w-full text-xs px-3 py-2 rounded-xl bg-dark-850 border border-subtle-border text-white focus:outline-none focus:border-brand-violet"
                  >
                    <option value="FN">FN (Morning)</option>
                    <option value="AN">AN (Afternoon)</option>
                  </select>
                </div>
              </div>

              {/* Centre Information */}
              <div className="space-y-2 pt-2 border-t border-white/5">
                <div className={`p-2 rounded-xl relative transition-all ${
                  isFieldAmbiguous('centre_name') ? 'bg-amber-500/5 border border-amber-500/30' : ''
                }`}>
                  <label className="block text-[11px] font-medium text-slate-300 mb-1 flex items-center gap-1">
                    <MapPin className="w-3 h-3 text-subtle-text" />
                    <span>Test Centre Name *</span>
                  </label>
                  <input
                    type="text"
                    value={formData.centre_name}
                    onChange={e => {
                      setFormData({ ...formData, centre_name: e.target.value });
                      setIsManualCentreDropdownOpen(true);
                    }}
                    onFocus={() => {
                      if (manualCentreSuggestions.length > 0) setIsManualCentreDropdownOpen(true);
                    }}
                    placeholder="e.g. iON Digital Zone iDZ Patamata"
                    className="w-full text-xs px-3 py-2 rounded-xl bg-dark-850 border border-subtle-border text-white focus:outline-none focus:border-brand-violet"
                    required
                  />

                  {/* Centre Autocomplete Dropdown */}
                  {isManualCentreDropdownOpen && manualCentreSuggestions.length > 0 && (
                    <div className="absolute left-2 right-2 mt-1 z-30 bg-dark-850 border border-white/15 rounded-xl shadow-2xl max-h-48 overflow-y-auto divide-y divide-white/5">
                      <div className="px-3 py-1.5 text-[10px] uppercase font-semibold text-subtle-text bg-dark-900 tracking-wider">
                        Existing Exam Centres ({manualCentreSuggestions.length})
                      </div>
                      {manualCentreSuggestions.map(item => (
                        <div
                          key={item.centre.id}
                          onClick={() => {
                            setFormData({
                              ...formData,
                              centre_name: item.centre.name,
                              centre_address: item.centre.address,
                              city: item.centre.city,
                              state: item.centre.state || 'Andhra Pradesh',
                              pincode: item.centre.pincode || '',
                            });
                            setIsManualCentreDropdownOpen(false);
                          }}
                          className="p-2.5 hover:bg-white/5 cursor-pointer transition-colors flex items-center justify-between text-xs"
                        >
                          <div>
                            <p className="font-semibold text-white">{item.centre.name}</p>
                            <p className="text-[10px] text-subtle-text truncate max-w-xs">{item.centre.address} · {item.centre.city}</p>
                          </div>
                          {item.centre.is_verified ? (
                            <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 font-medium">
                              Verified
                            </span>
                          ) : (
                            <span className="text-[10px] px-1.5 py-0.5 rounded bg-white/5 text-slate-400">
                              Known Venue
                            </span>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                <div className="p-2">
                  <label className="block text-[11px] font-medium text-slate-300 mb-1">
                    Centre Address
                  </label>
                  <input
                    type="text"
                    value={formData.centre_address}
                    onChange={e => setFormData({ ...formData, centre_address: e.target.value })}
                    placeholder="Street, locality, landmark"
                    className="w-full text-xs px-3 py-2 rounded-xl bg-dark-850 border border-subtle-border text-white focus:outline-none focus:border-brand-violet"
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 p-2">
                  <div>
                    <label className="block text-[11px] font-medium text-slate-300 mb-1">City</label>
                    <input
                      type="text"
                      value={formData.city}
                      onChange={e => setFormData({ ...formData, city: e.target.value })}
                      className="w-full text-xs px-3 py-2 rounded-xl bg-dark-850 border border-subtle-border text-white focus:outline-none focus:border-brand-violet"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-medium text-slate-300 mb-1">State</label>
                    <input
                      type="text"
                      value={formData.state}
                      onChange={e => setFormData({ ...formData, state: e.target.value })}
                      className="w-full text-xs px-3 py-2 rounded-xl bg-dark-850 border border-subtle-border text-white focus:outline-none focus:border-brand-violet"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-medium text-slate-300 mb-1">Pincode</label>
                    <input
                      type="text"
                      value={formData.pincode}
                      onChange={e => setFormData({ ...formData, pincode: e.target.value })}
                      placeholder="520010"
                      maxLength={6}
                      className="w-full text-xs font-mono px-3 py-2 rounded-xl bg-dark-850 border border-subtle-border text-white focus:outline-none focus:border-brand-violet"
                    />
                  </div>
                </div>
              </div>
            </div>

            <div className="flex items-center justify-between pt-3 border-t border-white/5 gap-2">
              <button
                type="button"
                onClick={() => setStep('CHOICE')}
                className="px-4 py-2.5 text-xs text-subtle-text hover:text-white min-h-[42px]"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={saving || !!timeWarning || (formData.course_name.trim().length >= 2 && manualCourseSuggestions.length === 0 && !selectedCanonicalCourse)}
                className="px-5 py-2.5 text-xs font-semibold text-white bg-brand-violet hover:bg-purple-700 disabled:opacity-50 rounded-xl transition-all shadow-glow flex items-center justify-center gap-2 min-h-[44px]"
              >
                {saving ? (
                  <>
                    <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    <span>Saving your confirmed exam details...</span>
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    <span>Confirm & Save My Exam</span>
                  </>
                )}
              </button>
            </div>
          </form>
        )}

        {/* STEP 4: OPTION B (NO HALL TICKET - OFFICIAL COURSE AUTOCOMPLETE) */}
        {step === 'NO_HALL_TICKET' && (
          <form onSubmit={handleSaveCourseOnlyExam} className="p-4 sm:p-6 space-y-4">
            <button
              type="button"
              onClick={() => setStep('CHOICE')}
              className="text-xs text-subtle-text hover:text-white py-1"
            >
              ← Back
            </button>

            <div className="p-3.5 rounded-xl bg-white/5 border border-white/10 text-xs text-subtle-text leading-relaxed">
              No hall ticket required right now. Enter your course title to connect with study peers immediately. You can upload your admit card details whenever they are released.
            </div>

            {saveError && (
              <div className="p-3 text-xs bg-rose-500/10 border border-rose-500/20 text-rose-300 rounded-xl">
                {saveError}
              </div>
            )}

            {/* One-tap Suggestion Card: e.g. "Did you mean Human Physiology (BT79)?" */}
            {courseResolution?.suggestion && !selectedCanonicalCourse && (
              <div className="p-3.5 rounded-xl bg-brand-violet/15 border border-brand-violet/40 text-xs flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 animate-fade-in">
                <div className="flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-brand-accent shrink-0" />
                  <div>
                    <p className="font-semibold text-white">{courseResolution.suggestion.text}</p>
                    <p className="text-[11px] text-subtle-text">Matches verified canonical course from confirmed hall tickets.</p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => handleSelectAutocompleteCourse(courseResolution.suggestion!.course)}
                  className="px-3 py-1.5 rounded-lg bg-brand-violet hover:bg-purple-600 text-white font-semibold text-xs transition-colors shrink-0 flex items-center justify-center gap-1 shadow-glow"
                >
                  <Check className="w-3.5 h-3.5" />
                  <span>Confirm & Use</span>
                </button>
              </div>
            )}

            {/* Explicit Code Conflict Banner */}
            {courseResolution?.status === 'CODE_CONFLICT' && (
              <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/30 text-xs text-amber-300 flex items-start gap-2">
                <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5 text-amber-400" />
                <span className="leading-relaxed">{courseResolution.reason}. Distinct courses cannot be merged silently.</span>
              </div>
            )}

            <div className="space-y-3.5">
              <div className="relative">
                <label className="block text-xs font-medium text-slate-300 mb-1">
                  NPTEL MOOC Course Title *
                </label>
                <div className="relative">
                  <input
                    type="text"
                    value={noTicketCourseName}
                    onChange={e => {
                      setNoTicketCourseName(e.target.value);
                      setSelectedCanonicalCourse(null);
                      setDuplicateWarning(null);
                    }}
                    onFocus={() => {
                      if (courseSuggestions.length > 0) setIsAutocompleteOpen(true);
                    }}
                    placeholder="Type to search e.g. Deep Learning, Cloud Computing..."
                    className="w-full text-xs px-3.5 py-2.5 rounded-xl bg-dark-850 border border-subtle-border text-white focus:outline-none focus:border-brand-violet"
                    required
                  />
                  <Search className="w-3.5 h-3.5 text-subtle-text absolute right-3.5 top-3 pointer-events-none" />
                </div>

                {/* Selected course indicator */}
                {selectedCanonicalCourse && (
                  <div className="mt-1.5 flex items-center gap-1.5 text-[11px] text-emerald-400 font-medium">
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    <span>Selected canonical course: {selectedCanonicalCourse.name} ({selectedCanonicalCourse.code})</span>
                  </div>
                )}

                {/* Autocomplete Dropdown */}
                {isAutocompleteOpen && (courseSuggestions.length > 0 || aiMatchSuggestion) && (
                  <div className="absolute left-0 right-0 mt-1 z-30 bg-dark-850 border border-white/15 rounded-xl shadow-2xl max-h-56 overflow-y-auto divide-y divide-white/5">
                    {aiMatchSuggestion && (
                      <div
                        onClick={() => {
                          handleSelectAutocompleteCourse(aiMatchSuggestion.course);
                          setAiMatchSuggestion(null);
                        }}
                        className="p-2.5 bg-brand-violet/15 hover:bg-brand-violet/25 cursor-pointer transition-colors flex items-center justify-between text-xs"
                      >
                        <div className="space-y-0.5 pr-2">
                          <div className="flex items-center gap-1.5">
                            <Sparkles className="w-3.5 h-3.5 text-brand-accent shrink-0" />
                            <p className="font-semibold text-white">{aiMatchSuggestion.course.name}</p>
                          </div>
                          <p className="text-[11px] text-brand-accent/90">{aiMatchSuggestion.reason}</p>
                          <p className="text-[10px] font-mono text-subtle-text">{aiMatchSuggestion.course.code}</p>
                        </div>
                        <span className="shrink-0 text-[10px] px-2 py-0.5 rounded-full bg-brand-violet text-white font-bold shadow-sm">
                          AI Matched
                        </span>
                      </div>
                    )}

                    {courseSuggestions.length > 0 && (
                      <div className="px-3 py-1.5 text-[10px] uppercase font-semibold text-subtle-text bg-dark-900 tracking-wider">
                        Matching Canonical Courses ({courseSuggestions.length})
                      </div>
                    )}
                    {courseSuggestions.map(item => (
                      <div
                        key={item.course.id}
                        onClick={() => handleSelectAutocompleteCourse(item.course)}
                        className="p-2.5 hover:bg-white/5 cursor-pointer transition-colors flex items-center justify-between text-xs"
                      >
                        <div className="space-y-0.5 pr-2">
                          <p className="font-semibold text-white">{item.course.name}</p>
                          <p className="text-[10px] font-mono text-subtle-text">{item.course.code}</p>
                        </div>
                        {item.isStrongMatch ? (
                          <span className="shrink-0 text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 font-semibold">
                            Recommended Match
                          </span>
                        ) : (
                          <span className="shrink-0 text-[10px] px-1.5 py-0.5 rounded bg-white/5 text-slate-400 font-mono">
                            Similar
                          </span>
                        )}
                      </div>
                    ))}
                  </div>
                )}

                {noTicketCourseName.trim().length >= 2 && courseSuggestions.length === 0 && !selectedCanonicalCourse && (
                  <div className="mt-2 p-3 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-300 text-xs flex items-start gap-2">
                    <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
                    <span>Course not found in the official SRM AP course list. Please check the name or contact SRM DEALINGS.</span>
                  </div>
                )}
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">
                  Course Code (Optional)
                </label>
                <input
                  type="text"
                  value={noTicketCourseCode}
                  onChange={e => setNoTicketCourseCode(e.target.value)}
                  placeholder="e.g. noc24-cs101"
                  className="w-full text-xs font-mono px-3.5 py-2.5 rounded-xl bg-dark-850 border border-subtle-border text-white focus:outline-none focus:border-brand-violet"
                />
              </div>
            </div>

            <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-white/5">
              <button
                type="button"
                onClick={() => setStep('CHOICE')}
                className="px-4 py-2.5 text-xs text-subtle-text hover:text-white min-h-[42px]"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={saving || !noTicketCourseName.trim() || (noTicketCourseName.trim().length >= 2 && courseSuggestions.length === 0 && !selectedCanonicalCourse)}
                className="px-5 py-2.5 text-xs font-semibold text-white bg-brand-violet hover:bg-purple-700 disabled:opacity-50 rounded-xl transition-all shadow-glow flex items-center justify-center gap-2 min-h-[44px]"
              >
                {saving ? (
                  <>
                    <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    <span>Saving your confirmed exam details...</span>
                  </>
                ) : (
                  'Save Course Only'
                )}
              </button>
            </div>
          </form>
        )}

      </div>
    </div>
  );
};
