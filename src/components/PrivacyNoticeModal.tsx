import React from 'react';
import { ShieldCheck, X, EyeOff, Server, Lock } from 'lucide-react';

interface PrivacyNoticeModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const PrivacyNoticeModal: React.FC<PrivacyNoticeModalProps> = ({ isOpen, onClose }) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/85 backdrop-blur-sm animate-fade-in">
      <div className="bg-dark-800 border border-subtle-border rounded-2xl max-w-lg w-full max-h-[90dvh] overflow-y-auto shadow-card">
        {/* Header */}
        <div className="flex items-center justify-between px-4 sm:px-6 py-3.5 sm:py-4 border-b border-subtle-border">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 flex items-center justify-center shrink-0">
              <ShieldCheck className="w-4 h-4" />
            </div>
            <div className="min-w-0">
              <h2 className="text-xs sm:text-sm font-bold text-white truncate">Privacy & Image Policy</h2>
              <p className="text-[10px] sm:text-[11px] text-subtle-text truncate">Zero permanent image retention</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-subtle-text hover:text-white hover:bg-white/5 transition-colors shrink-0"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content */}
        <div className="p-4 sm:p-6 space-y-4 text-xs text-slate-300 leading-relaxed">
          <div className="p-3.5 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-300 flex gap-2.5">
            <Lock className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
            <div>
              <p className="font-semibold text-white">Zero Permanent Storage</p>
              <p className="text-[11px] text-emerald-300/80 mt-0.5">
                Hall ticket images are streamed directly in memory to the AI vision parser and immediately discarded. Images are never stored in databases, hard disks, or cloud buckets.
              </p>
            </div>
          </div>

          <div className="space-y-1.5">
            <h3 className="font-semibold text-white flex items-center gap-1.5">
              <EyeOff className="w-3.5 h-3.5 text-brand-accent" />
              Information We Do NOT Collect
            </h3>
            <ul className="list-disc list-inside text-subtle-text space-y-1 pl-1 text-[11px]">
              <li>Candidate photographs or face scans</li>
              <li>Date of Birth (DOB)</li>
              <li>Signatures, QR/barcode payloads</li>
              <li>Personal phone numbers or residential addresses</li>
            </ul>
          </div>

          <div className="space-y-1.5">
            <h3 className="font-semibold text-white flex items-center gap-1.5">
              <Server className="w-3.5 h-3.5 text-brand-accent" />
              Registration Privacy
            </h3>
            <p className="text-subtle-text text-[11px]">
              Registration numbers in public buddy lists are masked (e.g. AP21110*****5) to confirm campus authenticity while safeguarding your student identity.
            </p>
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-3 border-t border-subtle-border flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-1.5 text-xs font-semibold text-white bg-brand-violet hover:bg-purple-700 rounded-xl transition-all shadow-glow"
          >
            Understood
          </button>
        </div>
      </div>
    </div>
  );
};
