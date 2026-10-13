import React from 'react';
import { MessageCircle, Mail } from 'lucide-react';
import { InstagramIcon } from './InstagramIcon';

export const Footer: React.FC = () => {
  return (
    <footer className="border-t border-subtle-border/80 bg-dark-950/90 py-4 text-xs text-subtle-text mt-auto no-print">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 flex flex-col sm:flex-row items-center justify-between gap-3 text-center sm:text-left">
        {/* Compact Single Brand Row on Left */}
        <div className="flex flex-wrap items-center justify-center sm:justify-start gap-1.5 sm:gap-2 text-[11px] sm:text-xs">
          <span className="font-bold text-white tracking-tight">MoocDeal</span>
          <span className="text-white/30">·</span>
          <span className="text-slate-300 font-medium">SRM DEALINGS</span>
          <span className="text-white/30">·</span>
          <span className="text-subtle-text">SRM University-AP</span>
        </div>

        {/* Compact Contact Links on Right */}
        <div className="flex flex-wrap items-center justify-center gap-3.5 sm:gap-5 text-[11px] sm:text-xs">
          <a
            href="https://whatsapp.com/channel/0029VbD55TuKgsNucd0Ycf2e"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 text-slate-300 hover:text-emerald-400 transition-colors py-1"
            title="Follow SRM DEALINGS on WhatsApp"
          >
            <MessageCircle className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
            <span>WhatsApp</span>
          </a>

          <a
            href="mailto:srmdealings@gmail.com"
            className="inline-flex items-center gap-1.5 text-slate-300 hover:text-rose-400 transition-colors py-1"
            title="Contact SRM DEALINGS via Gmail"
          >
            <Mail className="w-3.5 h-3.5 text-rose-400 shrink-0" />
            <span>Gmail</span>
          </a>

          <a
            href="https://www.instagram.com/srm_dealings?stkn=ajV0ZHYxcDFqNXM4"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 text-slate-300 hover:text-purple-400 transition-colors py-1"
            title="Follow SRM DEALINGS on Instagram"
          >
            <InstagramIcon className="w-3.5 h-3.5 text-purple-400 shrink-0" />
            <span>Instagram</span>
          </a>
        </div>
      </div>
    </footer>
  );
};
