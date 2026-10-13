import React, { useState, useEffect } from 'react';
import {
  Shield,
  MapPin,
  CheckCircle2,
  AlertTriangle,
  Trash2,
  ExternalLink,
  Users,
  BookOpen,
  Layers,
  GitMerge
} from 'lucide-react';
import { ExamCentre, LinkReport } from '../types';
import { dataService } from '../services/dataService';
import { useAuth } from '../context/AuthContext';

export const AdminPage: React.FC = () => {
  const { user } = useAuth();
  const [stats, setStats] = useState({
    totalStudents: 0,
    totalCohorts: 0,
    totalExams: 0,
    totalCentres: 0,
    pendingCentres: 0,
    activeReports: 0,
  });

  const [centres, setCentres] = useState<ExamCentre[]>([]);
  const [reports, setReports] = useState<LinkReport[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedMergeSource, setSelectedMergeSource] = useState<string | null>(null);
  const [selectedMergeTarget, setSelectedMergeTarget] = useState<string>('');

  const loadAdminData = async () => {
    try {
      setLoading(true);
      const [allStats, allCentres, allReports] = await Promise.all([
        dataService.getSystemStats(),
        dataService.getCentres(),
        dataService.getReports(),
      ]);
      setStats(allStats);
      setCentres(allCentres);
      setReports(allReports);
    } catch (err) {
      console.error('Failed to load admin data:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAdminData();
  }, []);

  if (!user?.is_admin) {
    return (
      <div className="max-w-md mx-auto my-20 p-8 text-center bg-dark-800 rounded-2xl border border-rose-500/20 shadow-card space-y-3">
        <AlertTriangle className="w-8 h-8 text-rose-400 mx-auto" />
        <h2 className="text-base font-bold text-white">Access Restricted</h2>
        <p className="text-xs text-subtle-text">
          This portal is accessible only to authorized administrators for moderation.
        </p>
      </div>
    );
  }

  const handleVerifyCentre = async (centreId: string) => {
    await dataService.verifyCentre(centreId);
    await loadAdminData();
  };

  const handleMergeCentres = async () => {
    if (!selectedMergeSource || !selectedMergeTarget || selectedMergeSource === selectedMergeTarget) {
      alert('Please select valid distinct source and target centres.');
      return;
    }
    if (confirm('Merge all student exams and cohorts from this suggested centre into the target centre?')) {
      await dataService.mergeCentres(selectedMergeSource, selectedMergeTarget);
      setSelectedMergeSource(null);
      setSelectedMergeTarget('');
      await loadAdminData();
    }
  };

  const handleResolveReport = async (reportId: string, action: 'DISMISS' | 'REMOVE_LINK') => {
    await dataService.resolveReport(reportId, action);
    await loadAdminData();
  };

  const pendingCentres = centres.filter(c => !c.is_verified);
  const verifiedCentres = centres.filter(c => c.is_verified);
  const pendingReports = reports.filter(r => r.status === 'PENDING');

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 py-10 space-y-8 animate-fade-in">

      {/* Header */}
      <div className="space-y-1">
        <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-brand-violet/20 text-brand-accent border border-brand-violet/30">
          <Shield className="w-3.5 h-3.5" />
          <span>Restricted Admin Portal</span>
        </div>
        <h1 className="text-2xl font-bold text-white tracking-tight">
          Backend Centre & Link Moderation
        </h1>
        <p className="text-xs text-subtle-text">
          Verify dynamically extracted centres and moderate reported links
        </p>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        {[
          { label: 'Students', val: stats.totalStudents, icon: Users, color: 'text-white' },
          { label: 'Cohorts', val: stats.totalCohorts, icon: Layers, color: 'text-brand-accent' },
          { label: 'Exams', val: stats.totalExams, icon: BookOpen, color: 'text-emerald-400' },
          { label: 'Centres', val: stats.totalCentres, icon: MapPin, color: 'text-slate-300' },
          { label: 'Pending Centres', val: stats.pendingCentres, icon: AlertTriangle, color: 'text-amber-400' },
          { label: 'Flags', val: stats.activeReports, icon: Shield, color: 'text-rose-400' },
        ].map(s => {
          const Icon = s.icon;
          return (
            <div key={s.label} className="bg-dark-800 p-4 rounded-2xl border border-subtle-border shadow-card">
              <div className="flex items-center justify-between text-subtle-text">
                <span className="text-[10px] font-bold uppercase tracking-wider">{s.label}</span>
                <Icon className="w-3.5 h-3.5" />
              </div>
              <p className={`text-xl font-extrabold mt-1 ${s.color}`}>{s.val}</p>
            </div>
          );
        })}
      </div>

      {/* Section 1: Pending Examination Centres Queue */}
      <div className="bg-dark-800 rounded-2xl border border-subtle-border p-6 shadow-card space-y-5">
        <div>
          <h2 className="text-base font-bold text-white flex items-center gap-2">
            <MapPin className="w-4 h-4 text-amber-400" />
            <span>Pending AI-Extracted Centres ({pendingCentres.length})</span>
          </h2>
          <p className="text-xs text-subtle-text">
            Centres newly suggested from student hall tickets awaiting canonical confirmation
          </p>
        </div>

        {pendingCentres.length === 0 ? (
          <div className="p-6 text-center bg-dark-850 rounded-xl border border-subtle-border text-xs text-subtle-text">
            <CheckCircle2 className="w-5 h-5 text-emerald-400 mx-auto mb-1" />
            All examination centres are verified.
          </div>
        ) : (
          <div className="space-y-3">
            {pendingCentres.map(centre => (
              <div
                key={centre.id}
                className="p-4 rounded-xl border border-subtle-border bg-dark-850 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4"
              >
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="text-[9px] font-bold px-1.5 py-0.2 rounded bg-amber-500/10 text-amber-400 border border-amber-500/20 uppercase">
                      Suggested
                    </span>
                    <span className="text-[11px] text-subtle-text font-mono">
                      City: {centre.city}
                    </span>
                  </div>
                  <h4 className="text-xs font-bold text-white">{centre.name}</h4>
                  <p className="text-[11px] text-subtle-text">
                    {centre.address}, {centre.city}
                  </p>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  <button
                    onClick={() => handleVerifyCentre(centre.id)}
                    className="px-3 py-1.5 text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-500 rounded-lg transition-colors flex items-center gap-1"
                  >
                    <CheckCircle2 className="w-3 h-3" />
                    <span>Approve</span>
                  </button>

                  <button
                    onClick={() => setSelectedMergeSource(centre.id)}
                    className="px-3 py-1.5 text-xs font-semibold text-slate-300 bg-white/5 hover:bg-white/10 border border-white/10 rounded-lg transition-colors flex items-center gap-1"
                  >
                    <GitMerge className="w-3 h-3" />
                    <span>Merge</span>
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Merge Modal / Drawer */}
        {selectedMergeSource && (
          <div className="p-4 rounded-xl bg-dark-850 border border-subtle-border space-y-3">
            <h4 className="text-xs font-bold text-white">
              Merge Centre into Existing Verified Centre:
            </h4>
            <div className="flex flex-col sm:flex-row items-center gap-2.5">
              <select
                value={selectedMergeTarget}
                onChange={e => setSelectedMergeTarget(e.target.value)}
                className="text-xs p-2 rounded-xl bg-dark-800 border border-subtle-border text-white flex-1"
              >
                <option value="">Select Target Verified Centre...</option>
                {verifiedCentres.map(vc => (
                  <option key={vc.id} value={vc.id}>
                    {vc.name} ({vc.city})
                  </option>
                ))}
              </select>

              <button
                onClick={handleMergeCentres}
                className="px-4 py-2 text-xs font-semibold text-white bg-brand-violet hover:bg-purple-700 rounded-xl transition-colors shadow-glow"
              >
                Execute Merge
              </button>

              <button
                onClick={() => setSelectedMergeSource(null)}
                className="px-3 py-2 text-xs text-subtle-text hover:text-white"
              >
                Cancel
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Section 2: Reported Links Moderation */}
      <div className="bg-dark-800 rounded-2xl border border-subtle-border p-6 shadow-card space-y-5">
        <div>
          <h2 className="text-base font-bold text-white flex items-center gap-2">
            <Shield className="w-4 h-4 text-rose-400" />
            <span>Reported WhatsApp Links Queue ({pendingReports.length})</span>
          </h2>
          <p className="text-xs text-subtle-text">
            Community flags for expired invites or spam links
          </p>
        </div>

        {pendingReports.length === 0 ? (
          <div className="p-6 text-center bg-dark-850 rounded-xl border border-subtle-border text-xs text-subtle-text">
            <CheckCircle2 className="w-5 h-5 text-emerald-400 mx-auto mb-1" />
            No pending link reports.
          </div>
        ) : (
          <div className="space-y-3">
            {pendingReports.map(report => (
              <div
                key={report.id}
                className="p-4 rounded-xl border border-rose-500/20 bg-rose-500/5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4"
              >
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="text-[9px] font-bold px-1.5 py-0.2 rounded bg-rose-500/10 text-rose-300 uppercase">
                      Flag: {report.reason}
                    </span>
                    <span className="text-[11px] text-subtle-text font-mono">
                      {report.link_type}
                    </span>
                  </div>

                  <a
                    href={report.whatsapp_link}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs font-mono text-emerald-400 hover:underline flex items-center gap-1"
                  >
                    <span>{report.whatsapp_link}</span>
                    <ExternalLink className="w-3 h-3" />
                  </a>

                  {report.details && (
                    <p className="text-xs text-subtle-text">
                      Note: {report.details}
                    </p>
                  )}
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  <button
                    onClick={() => handleResolveReport(report.id, 'REMOVE_LINK')}
                    className="px-3 py-1.5 text-xs font-semibold text-white bg-rose-600 hover:bg-rose-500 rounded-lg transition-colors flex items-center gap-1"
                  >
                    <Trash2 className="w-3 h-3" />
                    <span>Remove Link</span>
                  </button>

                  <button
                    onClick={() => handleResolveReport(report.id, 'DISMISS')}
                    className="px-3 py-1.5 text-xs text-subtle-text hover:text-white"
                  >
                    Dismiss
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
