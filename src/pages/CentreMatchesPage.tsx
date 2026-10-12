import React, { useState, useEffect } from 'react';
import { 
  MapPin, 
  Calendar, 
  Clock, 
  Users, 
  MessageSquare, 
  Share2, 
  AlertTriangle, 
  ExternalLink, 
  ShieldCheck, 
  Filter,
  Search,
  CheckCircle2,
  ChevronDown
} from 'lucide-react';
import { ExamCohort, ExamCentre, CohortMember, StudentProfile } from '../types';
import { dataService } from '../services/dataService';
import { useAuth } from '../context/AuthContext';
import { WhatsAppLinkModal } from '../components/WhatsAppLinkModal';
import { ReportLinkModal } from '../components/ReportLinkModal';

interface CentreMatchesPageProps {
  initialCohortId?: string;
}

export const CentreMatchesPage: React.FC<CentreMatchesPageProps> = ({ initialCohortId }) => {
  const { user } = useAuth();
  const [cohorts, setCohorts] = useState<ExamCohort[]>([]);
  const [selectedCohortId, setSelectedCohortId] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [branchFilter, setBranchFilter] = useState<string>('ALL');

  // Modals
  const [isLinkModalOpen, setIsLinkModalOpen] = useState(false);
  const [isReportModalOpen, setIsReportModalOpen] = useState(false);

  const loadCohorts = async () => {
    try {
      setLoading(true);
      const data = await dataService.getCohorts();
      setCohorts(data);
      if (initialCohortId && data.some(c => c.id === initialCohortId)) {
        setSelectedCohortId(initialCohortId);
      } else if (data.length > 0 && !selectedCohortId) {
        setSelectedCohortId(data[0].id);
      }
    } catch (err) {
      console.error('Failed to load cohorts:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadCohorts();
  }, []);

  const activeCohort = cohorts.find(c => c.id === selectedCohortId) || cohorts[0];

  const handleSaveWhatsAppLink = async (link: string) => {
    if (!activeCohort || !user) return;
    await dataService.updateCohortWhatsAppLink(activeCohort.id, link, user.id);
    await loadCohorts();
  };

  // Mask registration number if user opted for privacy
  const formatRegNo = (memberStudent?: StudentProfile) => {
    if (!memberStudent) return 'N/A';
    if (memberStudent.phone_visible || memberStudent.id === user?.id) {
      return memberStudent.reg_no;
    }
    // Mask middle digits: AP21110010145 -> AP21110*****5
    const reg = memberStudent.reg_no;
    if (reg.length > 7) {
      return `${reg.substring(0, 6)}*****${reg.slice(-1)}`;
    }
    return reg;
  };

  const filteredMembers = (activeCohort?.members || []).filter(m => {
    const student = m.student;
    const course = m.course;
    if (!student) return false;

    const matchesSearch =
      student.full_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      student.reg_no.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (course?.name || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
      (course?.code || '').toLowerCase().includes(searchQuery.toLowerCase());

    const matchesBranch = branchFilter === 'ALL' || student.branch === branchFilter;

    return matchesSearch && matchesBranch;
  });

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8 animate-fade-in">
      
      {/* Title & Description */}
      <div className="space-y-2">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-[11px] font-bold bg-navy-100 text-navy-800">
          <MapPin className="w-3.5 h-3.5 text-navy-700" />
          <span>Section 1: Centre & Reporting Time Discovery</span>
        </div>
        <h1 className="text-2xl sm:text-3xl font-extrabold text-navy-950">
          Same Centre & Reporting Time Buddies
        </h1>
        <p className="text-xs text-slate-500 max-w-3xl leading-relaxed">
          Students matched here are appearing at the <strong>exact same test venue</strong>, on the <strong>same date</strong>, and with the <strong>same official reporting time</strong>. Even if your courses differ, you share the same morning travel slot and exam hall premises!
        </p>
      </div>

      {/* Cohort Selector Pills / Dropdown */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-subtle space-y-3">
        <label className="block text-xs font-semibold text-slate-700">
          Select Exam Cohort (Centre + Date + Reporting Slot):
        </label>
        
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {cohorts.map(coh => {
            const isSelected = coh.id === activeCohort?.id;
            return (
              <button
                key={coh.id}
                type="button"
                onClick={() => setSelectedCohortId(coh.id)}
                className={`p-3.5 rounded-xl border text-left transition-all relative ${
                  isSelected
                    ? 'border-navy-900 bg-navy-50/70 ring-2 ring-navy-900/10 shadow-sm'
                    : 'border-slate-200 bg-white hover:bg-slate-50 hover:border-slate-300'
                }`}
              >
                <div className="flex items-start justify-between gap-1 mb-1">
                  <span className="font-bold text-xs text-navy-950 line-clamp-1">
                    {coh.centre?.name}
                  </span>
                  <span className="text-[10px] font-bold px-1.5 py-0.2 rounded bg-navy-200 text-navy-900">
                    {coh.member_count || 1} buddies
                  </span>
                </div>
                <p className="text-[11px] text-slate-500 line-clamp-1">
                  {coh.centre?.city} · {coh.centre?.address}
                </p>
                <div className="mt-2 flex items-center justify-between text-[11px] font-medium text-slate-700 border-t border-slate-200/50 pt-1.5">
                  <span className="flex items-center gap-1">
                    <Calendar className="w-3 h-3 text-slate-400" />
                    {coh.exam_date}
                  </span>
                  <span className="flex items-center gap-1 font-bold text-emerald-800">
                    <Clock className="w-3 h-3 text-emerald-600" />
                    {coh.reporting_time}
                  </span>
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {activeCohort ? (
        <div className="space-y-6">
          {/* Active Cohort Banner Card */}
          <div className="bg-white rounded-3xl border border-slate-200 p-6 sm:p-8 shadow-card space-y-6">
            <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-6 pb-6 border-b border-slate-100">
              <div className="space-y-2">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-[11px] font-bold px-2.5 py-0.5 rounded-full bg-emerald-100 text-emerald-900 flex items-center gap-1">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-700" />
                    Verified Exam Cohort
                  </span>
                  <span className="text-xs text-slate-500 font-medium">
                    {activeCohort.centre?.city}, Andhra Pradesh
                  </span>
                </div>

                <h2 className="text-xl sm:text-2xl font-extrabold text-navy-950">
                  {activeCohort.centre?.name}
                </h2>
                <p className="text-xs text-slate-600 flex items-center gap-1.5">
                  <MapPin className="w-3.5 h-3.5 text-navy-700 shrink-0" />
                  <span>{activeCohort.centre?.address}, {activeCohort.centre?.city} - {activeCohort.centre?.pincode}</span>
                </p>
              </div>

              {/* Slot timings card */}
              <div className="bg-slate-50 border border-slate-200/80 p-4 rounded-2xl flex items-center gap-6 shrink-0">
                <div>
                  <span className="text-[10px] uppercase font-bold text-slate-500">Exam Date</span>
                  <p className="text-sm font-bold text-navy-900 flex items-center gap-1 mt-0.5">
                    <Calendar className="w-4 h-4 text-navy-700" />
                    {activeCohort.exam_date}
                  </p>
                </div>
                <div className="h-8 w-px bg-slate-200" />
                <div>
                  <span className="text-[10px] uppercase font-bold text-emerald-700">Official Reporting</span>
                  <p className="text-sm font-extrabold text-emerald-900 flex items-center gap-1 mt-0.5">
                    <Clock className="w-4 h-4 text-emerald-600" />
                    {activeCohort.reporting_time} IST
                  </p>
                </div>
              </div>
            </div>

            {/* WhatsApp Group Coordination Widget */}
            <div className="rounded-2xl p-5 border transition-all bg-emerald-50/40 border-emerald-200 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
              <div className="flex items-start gap-3.5">
                <div className="w-11 h-11 rounded-2xl bg-emerald-600 text-white flex items-center justify-center shrink-0 shadow-sm">
                  <MessageSquare className="w-6 h-6" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="text-sm font-bold text-navy-950">
                      Cohort WhatsApp Group Coordination
                    </h3>
                    <span className="text-[10px] font-semibold text-slate-500 bg-white px-2 py-0.5 rounded border border-slate-200">
                      Student Managed
                    </span>
                  </div>

                  {activeCohort.whatsapp_group_link ? (
                    <p className="text-xs text-slate-600 mt-0.5">
                      An invite link for this venue & slot has been shared. Join to coordinate rides and morning arrival.
                    </p>
                  ) : (
                    <p className="text-xs text-slate-600 mt-0.5">
                      No WhatsApp group shared yet for this exact reporting slot. Create one in WhatsApp and paste the invite link here.
                    </p>
                  )}
                </div>
              </div>

              {/* Group Action Buttons */}
              <div className="flex flex-wrap items-center gap-2.5 shrink-0 w-full sm:w-auto">
                {activeCohort.whatsapp_group_link ? (
                  <>
                    <a
                      href={activeCohort.whatsapp_group_link}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="px-5 py-2.5 text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 rounded-xl transition-all shadow-sm flex items-center gap-1.5"
                    >
                      <span>Join WhatsApp Group</span>
                      <ExternalLink className="w-3.5 h-3.5" />
                    </a>

                    <button
                      onClick={() => setIsLinkModalOpen(true)}
                      className="px-3 py-2 text-xs font-semibold text-slate-700 bg-white hover:bg-slate-100 border border-slate-200 rounded-xl transition-colors"
                      title="Update invite link"
                    >
                      Update Link
                    </button>

                    <button
                      onClick={() => setIsReportModalOpen(true)}
                      className="px-2.5 py-2 text-xs font-semibold text-rose-600 hover:bg-rose-50 border border-transparent hover:border-rose-200 rounded-xl transition-colors"
                      title="Report broken or spam link"
                    >
                      Report Link
                    </button>
                  </>
                ) : (
                  <button
                    onClick={() => setIsLinkModalOpen(true)}
                    className="px-5 py-2.5 text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 rounded-xl transition-all shadow-sm flex items-center gap-1.5"
                  >
                    <Share2 className="w-3.5 h-3.5" />
                    <span>Share WhatsApp Group Link</span>
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* Cohort Members Section */}
          <div className="space-y-4">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
              <div>
                <h3 className="text-base font-bold text-navy-950 flex items-center gap-2">
                  <span>Matched Students in this Cohort</span>
                  <span className="px-2 py-0.5 rounded-full text-xs font-bold bg-navy-100 text-navy-900">
                    {filteredMembers.length}
                  </span>
                </h3>
                <p className="text-xs text-slate-500">
                  Students taking their NPTEL exam at this centre and reporting slot
                </p>
              </div>

              {/* Filters */}
              <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto">
                <div className="relative flex-1 sm:w-48">
                  <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-3 pointer-events-none" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={e => setSearchQuery(e.target.value)}
                    placeholder="Search name, course..."
                    className="w-full text-xs pl-8 pr-3 py-2 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-navy-700 bg-white"
                  />
                </div>

                <select
                  value={branchFilter}
                  onChange={e => setBranchFilter(e.target.value)}
                  className="text-xs py-2 px-3 rounded-xl border border-slate-200 bg-white focus:outline-none focus:ring-2 focus:ring-navy-700 text-slate-700"
                >
                  <option value="ALL">All Branches</option>
                  <option value="CSE">CSE</option>
                  <option value="ECE">ECE</option>
                  <option value="EEE">EEE</option>
                  <option value="AI_ML">AI & ML</option>
                  <option value="DATA_SCIENCE">Data Science</option>
                </select>
              </div>
            </div>

            {/* Members Table */}
            <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-subtle">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 font-semibold uppercase text-[10px] tracking-wider">
                    <tr>
                      <th className="py-3.5 px-4">Student Profile</th>
                      <th className="py-3.5 px-4">Registration No</th>
                      <th className="py-3.5 px-4">NPTEL MOOC Course</th>
                      <th className="py-3.5 px-4">Branch & Section</th>
                      <th className="py-3.5 px-4">Academic Year</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {filteredMembers.map(member => {
                      const student = member.student;
                      const isCurrentUser = student?.id === user?.id;

                      return (
                        <tr
                          key={member.id}
                          className={`hover:bg-slate-50/70 transition-colors ${
                            isCurrentUser ? 'bg-navy-50/50 font-medium' : ''
                          }`}
                        >
                          <td className="py-3.5 px-4">
                            <div className="flex items-center gap-2">
                              <span className="font-bold text-navy-950">
                                {student?.full_name}
                              </span>
                              {isCurrentUser && (
                                <span className="text-[10px] px-1.5 py-0.2 rounded bg-navy-900 text-white font-bold">
                                  You
                                </span>
                              )}
                            </div>
                          </td>

                          <td className="py-3.5 px-4 font-mono text-slate-700">
                            {formatRegNo(student)}
                          </td>

                          <td className="py-3.5 px-4">
                            <div>
                              <span className="font-semibold text-navy-900">
                                {member.course?.name || 'NPTEL Course'}
                              </span>
                              <span className="text-[10px] text-slate-400 font-mono block">
                                {member.course?.code}
                              </span>
                            </div>
                          </td>

                          <td className="py-3.5 px-4">
                            <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-semibold bg-slate-100 text-slate-800">
                              {student?.branch} · Sec {student?.section}
                            </span>
                          </td>

                          <td className="py-3.5 px-4 text-slate-600">
                            {student?.academic_year}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {filteredMembers.length === 0 && (
                <div className="p-8 text-center text-xs text-slate-400">
                  No students matched your search filters in this cohort.
                </div>
              )}
            </div>
          </div>
        </div>
      ) : (
        <div className="p-12 text-center text-xs text-slate-500">
          No confirmed cohorts available. Upload a hall ticket to create the first cohort!
        </div>
      )}

      {/* WhatsApp Link Modal */}
      {activeCohort && (
        <WhatsAppLinkModal
          isOpen={isLinkModalOpen}
          onClose={() => setIsLinkModalOpen(false)}
          onSubmit={handleSaveWhatsAppLink}
          title="Cohort WhatsApp Group"
          subtitle={`${activeCohort.centre?.name} (${activeCohort.exam_date} @ ${activeCohort.reporting_time})`}
          currentLink={activeCohort.whatsapp_group_link}
        />
      )}

      {/* Report Modal */}
      {activeCohort && activeCohort.whatsapp_group_link && (
        <ReportLinkModal
          isOpen={isReportModalOpen}
          onClose={() => setIsReportModalOpen(false)}
          linkType="COHORT"
          targetId={activeCohort.id}
          whatsappLink={activeCohort.whatsapp_group_link}
          targetTitle={`${activeCohort.centre?.name} (${activeCohort.reporting_time})`}
        />
      )}
    </div>
  );
};
