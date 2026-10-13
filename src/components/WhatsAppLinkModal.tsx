import React, { useState, useEffect } from 'react';
import { Share2, X, MessageSquare, AlertCircle, ExternalLink, ShieldCheck } from 'lucide-react';
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

  useEffect(() => {
    if (isOpen) {
      setLink(currentLink || '');
      setError(null);
    }
  }, [isOpen, currentLink]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanLink = link.trim().replace(/\/+$/, '');

    if (!isValidWhatsAppLink(cleanLink)) {
      setError('Please provide a valid WhatsApp group invite link starting with https://chat.whatsapp.com/[code]');
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
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/85 backdrop-blur-sm animate-fade-in">
      <div className="bg-dark-800 border border-subtle-border rounded-2xl max-w-md w-full max-h-[90dvh] overflow-y-auto shadow-card">
        {/* Header */}
        <div className="flex items-center justify-between px-4 sm:px-6 py-3.5 sm:py-4 border-b border-subtle-border">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 flex items-center justify-center shrink-0">
              <MessageSquare className="w-4 h-4" />
            </div>
            <div className="min-w-0">
              <h2 className="text-xs sm:text-sm font-bold text-white truncate">
                {currentLink ? 'Edit / Replace WhatsApp Group' : title}
              </h2>
              <p className="text-[10px] sm:text-[11px] text-subtle-text truncate">{subtitle}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-subtle-text hover:text-white hover:bg-white/5 transition-colors shrink-0"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-4 sm:p-6 space-y-4">
          <div className="p-3 rounded-xl bg-white/5 border border-white/5 text-[11px] text-subtle-text leading-relaxed space-y-1">
            <p>
              Create your group manually in the WhatsApp app, copy its invite link, and paste it below. MoocDeal does not create groups automatically.
            </p>
            <p className="text-[10px] text-slate-400">
              Only verified SRM AP students in this slot or course will see this link. As the author, you can edit or replace it at any time.
            </p>
          </div>

          {error && (
            <div className="p-2.5 text-xs bg-rose-500/10 text-rose-300 border border-rose-500/20 rounded-xl flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0 text-rose-400" />
              <span>{error}</span>
            </div>
          )}

          <div>
            <label className="block text-xs font-medium text-slate-300 mb-1.5">
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
                placeholder="https://chat.whatsapp.com/..."
                className="w-full text-xs font-mono p-3 pr-8 rounded-xl bg-dark-850 border border-subtle-border text-white placeholder-slate-500 focus:outline-none focus:border-brand-violet"
                required
              />
              <ExternalLink className="w-3.5 h-3.5 text-subtle-text absolute right-3 top-3 pointer-events-none" />
            </div>
            <p className="text-[10px] text-subtle-text mt-1">
              Must start with <span className="font-mono text-emerald-400">https://chat.whatsapp.com/</span>
            </p>
          </div>

          <div className="flex items-center justify-end gap-2.5 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2.5 text-xs text-subtle-text hover:text-white min-h-[42px]"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="px-5 py-2.5 text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 rounded-xl transition-colors shadow-glow flex items-center justify-center gap-1.5 min-h-[44px]"
            >
              {loading ? 'Saving...' : currentLink ? 'Update Link' : 'Share Group Link'}
            </button>
          </div>

        </form>
      </div>
    </div>
  );
};
