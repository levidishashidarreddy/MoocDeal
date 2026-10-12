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
  ArrowRight,
  GitMerge,
  Search
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
      <div className="max-w-md mx-auto my-20 p-8 text-center bg-white rounded-3xl border border-rose-200 shadow-card space-y-4">
        <div className="w-12 h-12 rounded-2xl bg-rose-100 text-rose-600 mx-auto flex items-center justify-center">
          <AlertTriangle className="w-6 h-6" />
        </div>
        <h2 className="text-lg font-bold text-navy-950">Access Restricted</h2>
        <p className="text-xs text-slate-500">
          This portal is restricted to authorized student administrators. Switch to an admin account (e.g. Karthik Varma) using the Demo Switcher to view this dashboard.
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
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8 animate-fade-in">
      
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div className="space-y-1">
          <div className="inline-flex items-center gap-1.5 px-3 py-0.5 rounded-full text-[11px] font-bold bg-amber-100 text-amber-900 border border-amber-200">
            <Shield className="w-3.5 h-3.5" />
            <span>Administrator Control Portal</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-navy-950">
            Dynamic Centre & Community Moderation
          </h1>
          <p className="text-xs text-slate-500">
            Verify AI-suggested test centres, resolve duplicate venues, and moderate reported links.
          </p>
        </div>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        {[
          { label: 'Students', val: stats.totalStudents, icon: Users, color: 'text-navy-900' },
          { label: 'Cohorts', val: stats.totalCohorts, icon: Layers, color: 'text-indigo-600' },
          { label: 'Exams', val: stats.totalExams, icon: BookOpen, color: 'text-emerald-700' },
          { label: 'Centres', val: stats.totalCentres, icon: MapPin, color: 'text-slate-700' },
          { label: 'Pending Centres', val: stats.pendingCentres, icon: AlertTriangle, color: 'text-amber-600' },
          { label: 'Link Reports', val: stats.activeReports, icon: Shield, color: 'text-rose-600' },
        ].map(s => {
          const Icon = s.icon;
          return (
            <div key={s.label} className="bg-white p-4 rounded-2xl border border-slate-200 shadow-subtle">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-bold uppercase text-slate-400">{s.label}</span>
                <Icon className="w-4 h-4 text-slate-400" />
              </div>
              <p className={`text-xl font-extrabold mt-1 ${s.color}`}>{s.val}</p>
            </div>
          );
        })}
      </div>

      {/* Section 1: Pending Examination Centres Queue */}
      <div className="bg-white rounded-3xl border border-slate-200 p-6 sm:p-8 shadow-card space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-bold text-navy-950 flex items-center gap-2">
              <MapPin className="w-5 h-5 text-amber-600" />
              <span>Pending AI-Extracted Centres ({pendingCentres.length})</span>
            </h2>
            <p className="text-xs text-slate-500">
              Centres newly extracted from student hall tickets awaiting verification or merge
            </p>
          </div>
        </div>

        {pendingCentres.length === 0 ? (
          <div className="p-8 text-center bg-slate-50 rounded-2xl border border-slate-100 text-xs text-slate-500">
            <CheckCircle2 className="w-6 h-6 text-emerald-500 mx-auto mb-1.5" />
            All examination centres are verified and canonical.
          </div>
        ) : (
          <div className="space-y-4">
            {pendingCentres.map(centre => (
              <div
                key={centre.id}
                className="p-5 rounded-2xl border border-amber-200 bg-amber-50/30 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4"
              >
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-amber-200 text-amber-900 uppercase">
                      Suggested Centre
                    </span>
                    <span className="text-xs text-slate-400 font-mono">
                      City: {centre.city}
                    </span>
                  </div>
                  <h4 className="text-sm font-bold text-navy-950">{centre.name}</h4>
                  <p className="text-xs text-slate-600">
                    {centre.address}, {centre.city} {centre.pincode ? `- ${centre.pincode}` : ''}
                  </p>
                </div>

                <div className="flex flex-wrap items-center gap-2 shrink-0">
                  <button
                    onClick={() => handleVerifyCentre(centre.id)}
                    className="px-4 py-2 text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 rounded-xl transition-colors shadow-2xs flex items-center gap-1.5"
                  >
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    <span>Approve & Verify</span>
                  </button>

                  <button
                    onClick={() => setSelectedMergeSource(centre.id)}
                    className="px-3.5 py-2 text-xs font-semibold text-slate-700 bg-white hover:bg-slate-100 border border-slate-200 rounded-xl transition-colors flex items-center gap-1.5"
                  >
                    <GitMerge className="w-3.5 h-3.5" />
                    <span>Merge into Canonical</span>
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Merge Modal / Drawer */}
        {selectedMergeSource && (
          <div className="p-4 rounded-2xl bg-slate-100 border border-slate-300 space-y-3">
            <h4 className="text-xs font-bold text-navy-900">
              Merge Centre into Existing Verified Centre:
            </h4>
            <div className="flex flex-col sm:flex-row items-center gap-3">
              <select
                value={selectedMergeTarget}
                onChange={e => setSelectedMergeTarget(e.target.value)}
                className="text-xs p-2.5 rounded-xl border border-slate-300 bg-white flex-1"
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
                className="px-4 py-2 text-xs font-bold text-white bg-navy-900 hover:bg-navy-800 rounded-xl transition-colors"
              >
                Execute Merge
              </button>

              <button
                onClick={() => setSelectedMergeSource(null)}
                className="px-3 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-200 rounded-xl transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Section 2: Reported WhatsApp Links Moderation */}
      <div className="bg-white rounded-3xl border border-slate-200 p-6 sm:p-8 shadow-card space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-bold text-navy-950 flex items-center gap-2">
              <Shield className="w-5 h-5 text-rose-600" />
              <span>Reported WhatsApp Links Queue ({pendingReports.length})</span>
            </h2>
            <p className="text-xs text-slate-500">
              Community flags for expired invites, spam, or inappropriate WhatsApp groups
            </p>
          </div>
        </div>

        {pendingReports.length === 0 ? (
          <div className="p-8 text-center bg-slate-50 rounded-2xl border border-slate-100 text-xs text-slate-500">
            <CheckCircle2 className="w-6 h-6 text-emerald-500 mx-auto mb-1.5" />
            No pending link reports. Community links are healthy.
          </div>
        ) : (
          <div className="space-y-4">
            {pendingReports.map(report => (
              <div
                key={report.id}
                className="p-5 rounded-2xl border border-rose-200 bg-rose-50/30 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4"
              >
                <div className="space-y-1.5">
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-rose-100 text-rose-800 uppercase">
                      Flag: {report.reason}
                    </span>
                    <span className="text-[11px] text-slate-500 font-mono">
                      Type: {report.link_type}
                    </span>
                  </div>

                  <a
                    href={report.whatsapp_link}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs font-mono text-emerald-800 hover:underline flex items-center gap-1"
                  >
                    <span>{report.whatsapp_link}</span>
                    <ExternalLink className="w-3 h-3" />
                  </a>

                  {report.details && (
                    <p className="text-xs text-slate-600 bg-white/80 p-2 rounded-lg border border-slate-100">
                      Note from student: {report.details}
                    </p>
                  )}
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  <button
                    onClick={() => handleResolveReport(report.id, 'REMOVE_LINK')}
                    className="px-4 py-2 text-xs font-bold text-white bg-rose-600 hover:bg-rose-700 rounded-xl transition-colors shadow-2xs flex items-center gap-1"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>Remove Group Link</span>
                  </button>

                  <button
                    onClick={() => handleResolveReport(report.id, 'DISMISS')}
                    className="px-3.5 py-2 text-xs font-semibold text-slate-700 bg-white hover:bg-slate-100 border border-slate-200 rounded-xl transition-colors"
                  >
                    Dismiss Flag
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Section 3: Verified Centres Reference Directory */}
      <div className="bg-white rounded-3xl border border-slate-200 p-6 sm:p-8 shadow-card space-y-4">
        <h3 className="text-sm font-bold text-navy-950">
          Verified Examination Centres Directory ({verifiedCentres.length})
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 text-xs">
          {verifiedCentres.map(c => (
            <div key={c.id} className="p-3.5 rounded-xl border border-slate-200 bg-slate-50/50 space-y-1">
              <span className="font-bold text-navy-900 block truncate">{c.name}</span>
              <p className="text-[11px] text-slate-500 truncate">{c.address}, {c.city}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
