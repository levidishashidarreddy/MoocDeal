import React, { useState, useEffect } from 'react';
import { 
  BookOpen, 
  Users, 
  MessageSquare, 
  Share2, 
  ExternalLink, 
  Search, 
  MapPin, 
  Calendar, 
  Clock, 
  CheckCircle2, 
  AlertCircle 
} from 'lucide-react';
import { Course, StudentProfile, StudentExam, ExamCentre, CourseGroupLink } from '../types';
import { dataService } from '../services/dataService';
import { useAuth } from '../context/AuthContext';
import { WhatsAppLinkModal } from '../components/WhatsAppLinkModal';
import { ReportLinkModal } from '../components/ReportLinkModal';

interface CourseMatchesPageProps {
  initialCourseId?: string;
}

export const CourseMatchesPage: React.FC<CourseMatchesPageProps> = ({ initialCourseId }) => {
  const { user } = useAuth();
  const [courses, setCourses] = useState<Course[]>([]);
  const [selectedCourseId, setSelectedCourseId] = useState<string>('');
  const [loading, setLoading] = useState(true);

  // Matched students state
  const [courseData, setCourseData] = useState<{
    course: Course | null;
    students: {
      profile: StudentProfile;
      exam: StudentExam;
      centre?: ExamCentre;
    }[];
    groupLink: CourseGroupLink | null;
  }>({
    course: null,
    students: [],
    groupLink: null,
  });

  const [searchQuery, setSearchQuery] = useState('');
  const [isLinkModalOpen, setIsLinkModalOpen] = useState(false);
  const [isReportModalOpen, setIsReportModalOpen] = useState(false);

  // Load courses catalogue
  useEffect(() => {
    const fetchCourses = async () => {
      try {
        setLoading(true);
        const data = await dataService.getCourses();
        setCourses(data);
        if (initialCourseId && data.some(c => c.id === initialCourseId)) {
          setSelectedCourseId(initialCourseId);
        } else if (data.length > 0 && !selectedCourseId) {
          setSelectedCourseId(data[0].id);
        }
      } catch (err) {
        console.error('Failed to load courses:', err);
      } finally {
        setLoading(false);
      }
    };
    fetchCourses();
  }, [initialCourseId]);

  // Load students taking the selected course
  const loadCourseStudents = async (cId: string) => {
    if (!cId) return;
    try {
      const data = await dataService.getStudentsByCourse(cId);
      setCourseData(data);
    } catch (err) {
      console.error('Failed to load course students:', err);
    }
  };

  useEffect(() => {
    if (selectedCourseId) {
      loadCourseStudents(selectedCourseId);
    }
  }, [selectedCourseId]);

  const handleSaveCourseWhatsAppLink = async (link: string) => {
    if (!selectedCourseId || !user) return;
    await dataService.updateCourseWhatsAppLink(selectedCourseId, link, user.id);
    await loadCourseStudents(selectedCourseId);
  };

  const formatRegNo = (memberStudent?: StudentProfile) => {
    if (!memberStudent) return 'N/A';
    if (memberStudent.phone_visible || memberStudent.id === user?.id) {
      return memberStudent.reg_no;
    }
    const reg = memberStudent.reg_no;
    if (reg.length > 7) {
      return `${reg.substring(0, 6)}*****${reg.slice(-1)}`;
    }
    return reg;
  };

  const filteredStudents = courseData.students.filter(item => {
    const p = item.profile;
    const q = searchQuery.toLowerCase();
    return (
      p.full_name.toLowerCase().includes(q) ||
      p.reg_no.toLowerCase().includes(q) ||
      p.branch.toLowerCase().includes(q) ||
      (item.centre?.name || '').toLowerCase().includes(q)
    );
  });

  const activeCourse = courses.find(c => c.id === selectedCourseId);

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8 animate-fade-in">
      
      {/* Title & Description */}
      <div className="space-y-2">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-[11px] font-bold bg-emerald-100 text-emerald-900">
          <BookOpen className="w-3.5 h-3.5 text-emerald-700" />
          <span>Section 2: Course-Level Study Buddy Discovery</span>
        </div>
        <h1 className="text-2xl sm:text-3xl font-extrabold text-navy-950">
          Same MOOC Course Study Groups
        </h1>
        <p className="text-xs text-slate-500 max-w-3xl leading-relaxed">
          Connect with peers taking the same NPTEL online course for coursework discussions, assignment doubts, and study material sharing — <strong>regardless of their exam centre or shift timings</strong>!
        </p>
      </div>

      {/* Course Selector Tabs / Grid */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-subtle space-y-3">
        <label className="block text-xs font-semibold text-slate-700">
          Choose NPTEL MOOC Course:
        </label>
        <div className="flex flex-wrap gap-2">
          {courses.map(crs => {
            const isSelected = crs.id === selectedCourseId;
            return (
              <button
                key={crs.id}
                type="button"
                onClick={() => setSelectedCourseId(crs.id)}
                className={`px-3.5 py-2 rounded-xl text-xs font-semibold transition-all flex items-center gap-2 ${
                  isSelected
                    ? 'bg-navy-900 text-white shadow-sm'
                    : 'bg-slate-100 text-slate-700 hover:bg-slate-200 border border-slate-200'
                }`}
              >
                <span>{crs.name}</span>
                <span className={`text-[10px] font-mono px-1.5 py-0.2 rounded ${
                  isSelected ? 'bg-navy-800 text-amber-300' : 'bg-slate-200 text-slate-600'
                }`}>
                  {crs.code}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {activeCourse && (
        <div className="space-y-6">
          {/* Active Course Banner */}
          <div className="bg-white rounded-3xl border border-slate-200 p-6 sm:p-8 shadow-card space-y-6">
            <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-6 pb-6 border-b border-slate-100">
              <div className="space-y-2">
                <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-800 bg-emerald-50 px-2.5 py-1 rounded-full border border-emerald-200">
                  NPTEL MOOC Catalogue
                </span>
                <h2 className="text-xl sm:text-2xl font-extrabold text-navy-950">
                  {activeCourse.name}
                </h2>
                <p className="text-xs text-slate-500 font-mono">
                  Official Code: {activeCourse.code} · Total Enrolled Buddies: {courseData.students.length}
                </p>
              </div>

              <div className="bg-slate-50 border border-slate-200/80 p-4 rounded-2xl flex items-center gap-4">
                <Users className="w-8 h-8 text-navy-800 shrink-0" />
                <div>
                  <span className="text-[10px] font-bold uppercase text-slate-500">Students Enrolled</span>
                  <p className="text-lg font-black text-navy-950">{courseData.students.length} Peers</p>
                </div>
              </div>
            </div>

            {/* Course WhatsApp Study Group Widget */}
            <div className="rounded-2xl p-5 border bg-emerald-50/40 border-emerald-200 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
              <div className="flex items-start gap-3.5">
                <div className="w-11 h-11 rounded-2xl bg-emerald-600 text-white flex items-center justify-center shrink-0 shadow-sm">
                  <MessageSquare className="w-6 h-6" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="text-sm font-bold text-navy-950">
                      Course Study WhatsApp Group
                    </h3>
                    <span className="text-[10px] font-semibold text-slate-500 bg-white px-2 py-0.5 rounded border border-slate-200">
                      Peer Discussion
                    </span>
                  </div>

                  {courseData.groupLink ? (
                    <p className="text-xs text-slate-600 mt-0.5">
                      A WhatsApp study group link is active for this course. Click below to join discussion and doubt solving.
                    </p>
                  ) : (
                    <p className="text-xs text-slate-600 mt-0.5">
                      No WhatsApp group shared yet for {activeCourse.name}. Be the first student to create one!
                    </p>
                  )}
                </div>
              </div>

              {/* Action buttons */}
              <div className="flex flex-wrap items-center gap-2.5 shrink-0 w-full sm:w-auto">
                {courseData.groupLink ? (
                  <>
                    <a
                      href={courseData.groupLink.whatsapp_group_link}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="px-5 py-2.5 text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 rounded-xl transition-all shadow-sm flex items-center gap-1.5"
                    >
                      <span>Join Study Group</span>
                      <ExternalLink className="w-3.5 h-3.5" />
                    </a>

                    <button
                      onClick={() => setIsLinkModalOpen(true)}
                      className="px-3 py-2 text-xs font-semibold text-slate-700 bg-white hover:bg-slate-100 border border-slate-200 rounded-xl transition-colors"
                    >
                      Update Link
                    </button>

                    <button
                      onClick={() => setIsReportModalOpen(true)}
                      className="px-2.5 py-2 text-xs font-semibold text-rose-600 hover:bg-rose-50 border border-transparent hover:border-rose-200 rounded-xl transition-colors"
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
                    <span>Share WhatsApp Study Group</span>
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* Students Grid */}
          <div className="space-y-4">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
              <div>
                <h3 className="text-base font-bold text-navy-950 flex items-center gap-2">
                  <span>Enrolled Course Peers</span>
                  <span className="px-2 py-0.5 rounded-full text-xs font-bold bg-navy-100 text-navy-900">
                    {filteredStudents.length}
                  </span>
                </h3>
                <p className="text-xs text-slate-500">
                  Fellow SRM AP students studying {activeCourse.name}
                </p>
              </div>

              {/* Search */}
              <div className="relative w-full sm:w-64">
                <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-3 pointer-events-none" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  placeholder="Filter by student name, branch..."
                  className="w-full text-xs pl-8 pr-3 py-2 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-navy-700 bg-white"
                />
              </div>
            </div>

            {/* Student Cards Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredStudents.map(item => {
                const s = item.profile;
                const exam = item.exam;
                const isCurrentUser = s.id === user?.id;

                return (
                  <div
                    key={exam.id}
                    className={`bg-white rounded-2xl border p-5 shadow-subtle hover:shadow-card transition-all space-y-3 ${
                      isCurrentUser ? 'border-navy-900 bg-navy-50/20' : 'border-slate-200'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <div className="flex items-center gap-2">
                          <h4 className="font-bold text-xs text-navy-950">{s.full_name}</h4>
                          {isCurrentUser && (
                            <span className="text-[9px] px-1.5 py-0.2 rounded bg-navy-900 text-white font-bold">
                              You
                            </span>
                          )}
                        </div>
                        <p className="text-[11px] font-mono text-slate-500">
                          {formatRegNo(s)}
                        </p>
                      </div>

                      <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-slate-100 text-slate-700">
                        {s.academic_year}
                      </span>
                    </div>

                    <div className="pt-2 border-t border-slate-100 text-xs space-y-1.5">
                      <div className="flex items-center justify-between text-[11px]">
                        <span className="text-slate-500">Branch & Section:</span>
                        <span className="font-semibold text-slate-800">
                          {s.branch} · {s.section}
                        </span>
                      </div>

                      <div className="flex items-center justify-between text-[11px]">
                        <span className="text-slate-500">Exam Slot:</span>
                        {exam.status === 'CONFIRMED' ? (
                          <span className="font-semibold text-emerald-800 flex items-center gap-1">
                            <Clock className="w-3 h-3 text-emerald-600" />
                            {exam.exam_date} ({exam.shift || 'FN'})
                          </span>
                        ) : (
                          <span className="text-amber-700 font-medium">
                            Hall ticket pending
                          </span>
                        )}
                      </div>

                      {exam.centre && (
                        <div className="text-[10px] text-slate-500 flex items-center gap-1 pt-0.5">
                          <MapPin className="w-3 h-3 text-slate-400 shrink-0" />
                          <span className="truncate">{exam.centre.name}, {exam.centre.city}</span>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>

            {filteredStudents.length === 0 && (
              <div className="p-8 text-center text-xs text-slate-400 bg-white rounded-2xl border border-slate-200">
                No students found matching your search.
              </div>
            )}
          </div>
        </div>
      )}

      {/* WhatsApp Link Modal */}
      {activeCourse && (
        <WhatsAppLinkModal
          isOpen={isLinkModalOpen}
          onClose={() => setIsLinkModalOpen(false)}
          onSubmit={handleSaveCourseWhatsAppLink}
          title="Course Study WhatsApp Group"
          subtitle={`Study group for ${activeCourse.name} (${activeCourse.code})`}
          currentLink={courseData.groupLink?.whatsapp_group_link}
        />
      )}

      {/* Report Modal */}
      {activeCourse && courseData.groupLink && (
        <ReportLinkModal
          isOpen={isReportModalOpen}
          onClose={() => setIsReportModalOpen(false)}
          linkType="COURSE"
          targetId={activeCourse.id}
          whatsappLink={courseData.groupLink.whatsapp_group_link}
          targetTitle={activeCourse.name}
        />
      )}
    </div>
  );
};
