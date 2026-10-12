import React, { useState } from 'react';
import { Share2, X, MessageSquare, AlertCircle, ExternalLink } from 'lucide-react';
import { isValidWhatsAppLink } from '../services/dataService';

interface WhatsAppLinkModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (link: string) => Promise<void>;
  title: string;
  subtitle: string;
  currentLink?: string | null;
}

export const WhatsAppLinkModal: React.FC<WhatsAppLinkModalProps> = ({
  isOpen,
  onClose,
  onSubmit,
  title,
  subtitle,
  currentLink,
}) => {
  const [link, setLink] = useState(currentLink || '');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanLink = link.trim();

    if (!isValidWhatsAppLink(cleanLink)) {
      setError('Please provide a valid WhatsApp group invite link starting with https://chat.whatsapp.com/');
      return;
    }

    setLoading(true);
    setError(null);
    try {
      await onSubmit(cleanLink);
      onClose();
    } catch (err: any) {
      setError(err.message || 'Failed to save WhatsApp group link.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-navy-950/70 backdrop-blur-sm animate-fade-in">
      <div className="bg-white rounded-2xl max-w-lg w-full shadow-2xl border border-slate-200 overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 bg-emerald-50/50">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-emerald-600 text-white flex items-center justify-center shadow-sm">
              <MessageSquare className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-navy-900">{title}</h2>
              <p className="text-xs text-slate-500">{subtitle}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 text-xs text-slate-600 leading-relaxed">
            <p className="font-semibold text-navy-900 flex items-center gap-1.5 mb-1">
              <Share2 className="w-3.5 h-3.5 text-emerald-600" />
              Community-Created Groups
            </p>
            Create your WhatsApp group in the WhatsApp app, generate the invite link (via Group Info &gt; Invite via link), and paste it below. Fellow eligible students in this cohort can join directly.
          </div>

          {error && (
            <div className="p-3 text-xs bg-rose-50 text-rose-700 border border-rose-200 rounded-xl flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1.5">
              WhatsApp Group Invite Link
            </label>
            <div className="relative">
              <input
                type="url"
                value={link}
                onChange={e => {
                  setLink(e.target.value);
                  if (error) setError(null);
                }}
                placeholder="https://chat.whatsapp.com/GHYu78KlmNP..."
                className="w-full text-xs font-mono p-3 pr-8 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                required
              />
              <ExternalLink className="w-4 h-4 text-slate-400 absolute right-3 top-3 pointer-events-none" />
            </div>
            <p className="text-[11px] text-slate-500 mt-1">
              Must begin with <span className="font-mono text-emerald-700">https://chat.whatsapp.com/</span>
            </p>
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
              disabled={loading}
              className="px-5 py-2 text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 rounded-xl transition-colors shadow-sm flex items-center gap-1.5"
            >
              {loading ? 'Saving...' : currentLink ? 'Update Group Link' : 'Share Group Link'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
