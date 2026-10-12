import React, { useState, useRef } from 'react';
import { 
  Sparkles, 
  Upload, 
  FileText, 
  AlertTriangle, 
  CheckCircle2, 
  X, 
  Clock, 
  MapPin, 
  BookOpen, 
  Calendar, 
  HelpCircle, 
  ArrowRight,
  ShieldCheck,
  RotateCcw,
  Info
} from 'lucide-react';
import { HallTicketExtractionResult, Course, ExamCentre } from '../types';
import { dataService } from '../services/dataService';
import { useAuth } from '../context/AuthContext';
import confetti from 'canvas-confetti';

interface OnboardingModalProps {
  isOpen: boolean;
  onClose: () => void;
  onExamSaved: () => void;
  isMandatory?: boolean;
}

export const OnboardingModal: React.FC<OnboardingModalProps> = ({
  isOpen,
  onClose,
  onExamSaved,
  isMandatory = false,
}) => {
  const { user } = useAuth();
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Choice mode: 'CHOICE' | 'UPLOAD_AI' | 'NO_HALL_TICKET' | 'REVIEW_AI'
  const [step, setStep] = useState<'CHOICE' | 'UPLOAD_AI' | 'NO_HALL_TICKET' | 'REVIEW_AI'>('CHOICE');

  // File upload state
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [filePreview, setFilePreview] = useState<string | null>(null);
  const [extracting, setExtracting] = useState(false);
  const [extractionError, setExtractionError] = useState<string | null>(null);

  // Extracted / Review form state
  const [extractedData, setExtractedData] = useState<HallTicketExtractionResult>({
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
    confidence_score: 90,
  });

  // No hall ticket state (Course only)
  const [noTicketCourseCode, setNoTicketCourseCode] = useState('');
  const [noTicketCourseName, setNoTicketCourseName] = useState('');
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  if (!isOpen) return null;

  // Handle file selection
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate type
    const validTypes = ['image/jpeg', 'image/png', 'image/webp'];
    if (!validTypes.includes(file.type)) {
      setExtractionError('Please upload a valid image file (JPEG, PNG, or WebP).');
      return;
    }

    // Validate size (max 5MB)
    if (file.size > 5 * 1024 * 1024) {
      setExtractionError('File size exceeds 5MB limit. Please crop or compress your hall ticket.');
      return;
    }

    setExtractionError(null);
    setSelectedFile(file);

    // Read as DataURL for in-memory preview & transmission
    const reader = new FileReader();
    reader.onload = () => {
      setFilePreview(reader.result as string);
    };
    reader.readAsDataURL(file);
  };

  // Perform AI vision extraction
  const handleStartExtraction = async () => {
    if (!filePreview || !selectedFile) {
      setExtractionError('Please select a hall ticket image first.');
      return;
    }

    setExtracting(true);
    setExtractionError(null);

    try {
      const response = await fetch('/api/extract-hallticket', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          imageBase64: filePreview,
          mimeType: selectedFile.type,
        }),
      });

      const resJson = await response.json();
      if (!resJson.success) {
        throw new Error(resJson.error || 'Failed to extract hall ticket data.');
      }

      setExtractedData(resJson.data);
      // Discard image memory reference per zero-retention policy
      setSelectedFile(null);
      setFilePreview(null);
      setStep('REVIEW_AI');
    } catch (err: any) {
      setExtractionError(
        err.message || 'Error communicating with AI extraction endpoint. You can try again or enter details manually.'
      );
    } finally {
      setExtracting(false);
    }
  };

  // Use pre-loaded sample hall ticket for testing
  const handleLoadSampleHallTicket = () => {
    setExtractedData({
      course_name: 'Deep Learning',
      course_code: 'noc24-cs101',
      exam_date: '2026-10-25',
      reporting_time: '07:30',
      exam_start_time: '09:00',
      shift: 'FN',
      centre_name: 'iON Digital Zone iDZ Patamata',
      centre_address: 'Near Benz Circle, High School Road, Patamata',
      city: 'Vijayawada',
      state: 'Andhra Pradesh',
      pincode: '520010',
      ambiguous_fields: ['pincode'],
      confidence_score: 95,
      notes: 'Sample NPTEL Hall Ticket processed. Reporting time (07:30) is separated from Exam Start (09:00).',
    });
    setStep('REVIEW_AI');
  };

  // Save confirmed exam from AI review form
  const handleSaveConfirmedExam = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    setSaving(true);
    setSaveError(null);

    try {
      // 1. Resolve or create course
      const course = await dataService.findOrCreateCourse({
        code: extractedData.course_code || 'NPTEL-COURSE',
        name: extractedData.course_name || 'NPTEL MOOC Course',
      });

      // 2. Resolve or suggest centre
      const centre = await dataService.findOrCreateCentre({
        name: extractedData.centre_name || 'Designated NPTEL Test Centre',
        address: extractedData.centre_address || 'Test Centre Address',
        city: extractedData.city || 'Vijayawada',
        state: extractedData.state || 'Andhra Pradesh',
        pincode: extractedData.pincode || '',
        userId: user.id,
      });

      // 3. Save student exam with CONFIRMED status
      await dataService.saveStudentExam({
        student_id: user.id,
        course_id: course.id,
        centre_id: centre.id,
        exam_date: extractedData.exam_date,
        reporting_time: extractedData.reporting_time,
        exam_start_time: extractedData.exam_start_time,
        shift: extractedData.shift,
        status: 'CONFIRMED',
      });

      try {
        confetti({ particleCount: 60, spread: 70, origin: { y: 0.6 } });
      } catch {}

      onExamSaved();
      onClose();
    } catch (err: any) {
      setSaveError(err.message || 'Failed to save exam details.');
    } finally {
      setSaving(false);
    }
  };

  // Save unconfirmed course-only exam for students without hall ticket
  const handleSaveCourseOnlyExam = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    if (!noTicketCourseName.trim()) {
      setSaveError('Please enter your NPTEL course title.');
      return;
    }

    setSaving(true);
    setSaveError(null);

    try {
      const course = await dataService.findOrCreateCourse({
        code: noTicketCourseCode.trim() || `noc24-${noTicketCourseName.substring(0, 3).toLowerCase()}`,
        name: noTicketCourseName.trim(),
      });

      await dataService.saveStudentExam({
        student_id: user.id,
        course_id: course.id,
        centre_id: null,
        exam_date: null,
        reporting_time: null,
        exam_start_time: null,
        shift: null,
        status: 'PENDING_DETAILS',
      });

      try {
        confetti({ particleCount: 40, spread: 50, origin: { y: 0.6 } });
      } catch {}

      onExamSaved();
      onClose();
    } catch (err: any) {
      setSaveError(err.message || 'Failed to register course.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-navy-950/75 backdrop-blur-sm animate-fade-in">
      <div className="bg-white rounded-2xl max-w-2xl w-full max-h-[92vh] overflow-y-auto shadow-2xl border border-slate-200">
        
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 bg-slate-50 rounded-t-2xl">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-navy-900 text-amber-300 flex items-center justify-center shadow-sm">
              <Sparkles className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-navy-900">
                {step === 'CHOICE' && 'NPTEL Exam Onboarding'}
                {step === 'UPLOAD_AI' && 'Upload Hall Ticket (AI Extraction)'}
                {step === 'REVIEW_AI' && 'Verify Extracted Exam Details'}
                {step === 'NO_HALL_TICKET' && 'Join via MOOC Course Name'}
              </h2>
              <p className="text-xs text-slate-500">
                SRM University–AP Buddy & Cohort Matching
              </p>
            </div>
          </div>
          {!isMandatory && (
            <button
              onClick={onClose}
              className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-200/50 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          )}
        </div>

        {/* STEP 1: CHOICE SCREEN (Mutually exclusive options A and B) */}
        {step === 'CHOICE' && (
          <div className="p-6 space-y-6">
            <div className="text-center max-w-lg mx-auto">
              <h3 className="text-base font-bold text-navy-900">
                Do you have your NPTEL Hall Ticket / Admit Card?
              </h3>
              <p className="text-xs text-slate-600 mt-1.5 leading-relaxed">
                Connect with peers going to the exact same examination venue and shift, or discover study buddies taking the same online course.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Option A: Upload Hall Ticket */}
              <div
                onClick={() => setStep('UPLOAD_AI')}
                className="group p-5 rounded-2xl border-2 border-slate-200 hover:border-navy-900 bg-white hover:bg-slate-50/70 transition-all cursor-pointer flex flex-col justify-between shadow-subtle hover:shadow-card"
              >
                <div>
                  <div className="w-12 h-12 rounded-xl bg-navy-100 text-navy-900 flex items-center justify-center mb-4 group-hover:scale-105 transition-transform">
                    <Sparkles className="w-6 h-6 text-navy-800" />
                  </div>
                  <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                    Recommended
                  </span>
                  <h4 className="text-sm font-bold text-navy-950 mt-2">
                    Option A: Upload Hall Ticket
                  </h4>
                  <p className="text-xs text-slate-600 mt-1 leading-relaxed">
                    AI instantly extracts your exam centre, date, and reporting time. Zero image storage guarantee.
                  </p>
                </div>
                <div className="mt-5 flex items-center text-xs font-semibold text-navy-900 group-hover:translate-x-1 transition-transform">
                  <span>Upload Document</span>
                  <ArrowRight className="w-3.5 h-3.5 ml-1" />
                </div>
              </div>

              {/* Option B: I Don't Have My Hall Ticket */}
              <div
                onClick={() => setStep('NO_HALL_TICKET')}
                className="group p-5 rounded-2xl border-2 border-slate-200 hover:border-slate-400 bg-white hover:bg-slate-50/70 transition-all cursor-pointer flex flex-col justify-between shadow-subtle hover:shadow-card"
              >
                <div>
                  <div className="w-12 h-12 rounded-xl bg-slate-100 text-slate-700 flex items-center justify-center mb-4 group-hover:scale-105 transition-transform">
                    <BookOpen className="w-6 h-6 text-slate-700" />
                  </div>
                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 bg-slate-100 px-2 py-0.5 rounded">
                    Admit Card Pending
                  </span>
                  <h4 className="text-sm font-bold text-navy-950 mt-2">
                    Option B: I Don't Have It Yet
                  </h4>
                  <p className="text-xs text-slate-600 mt-1 leading-relaxed">
                    Enter only your course title. No centre details required. You can update your slot once admit cards release.
                  </p>
                </div>
                <div className="mt-5 flex items-center text-xs font-semibold text-slate-700 group-hover:translate-x-1 transition-transform">
                  <span>Select Course Only</span>
                  <ArrowRight className="w-3.5 h-3.5 ml-1" />
                </div>
              </div>
            </div>

            {/* Privacy reminder note */}
            <div className="p-3.5 rounded-xl bg-slate-100/80 border border-slate-200 flex items-center gap-2.5 text-xs text-slate-600">
              <ShieldCheck className="w-4 h-4 text-emerald-600 shrink-0" />
              <span>
                Hall ticket images are processed in-memory and discarded immediately after OCR analysis.
              </span>
            </div>
          </div>
        )}

        {/* STEP 2A: UPLOAD HALL TICKET SCREEN */}
        {step === 'UPLOAD_AI' && (
          <div className="p-6 space-y-5">
            <div className="flex items-center justify-between">
              <button
                type="button"
                onClick={() => setStep('CHOICE')}
                className="text-xs font-semibold text-slate-500 hover:text-navy-900 flex items-center gap-1"
              >
                ← Back to choices
              </button>
              <button
                type="button"
                onClick={handleLoadSampleHallTicket}
                className="text-xs font-semibold text-navy-700 bg-navy-50 hover:bg-navy-100 px-2.5 py-1 rounded-lg border border-navy-200 transition-colors"
                title="Quickly test with standard SRM AP NPTEL hall ticket data"
              >
                ⚡ Use Sample Admit Card
              </button>
            </div>

            {extractionError && (
              <div className="p-3.5 text-xs bg-rose-50 border border-rose-200 text-rose-700 rounded-xl flex items-start gap-2">
                <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
                <div>
                  <p className="font-semibold">Extraction Failed</p>
                  <p className="mt-0.5">{extractionError}</p>
                </div>
              </div>
            )}

            {/* Drag & Drop Area */}
            <div
              onClick={() => fileInputRef.current?.click()}
              className={`border-2 border-dashed rounded-2xl p-8 text-center cursor-pointer transition-all ${
                filePreview
                  ? 'border-emerald-500 bg-emerald-50/30'
                  : 'border-slate-300 hover:border-navy-700 bg-slate-50/50 hover:bg-slate-100/50'
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
                  <div className="w-16 h-16 rounded-xl bg-emerald-100 text-emerald-700 mx-auto flex items-center justify-center">
                    <CheckCircle2 className="w-8 h-8" />
                  </div>
                  <div>
                    <p className="text-xs font-bold text-emerald-900">{selectedFile?.name}</p>
                    <p className="text-[11px] text-emerald-700">
                      {((selectedFile?.size || 0) / (1024 * 1024)).toFixed(2)} MB · Ready for AI OCR
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={e => {
                      e.stopPropagation();
                      setSelectedFile(null);
                      setFilePreview(null);
                    }}
                    className="text-xs text-rose-600 hover:underline font-medium"
                  >
                    Remove and choose another
                  </button>
                </div>
              ) : (
                <div className="space-y-3">
                  <div className="w-14 h-14 rounded-2xl bg-navy-50 text-navy-800 mx-auto flex items-center justify-center">
                    <Upload className="w-7 h-7" />
                  </div>
                  <div>
                    <p className="text-sm font-bold text-navy-900">
                      Click to browse or drag & drop your hall ticket
                    </p>
                    <p className="text-xs text-slate-500 mt-1">
                      Supported: JPEG, PNG, WebP (Max 5MB)
                    </p>
                  </div>
                </div>
              )}
            </div>

            {/* Zero retention disclaimer */}
            <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 text-[11px] text-slate-600 space-y-1">
              <div className="font-semibold text-slate-800 flex items-center gap-1.5">
                <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
                Zero Image Storage Commitment
              </div>
              <p>
                The image is streamed directly in memory to the AI vision parser and never saved to any database, disk, or bucket. Personal details like photos and DOB are strictly omitted.
              </p>
            </div>

            {/* Action buttons */}
            <div className="flex items-center justify-between pt-2">
              <button
                type="button"
                onClick={() => setStep('NO_HALL_TICKET')}
                className="text-xs text-slate-500 hover:text-navy-900 underline"
              >
                Don't have file? Enter course manually
              </button>

              <button
                type="button"
                onClick={handleStartExtraction}
                disabled={!filePreview || extracting}
                className="px-6 py-2.5 text-xs font-semibold text-white bg-navy-900 hover:bg-navy-800 disabled:opacity-50 rounded-xl transition-all shadow-sm flex items-center gap-2"
              >
                {extracting ? (
                  <>
                    <span className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    <span>Extracting Logistics with AI...</span>
                  </>
                ) : (
                  <>
                    <Sparkles className="w-3.5 h-3.5 text-amber-300" />
                    <span>Extract Exam Details</span>
                  </>
                )}
              </button>
            </div>
          </div>
        )}

        {/* STEP 2B: REVIEW & VERIFY EXTRACTED DETAILS (Strict schema verification) */}
        {step === 'REVIEW_AI' && (
          <form onSubmit={handleSaveConfirmedExam} className="p-6 space-y-5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-emerald-100 text-emerald-800 flex items-center gap-1">
                  <CheckCircle2 className="w-3 h-3" /> AI Extracted
                </span>
                <span className="text-xs text-slate-500">
                  Confidence: {extractedData.confidence_score}%
                </span>
              </div>
              <button
                type="button"
                onClick={() => setStep('UPLOAD_AI')}
                className="text-xs text-slate-500 hover:text-navy-900 flex items-center gap-1"
              >
                <RotateCcw className="w-3 h-3" /> Re-upload
              </button>
            </div>

            {/* Disclaimer on verification */}
            <div className="p-3 rounded-xl bg-amber-50 border border-amber-200 text-amber-900 text-xs flex items-start gap-2">
              <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5 text-amber-600" />
              <div>
                <p className="font-semibold">Review Extracted Fields Before Saving</p>
                <p className="text-[11px] text-amber-800 mt-0.5">
                  AI vision models are not 100% infallible. Please check the reporting time and venue carefully against your physical admit card.
                </p>
              </div>
            </div>

            {saveError && (
              <div className="p-3 text-xs bg-rose-50 text-rose-700 border border-rose-200 rounded-xl">
                {saveError}
              </div>
            )}

            <div className="space-y-4">
              {/* Course Fields */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="sm:col-span-2">
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    MOOC Course Name *
                  </label>
                  <input
                    type="text"
                    value={extractedData.course_name}
                    onChange={e => setExtractedData({ ...extractedData, course_name: e.target.value })}
                    className="w-full text-xs p-2.5 rounded-xl border border-slate-200 focus:ring-2 focus:ring-navy-700 focus:outline-none font-medium"
                    required
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Course Code *
                  </label>
                  <input
                    type="text"
                    value={extractedData.course_code}
                    onChange={e => setExtractedData({ ...extractedData, course_code: e.target.value })}
                    className="w-full text-xs p-2.5 rounded-xl border border-slate-200 focus:ring-2 focus:ring-navy-700 focus:outline-none font-mono"
                    placeholder="e.g. noc24-cs101"
                    required
                  />
                </div>
              </div>

              {/* Timing Fields: Explicitly separate Reporting Time vs Start Time */}
              <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 space-y-3">
                <div className="flex items-center gap-2 text-xs font-bold text-navy-950">
                  <Clock className="w-4 h-4 text-navy-800" />
                  <span>Exam Schedule (Asia/Kolkata IST)</span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                      Exam Date *
                    </label>
                    <input
                      type="date"
                      value={extractedData.exam_date}
                      onChange={e => setExtractedData({ ...extractedData, exam_date: e.target.value })}
                      className="w-full text-xs p-2 rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-navy-700"
                      required
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-semibold text-emerald-800 mb-1">
                      Official Reporting Time *
                    </label>
                    <input
                      type="time"
                      value={extractedData.reporting_time}
                      onChange={e => setExtractedData({ ...extractedData, reporting_time: e.target.value })}
                      className="w-full text-xs p-2 rounded-lg border border-emerald-300 bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500 font-semibold text-emerald-950"
                      required
                    />
                    <span className="text-[10px] text-emerald-700">Reporting entry slot</span>
                  </div>

                  <div>
                    <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                      Exam Start Time *
                    </label>
                    <input
                      type="time"
                      value={extractedData.exam_start_time}
                      onChange={e => setExtractedData({ ...extractedData, exam_start_time: e.target.value })}
                      className="w-full text-xs p-2 rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-navy-700"
                      required
                    />
                    <span className="text-[10px] text-slate-500">Writing commencement</span>
                  </div>

                  <div>
                    <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                      Shift *
                    </label>
                    <select
                      value={extractedData.shift}
                      onChange={e => setExtractedData({ ...extractedData, shift: e.target.value as any })}
                      className="w-full text-xs p-2 rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-navy-700 bg-white"
                    >
                      <option value="FN">FN (Morning)</option>
                      <option value="AN">AN (Afternoon)</option>
                    </select>
                  </div>
                </div>
              </div>

              {/* Centre Details */}
              <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 space-y-3">
                <div className="flex items-center gap-2 text-xs font-bold text-navy-950">
                  <MapPin className="w-4 h-4 text-navy-800" />
                  <span>Examination Venue Details</span>
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                    Centre Name *
                  </label>
                  <input
                    type="text"
                    value={extractedData.centre_name}
                    onChange={e => setExtractedData({ ...extractedData, centre_name: e.target.value })}
                    className="w-full text-xs p-2.5 rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-navy-700 font-medium"
                    required
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                    Venue Address *
                  </label>
                  <input
                    type="text"
                    value={extractedData.centre_address}
                    onChange={e => setExtractedData({ ...extractedData, centre_address: e.target.value })}
                    className="w-full text-xs p-2.5 rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-navy-700"
                    required
                  />
                </div>

                <div className="grid grid-cols-3 gap-2">
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-700 mb-1">City *</label>
                    <input
                      type="text"
                      value={extractedData.city}
                      onChange={e => setExtractedData({ ...extractedData, city: e.target.value })}
                      className="w-full text-xs p-2 rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-navy-700"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-700 mb-1">State</label>
                    <input
                      type="text"
                      value={extractedData.state}
                      onChange={e => setExtractedData({ ...extractedData, state: e.target.value })}
                      className="w-full text-xs p-2 rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-navy-700"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-700 mb-1">Pincode</label>
                    <input
                      type="text"
                      value={extractedData.pincode}
                      onChange={e => setExtractedData({ ...extractedData, pincode: e.target.value })}
                      className="w-full text-xs p-2 rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-navy-700"
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* Form actions */}
            <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setStep('CHOICE')}
                className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl transition-colors"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={saving}
                className="px-6 py-2.5 text-xs font-bold text-white bg-navy-900 hover:bg-navy-800 disabled:opacity-50 rounded-xl transition-all shadow-md flex items-center gap-1.5"
              >
                {saving ? 'Confirming Cohort...' : 'Confirm & Match Buddies'}
              </button>
            </div>
          </form>
        )}

        {/* STEP 3: OPTION B (NO HALL TICKET - MOOC COURSE ONLY) */}
        {step === 'NO_HALL_TICKET' && (
          <form onSubmit={handleSaveCourseOnlyExam} className="p-6 space-y-5">
            <button
              type="button"
              onClick={() => setStep('CHOICE')}
              className="text-xs font-semibold text-slate-500 hover:text-navy-900 flex items-center gap-1"
            >
              ← Back to choices
            </button>

            <div className="p-4 rounded-xl bg-sky-50 border border-sky-200 text-sky-900 text-xs">
              <h4 className="font-bold text-sky-950 flex items-center gap-1.5 mb-1">
                <Info className="w-4 h-4 text-sky-700" />
                No Admit Card Required Right Now
              </h4>
              <p className="leading-relaxed">
                You can join study groups for your MOOC course right away. You do NOT need an exam centre, date, or reporting time until official admit cards are issued by NPTEL.
              </p>
            </div>

            {saveError && (
              <div className="p-3 text-xs bg-rose-50 text-rose-700 border border-rose-200 rounded-xl">
                {saveError}
              </div>
            )}

            <div className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  NPTEL MOOC Course Title *
                </label>
                <input
                  type="text"
                  value={noTicketCourseName}
                  onChange={e => setNoTicketCourseName(e.target.value)}
                  placeholder="e.g. Cloud Computing, Deep Learning, Digital Circuits"
                  className="w-full text-xs p-3 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-navy-700 font-medium"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Course Code (Optional)
                </label>
                <input
                  type="text"
                  value={noTicketCourseCode}
                  onChange={e => setNoTicketCourseCode(e.target.value)}
                  placeholder="e.g. noc24-cs102"
                  className="w-full text-xs p-3 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-navy-700 font-mono"
                />
                <p className="text-[11px] text-slate-400 mt-1">
                  Leave blank if you only know the course title.
                </p>
              </div>
            </div>

            <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setStep('CHOICE')}
                className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl transition-colors"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={saving}
                className="px-6 py-2.5 text-xs font-bold text-white bg-navy-900 hover:bg-navy-800 disabled:opacity-50 rounded-xl transition-all shadow-md"
              >
                {saving ? 'Saving...' : 'Register Course Only'}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
};
