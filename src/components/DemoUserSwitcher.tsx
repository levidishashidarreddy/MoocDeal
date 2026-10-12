import React, { useState } from 'react';
import { UserCheck, ChevronDown, Shield } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { INITIAL_STUDENTS } from '../services/mockData';

export const DemoUserSwitcher: React.FC = () => {
  const { user, switchDemoUser, isLiveSupabase } = useAuth();
  const [isOpen, setIsOpen] = useState(false);

  // Only show demo switcher if in demo sandbox mode or user is logged in
  if (isLiveSupabase) return null;

  return (
    <div className="relative inline-block text-left">
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2 px-3 py-1.5 text-xs font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 border border-slate-300 rounded-xl transition-all shadow-sm"
        title="Switch demo student view"
      >
        <UserCheck className="w-3.5 h-3.5 text-navy-700" />
        <span className="hidden sm:inline">Switch Demo Student:</span>
        <span className="font-semibold text-navy-900">{user?.full_name || 'Select'}</span>
        <ChevronDown className="w-3 h-3 text-slate-500" />
      </button>

      {isOpen && (
        <div
          className="absolute right-0 mt-2 w-72 bg-white rounded-2xl shadow-xl border border-slate-200 z-50 py-2 animate-fade-in"
          onMouseLeave={() => setIsOpen(false)}
        >
          <div className="px-3 py-1.5 text-[11px] font-semibold text-slate-400 uppercase tracking-wider border-b border-slate-100">
            Demo Student Profiles
          </div>
          <div className="max-h-72 overflow-y-auto py-1">
            {INITIAL_STUDENTS.map(s => {
              const isActive = user?.id === s.id;
              return (
                <button
                  key={s.id}
                  onClick={() => {
                    switchDemoUser(s.id);
                    setIsOpen(false);
                  }}
                  className={`w-full text-left px-3 py-2 text-xs flex items-center justify-between hover:bg-slate-50 transition-colors ${
                    isActive ? 'bg-navy-50/70 font-semibold text-navy-900' : 'text-slate-700'
                  }`}
                >
                  <div>
                    <div className="flex items-center gap-1.5">
                      <span>{s.full_name}</span>
                      {s.is_admin && (
                        <span className="px-1.5 py-0.2 text-[9px] bg-amber-100 text-amber-800 rounded font-semibold flex items-center gap-0.5">
                          <Shield className="w-2.5 h-2.5" /> Admin
                        </span>
                      )}
                    </div>
                    <div className="text-[10px] text-slate-500 font-mono">
                      {s.reg_no} · {s.branch} · {s.academic_year}
                    </div>
                  </div>
                  {isActive && (
                    <span className="w-2 h-2 rounded-full bg-emerald-500 shrink-0"></span>
                  )}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};
