import React, { useState } from 'react';
import { ShieldCheck, Heart, ExternalLink, Shield } from 'lucide-react';
import { PrivacyNoticeModal } from './PrivacyNoticeModal';

export const Footer: React.FC = () => {
  const [privacyOpen, setPrivacyOpen] = useState(false);

  return (
    <>
      <footer className="bg-navy-950 text-slate-400 text-xs border-t border-navy-800 mt-16 no-print">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
            <div className="md:col-span-2 space-y-3">
              <div className="flex items-center gap-2">
                <span className="font-extrabold text-white text-base">NPTEL Exam Buddy</span>
                <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-navy-800 text-amber-300 border border-navy-700">
                  SRM DEALINGS
                </span>
              </div>
              <p className="text-slate-400 text-xs leading-relaxed max-w-md">
                Connecting SRM University–AP students traveling to the same NPTEL examination centre at the same reporting time, and facilitating peer study groups for MOOC coursework.
              </p>
              <div className="flex items-center gap-2 text-[11px] text-emerald-400">
                <ShieldCheck className="w-4 h-4" />
                <span>Zero-storage AI hall ticket parsing & Row Level Security</span>
              </div>
            </div>

            <div>
              <h4 className="font-semibold text-white uppercase text-[11px] tracking-wider mb-3">
                Platform Safety
              </h4>
              <ul className="space-y-2 text-xs">
                <li>
                  <button
                    onClick={() => setPrivacyOpen(true)}
                    className="hover:text-white transition-colors flex items-center gap-1.5"
                  >
                    <Shield className="w-3.5 h-3.5 text-slate-400" />
                    Privacy & Image Policy
                  </button>
                </li>
                <li>
                  <span className="text-slate-400">Strict In-Memory AI Processing</span>
                </li>
                <li>
                  <span className="text-slate-400">Maskable Registration Numbers</span>
                </li>
                <li>
                  <span className="text-slate-400">Community Link Moderation</span>
                </li>
              </ul>
            </div>

            <div>
              <h4 className="font-semibold text-white uppercase text-[11px] tracking-wider mb-3">
                Community Notes
              </h4>
              <p className="text-[11px] text-slate-400 leading-normal mb-3">
                Built for the unofficial SRM DEALINGS student collective. Not affiliated with NPTEL, Swayam, or SRM Administration.
              </p>
              <div className="text-[10px] text-slate-500 font-mono">
                Tech Stack: React 18 · Vite · Supabase Postgres · Gemini Vision Serverless
              </div>
            </div>
          </div>

          <div className="border-t border-navy-900 mt-8 pt-6 flex flex-col sm:flex-row items-center justify-between text-[11px] text-slate-400">
            <div>
              © 2026 NPTEL Exam Buddy · SRM University–AP Student Community
            </div>
            <div className="flex items-center gap-1 mt-2 sm:mt-0 text-slate-400">
              Built with care for fellow SRM students
            </div>
          </div>
        </div>
      </footer>

      <PrivacyNoticeModal isOpen={privacyOpen} onClose={() => setPrivacyOpen(false)} />
    </>
  );
};
