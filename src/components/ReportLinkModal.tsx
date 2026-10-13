import React, { useState } from 'react';
import { AlertCircle, X, CheckCircle2 } from 'lucide-react';
import { dataService } from '../services/dataService';
import { useAuth } from '../context/AuthContext';

interface ReportLinkModalProps {
  isOpen: boolean;
  onClose: () => void;
  linkType: 'COHORT' | 'COURSE';
  targetId: string;
  whatsappLink: string;
  targetTitle: string;
}

export const ReportLinkModal: React.FC<ReportLinkModalProps> = ({
  isOpen,
  onClose,
  linkType,
  targetId,
  whatsappLink,
  targetTitle,
}) => {
  const { user } = useAuth();
  const [reason, setReason] = useState<'SPAM' | 'EXPIRED' | 'INAPPROPRIATE' | 'WRONG_GROUP'>('EXPIRED');
  const [details, setDetails] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    setSubmitting(true);
    setError(null);

    try {
      await dataService.reportLink({
        link_type: linkType,
        target_id: targetId,
        whatsapp_link: whatsappLink,
        reported_by: user.id,
        reason,
        details: details.trim() || undefined,
      });
      setSuccess(true);
      setTimeout(() => {
        setSuccess(false);
        onClose();
      }, 1500);
    } catch (err: any) {
      setError(err.message || 'Failed to submit report.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/85 backdrop-blur-sm animate-fade-in">
      <div className="bg-dark-800 border border-subtle-border rounded-2xl max-w-md w-full max-h-[90dvh] overflow-y-auto shadow-card">
        {/* Header */}
        <div className="flex items-center justify-between px-4 sm:px-6 py-3.5 sm:py-4 border-b border-subtle-border">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-rose-500/10 text-rose-400 border border-rose-500/20 flex items-center justify-center shrink-0">
              <AlertCircle className="w-4 h-4" />
            </div>
            <div className="min-w-0">
              <h2 className="text-xs sm:text-sm font-bold text-white truncate">Report WhatsApp Group Link</h2>
              <p className="text-[10px] sm:text-[11px] text-subtle-text truncate max-w-[200px]">{targetTitle}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-subtle-text hover:text-white hover:bg-white/5 transition-colors shrink-0"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {success ? (
          <div className="p-8 text-center space-y-2">
            <CheckCircle2 className="w-10 h-10 text-emerald-400 mx-auto" />
            <h3 className="text-sm font-bold text-white">Report Submitted</h3>
            <p className="text-xs text-subtle-text">
              Thank you for keeping our student community safe. An administrator will review this link.
            </p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="p-6 space-y-4">
            {error && (
              <div className="p-2.5 text-xs bg-rose-500/10 text-rose-300 border border-rose-500/20 rounded-xl">
                {error}
              </div>
            )}

            <div>
              <label className="block text-[11px] font-medium text-slate-300 mb-1">
                Link Under Review
              </label>
              <div className="text-[11px] font-mono text-slate-400 bg-dark-850 p-2.5 rounded-xl border border-subtle-border break-all">
                {whatsappLink}
              </div>
            </div>

            <div>
              <label className="block text-[11px] font-medium text-slate-300 mb-1.5">
                Reason
              </label>
              <div className="grid grid-cols-2 gap-2 text-xs">
                {[
                  { id: 'EXPIRED', label: 'Revoked / Expired' },
                  { id: 'SPAM', label: 'Spam / Promo' },
                  { id: 'WRONG_GROUP', label: 'Wrong Subject' },
                  { id: 'INAPPROPRIATE', label: 'Inappropriate' },
                ].map(opt => (
                  <button
                    key={opt.id}
                    type="button"
                    onClick={() => setReason(opt.id as any)}
                    className={`p-2.5 rounded-xl border text-left font-medium transition-all text-xs ${
                      reason === opt.id
                        ? 'border-rose-500/60 bg-rose-500/10 text-rose-300'
                        : 'border-subtle-border bg-dark-850 text-subtle-text hover:text-white'
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="block text-[11px] font-medium text-slate-300 mb-1">
                Optional Details
              </label>
              <textarea
                value={details}
                onChange={e => setDetails(e.target.value)}
                placeholder="Explain the issue briefly (e.g. group is full or invalid)"
                rows={2}
                className="w-full text-xs p-2.5 rounded-xl bg-dark-850 border border-subtle-border text-white placeholder-slate-500 focus:outline-none focus:border-brand-violet"
              />
            </div>

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={onClose}
                className="px-3.5 py-1.5 text-xs text-subtle-text hover:text-white"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={submitting}
                className="px-4 py-2 text-xs font-semibold text-white bg-rose-600 hover:bg-rose-500 disabled:opacity-50 rounded-xl transition-colors shadow-glow"
              >
                {submitting ? 'Submitting...' : 'Submit Report'}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
};
