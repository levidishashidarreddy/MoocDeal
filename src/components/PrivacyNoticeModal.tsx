import React from 'react';
import { ShieldCheck, X, AlertTriangle, EyeOff, Server, Lock } from 'lucide-react';

interface PrivacyNoticeModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const PrivacyNoticeModal: React.FC<PrivacyNoticeModalProps> = ({ isOpen, onClose }) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-navy-950/70 backdrop-blur-sm animate-fade-in">
      <div className="bg-white rounded-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto shadow-2xl border border-slate-200">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-5 border-b border-slate-100 bg-slate-50 rounded-t-2xl">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-navy-900 text-white flex items-center justify-center shadow-sm">
              <ShieldCheck className="w-6 h-6 text-emerald-400" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-navy-900">Privacy & Data Protection Notice</h2>
              <p className="text-xs text-slate-500">Student safety and zero-data-retention architecture</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-200/50 transition-colors"
            aria-label="Close modal"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-5 text-sm text-slate-700 leading-relaxed">
          <div className="p-4 rounded-xl bg-emerald-50/80 border border-emerald-200 flex gap-3 text-emerald-900">
            <Lock className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
            <div>
              <p className="font-semibold text-emerald-800">Zero Permanent Image Storage</p>
              <p className="text-xs text-emerald-700 mt-1">
                Your hall ticket image is processed strictly in temporary server memory to extract examination logistics. The image is never saved to hard disks, databases, cloud storage buckets, or analytics platforms.
              </p>
            </div>
          </div>

          <div>
            <h3 className="font-semibold text-navy-900 flex items-center gap-2 mb-2">
              <EyeOff className="w-4 h-4 text-navy-700" />
              1. Information We Do NOT Extract or Store
            </h3>
            <ul className="list-disc list-inside space-y-1 text-slate-600 pl-1">
              <li>Candidate photograph or facial identifiers</li>
              <li>Date of Birth (DOB)</li>
              <li>Candidate digital signature</li>
              <li>Personal phone numbers or home addresses</li>
              <li>Parent/Guardian details or Aadhaar numbers</li>
            </ul>
          </div>

          <div>
            <h3 className="font-semibold text-navy-900 flex items-center gap-2 mb-2">
              <Server className="w-4 h-4 text-navy-700" />
              2. Third-Party AI Vision Processing
            </h3>
            <p className="text-slate-600">
              Extraction is powered by state-of-the-art vision models via secure server-side API calls. Images sent to the extraction endpoint are handled per provider zero-data retention APIs. However, because external LLM APIs are utilized, we advise students to always review and verify all extracted fields before saving.
            </p>
          </div>

          <div>
            <h3 className="font-semibold text-navy-900 flex items-center gap-2 mb-2">
              <ShieldCheck className="w-4 h-4 text-navy-700" />
              3. Registration Number Privacy
            </h3>
            <p className="text-slate-600">
              Only authenticated fellow students who match your examination cohort or course can view student cohort cards. Furthermore, you can toggle the option in Settings to mask your registration number (e.g. AP211100*****).
            </p>
          </div>

          <div className="p-4 rounded-xl bg-amber-50 border border-amber-200 text-amber-900 flex gap-3 text-xs">
            <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
            <div>
              <p className="font-semibold">Independent Community Disclaimer</p>
              <p className="mt-1 text-amber-800">
                This utility is built independently for the unofficial SRM DEALINGS student community. It is not an official product of SRM University–AP, Swayam, or NPTEL. WhatsApp groups are created independently by students.
              </p>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 bg-slate-50 border-t border-slate-100 flex justify-end">
          <button
            onClick={onClose}
            className="px-5 py-2.5 bg-navy-900 hover:bg-navy-800 text-white font-medium rounded-xl transition-colors shadow-sm"
          >
            I Understand
          </button>
        </div>
      </div>
    </div>
  );
};
