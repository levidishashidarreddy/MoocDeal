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
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-navy-950/70 backdrop-blur-sm animate-fade-in">
      <div className="bg-white rounded-2xl max-w-lg w-full shadow-2xl border border-slate-200 overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 bg-rose-50/50">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-rose-100 text-rose-600 flex items-center justify-center">
              <AlertCircle className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-navy-900">Report WhatsApp Group Link</h2>
              <p className="text-xs text-slate-500">For: {targetTitle}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {success ? (
          <div className="p-8 text-center space-y-3">
            <CheckCircle2 className="w-12 h-12 text-emerald-500 mx-auto" />
            <h3 className="text-lg font-bold text-navy-900">Report Received</h3>
            <p className="text-sm text-slate-600">
              Thank you for keeping our student community safe. An administrator will review this link.
            </p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="p-6 space-y-4">
            {error && (
              <div className="p-3 text-xs bg-rose-50 text-rose-700 border border-rose-200 rounded-xl">
                {error}
              </div>
            )}

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Link Under Review
              </label>
              <div className="text-xs font-mono text-slate-500 bg-slate-100 p-2.5 rounded-lg break-all select-all">
                {whatsappLink}
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                Why are you reporting this link?
              </label>
              <div className="grid grid-cols-2 gap-2 text-xs">
                {[
                  { id: 'EXPIRED', label: 'Revoked / Expired Link' },
                  { id: 'SPAM', label: 'Spam or Promotional' },
                  { id: 'WRONG_GROUP', label: 'Wrong Exam or Subject' },
                  { id: 'INAPPROPRIATE', label: 'Inappropriate Content' },
                ].map(opt => (
                  <button
                    key={opt.id}
                    type="button"
                    onClick={() => setReason(opt.id as any)}
                    className={`p-2.5 rounded-xl border text-left font-medium transition-all ${
                      reason === opt.id
                        ? 'border-rose-500 bg-rose-50/50 text-rose-900 ring-2 ring-rose-200'
                        : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Additional Details (Optional)
              </label>
              <textarea
                value={details}
                onChange={e => setDetails(e.target.value)}
                placeholder="Explain the issue briefly (e.g., link says group is full or invalid)"
                rows={3}
                className="w-full text-xs p-3 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-navy-700"
              />
            </div>

            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 text-xs font-medium text-slate-600 hover:bg-slate-100 rounded-xl transition-colors"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={submitting}
                className="px-5 py-2 text-xs font-semibold text-white bg-rose-600 hover:bg-rose-700 disabled:opacity-50 rounded-xl transition-colors shadow-sm"
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
