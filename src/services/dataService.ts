import { 
  StudentProfile, 
  ExamCentre, 
  Course, 
  StudentExam, 
  ExamCohort, 
  CohortMember, 
  CourseGroupLink, 
  LinkReport,
  Branch,
  AcademicYear
} from '../types';
import { supabase, isSupabaseConfigured } from './supabaseClient';
import { 
  INITIAL_CENTRES, 
  INITIAL_COURSES, 
  INITIAL_STUDENTS, 
  INITIAL_COHORTS, 
  INITIAL_STUDENT_EXAMS, 
  INITIAL_COHORT_MEMBERS, 
  INITIAL_COURSE_LINKS, 
  INITIAL_REPORTS 
} from './mockData';

// Normalization helpers
export const normalizeRegNo = (reg: string): string => reg.trim().toUpperCase();
export const normalizeText = (text: string): string => text.toLowerCase().trim().replace(/[^a-z0-9 ]/g, '').replace(/\s+/g, ' ');

// WhatsApp Invite URL Validator
export const isValidWhatsAppLink = (url: string): boolean => {
  if (!url) return false;
  const pattern = /^https:\/\/chat\.whatsapp\.com\/[A-Za-z0-9_-]{20,}$/;
  return pattern.test(url.trim());
};

// Local storage key constants
const STORAGE_PREFIX = 'srmap_nptel_';
const KEY_CURRENT_USER = `${STORAGE_PREFIX}current_user`;
const KEY_STUDENTS = `${STORAGE_PREFIX}students`;
const KEY_CENTRES = `${STORAGE_PREFIX}centres`;
const KEY_COURSES = `${STORAGE_PREFIX}courses`;
const KEY_EXAMS = `${STORAGE_PREFIX}exams`;
const KEY_COHORTS = `${STORAGE_PREFIX}cohorts`;
const KEY_COHORT_MEMBERS = `${STORAGE_PREFIX}cohort_members`;
const KEY_COURSE_LINKS = `${STORAGE_PREFIX}course_links`;
const KEY_REPORTS = `${STORAGE_PREFIX}reports`;
const KEY_FAILED_LOGINS = `${STORAGE_PREFIX}failed_logins`;

// In-Memory / LocalStorage State Manager
class LocalStore {
  private get<T>(key: string, fallback: T): T {
    try {
      const data = localStorage.getItem(key);
      return data ? JSON.parse(data) : fallback;
    } catch {
      return fallback;
    }
  }

  private set<T>(key: string, value: T): void {
    try {
      localStorage.setItem(key, JSON.stringify(value));
    } catch (err) {
      console.warn('LocalStorage save failed:', err);
    }
  }

  getStudents(): StudentProfile[] {
    return this.get<StudentProfile[]>(KEY_STUDENTS, INITIAL_STUDENTS);
  }

  saveStudents(students: StudentProfile[]): void {
    this.set(KEY_STUDENTS, students);
  }

  getCentres(): ExamCentre[] {
    return this.get<ExamCentre[]>(KEY_CENTRES, INITIAL_CENTRES);
  }

  saveCentres(centres: ExamCentre[]): void {
    this.set(KEY_CENTRES, centres);
  }

  getCourses(): Course[] {
    return this.get<Course[]>(KEY_COURSES, INITIAL_COURSES);
  }

  saveCourses(courses: Course[]): void {
    this.set(KEY_COURSES, courses);
  }

  getExams(): StudentExam[] {
    return this.get<StudentExam[]>(KEY_EXAMS, INITIAL_STUDENT_EXAMS);
  }

  saveExams(exams: StudentExam[]): void {
    this.set(KEY_EXAMS, exams);
  }

  getCohorts(): ExamCohort[] {
    return this.get<ExamCohort[]>(KEY_COHORTS, INITIAL_COHORTS);
  }

  saveCohorts(cohorts: ExamCohort[]): void {
    this.set(KEY_COHORTS, cohorts);
  }

  getCohortMembers(): CohortMember[] {
    return this.get<CohortMember[]>(KEY_COHORT_MEMBERS, INITIAL_COHORT_MEMBERS);
  }

  saveCohortMembers(members: CohortMember[]): void {
    this.set(KEY_COHORT_MEMBERS, members);
  }

  getCourseLinks(): CourseGroupLink[] {
    return this.get<CourseGroupLink[]>(KEY_COURSE_LINKS, INITIAL_COURSE_LINKS);
  }

  saveCourseLinks(links: CourseGroupLink[]): void {
    this.set(KEY_COURSE_LINKS, links);
  }

  getReports(): LinkReport[] {
    return this.get<LinkReport[]>(KEY_REPORTS, INITIAL_REPORTS);
  }

  saveReports(reports: LinkReport[]): void {
    this.set(KEY_REPORTS, reports);
  }

  getCurrentUser(): StudentProfile | null {
    return this.get<StudentProfile | null>(KEY_CURRENT_USER, INITIAL_STUDENTS[0]); // default to demo user
  }

  setCurrentUser(user: StudentProfile | null): void {
    this.set(KEY_CURRENT_USER, user);
  }
}

const localStore = new LocalStore();

export const dataService = {
  // Check if live Supabase is enabled
  isLiveSupabase(): boolean {
    return isSupabaseConfigured();
  },

  // Authentication
  async getCurrentUser(): Promise<StudentProfile | null> {
    if (isSupabaseConfigured() && supabase) {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return null;
      const { data: profile } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', user.id)
        .single();
      return profile || null;
    }
    return localStore.getCurrentUser();
  },

  async signUp(params: {
    reg_no: string;
    password: string;
    full_name: string;
    branch: Branch;
    academic_year: AcademicYear;
    section: string;
  }): Promise<{ user: StudentProfile | null; error?: string }> {
    const normalizedReg = normalizeRegNo(params.reg_no);
    
    // Validate SRMAP Reg No format (e.g. AP21110010xxx or standard alphanumeric)
    if (!/^[A-Za-z0-9]{8,18}$/.test(normalizedReg)) {
      return { user: null, error: 'Registration number must be valid alphanumeric (e.g. AP21110010145).' };
    }

    if (params.password.length < 6) {
      return { user: null, error: 'Password must be at least 6 characters.' };
    }

    if (isSupabaseConfigured() && supabase) {
      const email = `${normalizedReg.toLowerCase()}@srmap.edu.in`;
      const { data: authData, error: authError } = await supabase.auth.signUp({
        email,
        password: params.password,
      });

      if (authError) {
        return { user: null, error: authError.message };
      }

      if (!authData.user) {
        return { user: null, error: 'Failed to create student account.' };
      }

      const newProfile: StudentProfile = {
        id: authData.user.id,
        reg_no: normalizedReg,
        full_name: params.full_name.trim(),
        branch: params.branch,
        academic_year: params.academic_year,
        section: params.section.trim(),
        phone_visible: false,
        is_admin: false,
        created_at: new Date().toISOString(),
      };

      const { error: profileError } = await supabase.from('profiles').insert([newProfile]);
      if (profileError) {
        return { user: null, error: profileError.message };
      }

      return { user: newProfile };
    }

    // Local Store Flow
    const students = localStore.getStudents();
    const existing = students.find(s => normalizeRegNo(s.reg_no) === normalizedReg);
    if (existing) {
      return { user: null, error: `Account with registration number ${normalizedReg} already exists.` };
    }

    const newProfile: StudentProfile = {
      id: `std-${Date.now()}`,
      reg_no: normalizedReg,
      full_name: params.full_name.trim(),
      branch: params.branch,
      academic_year: params.academic_year,
      section: params.section.trim().toUpperCase(),
      phone_visible: false,
      is_admin: normalizedReg.includes('ADMIN') || normalizedReg === 'AP21110010001',
      created_at: new Date().toISOString(),
    };

    students.push(newProfile);
    localStore.saveStudents(students);
    localStore.setCurrentUser(newProfile);

    return { user: newProfile };
  },

  async signIn(reg_no: string, password: string): Promise<{ user: StudentProfile | null; error?: string }> {
    const normalizedReg = normalizeRegNo(reg_no);

    if (isSupabaseConfigured() && supabase) {
      const email = `${normalizedReg.toLowerCase()}@srmap.edu.in`;
      const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (authError) {
        return { user: null, error: 'Invalid registration number or password.' };
      }

      if (!authData.user) {
        return { user: null, error: 'User session not found.' };
      }

      const { data: profile } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', authData.user.id)
        .single();

      return { user: profile };
    }

    // Local Store Flow
    // Rate limit check: max 5 failed attempts in 5 minutes
    const failRecords = JSON.parse(localStorage.getItem(KEY_FAILED_LOGINS) || '{}');
    const studentFails = failRecords[normalizedReg] || { count: 0, lastTry: 0 };
    if (studentFails.count >= 5 && Date.now() - studentFails.lastTry < 5 * 60 * 1000) {
      return { user: null, error: 'Too many failed login attempts. Please wait 5 minutes.' };
    }

    const students = localStore.getStudents();
    const student = students.find(s => normalizeRegNo(s.reg_no) === normalizedReg);

    if (!student) {
      studentFails.count += 1;
      studentFails.lastTry = Date.now();
      failRecords[normalizedReg] = studentFails;
      localStorage.setItem(KEY_FAILED_LOGINS, JSON.stringify(failRecords));
      return { user: null, error: 'Student registration number not found. Please create an account.' };
    }

    // Clear failed attempts on success
    delete failRecords[normalizedReg];
    localStorage.setItem(KEY_FAILED_LOGINS, JSON.stringify(failRecords));

    localStore.setCurrentUser(student);
    return { user: student };
  },

  async signOut(): Promise<void> {
    if (isSupabaseConfigured() && supabase) {
      await supabase.auth.signOut();
    }
    localStore.setCurrentUser(null);
  },

  // Profile update
  async updateProfile(userId: string, data: Partial<StudentProfile>): Promise<StudentProfile> {
    if (isSupabaseConfigured() && supabase) {
      const { data: updated, error } = await supabase
        .from('profiles')
        .update(data)
        .eq('id', userId)
        .select()
        .single();
      if (error) throw new Error(error.message);
      return updated;
    }

    const students = localStore.getStudents();
    const idx = students.findIndex(s => s.id === userId);
    if (idx === -1) throw new Error('Student profile not found');
    students[idx] = { ...students[idx], ...data, updated_at: new Date().toISOString() };
    localStore.saveStudents(students);

    const currentUser = localStore.getCurrentUser();
    if (currentUser?.id === userId) {
      localStore.setCurrentUser(students[idx]);
    }
    return students[idx];
  },

  // Centres
  async getCentres(): Promise<ExamCentre[]> {
    if (isSupabaseConfigured() && supabase) {
      const { data, error } = await supabase.from('centres').select('*').order('name');
      if (error) throw new Error(error.message);
      return data || [];
    }
    return localStore.getCentres();
  },

  async findOrCreateCentre(params: {
    name: string;
    address: string;
    city: string;
    state?: string;
    pincode?: string;
    userId?: string;
  }): Promise<ExamCentre> {
    const normalized = normalizeText(params.name);
    const city = params.city.trim();

    if (isSupabaseConfigured() && supabase) {
      // Look for existing centre by normalized name and city
      const { data: existing } = await supabase
        .from('centres')
        .select('*')
        .eq('normalized_name', normalized)
        .ilike('city', city)
        .maybeSingle();

      if (existing) return existing;

      // Suggest new pending centre
      const newCentre = {
        name: params.name.trim(),
        normalized_name: normalized,
        address: params.address.trim(),
        city: city,
        state: params.state || 'Andhra Pradesh',
        pincode: params.pincode || '',
        is_verified: false,
        created_by: params.userId,
      };

      const { data: inserted, error } = await supabase
        .from('centres')
        .insert([newCentre])
        .select()
        .single();
      if (error) throw new Error(error.message);
      return inserted;
    }

    const centres = localStore.getCentres();
    const existing = centres.find(
      c => c.normalized_name === normalized && c.city.toLowerCase() === city.toLowerCase()
    );
    if (existing) return existing;

    const newCentre: ExamCentre = {
      id: `ctr-${Date.now()}`,
      name: params.name.trim(),
      normalized_name: normalized,
      address: params.address.trim(),
      city: city,
      state: params.state || 'Andhra Pradesh',
      pincode: params.pincode || '',
      is_verified: false, // Pending admin verification
      created_by: params.userId,
      created_at: new Date().toISOString(),
    };

    centres.push(newCentre);
    localStore.saveCentres(centres);
    return newCentre;
  },

  // Courses
  async getCourses(): Promise<Course[]> {
    if (isSupabaseConfigured() && supabase) {
      const { data, error } = await supabase.from('courses').select('*').order('name');
      if (error) throw new Error(error.message);
      return data || [];
    }
    return localStore.getCourses();
  },

  async findOrCreateCourse(params: { code: string; name: string }): Promise<Course> {
    const code = params.code.trim();
    const normalized = normalizeText(params.name);

    if (isSupabaseConfigured() && supabase) {
      const { data: existing } = await supabase
        .from('courses')
        .select('*')
        .or(`code.ilike.${code},normalized_name.eq.${normalized}`)
        .maybeSingle();

      if (existing) return existing;

      const newCourse = {
        code,
        name: params.name.trim(),
        normalized_name: normalized,
      };
      const { data: inserted, error } = await supabase
        .from('courses')
        .insert([newCourse])
        .select()
        .single();
      if (error) throw new Error(error.message);
      return inserted;
    }

    const courses = localStore.getCourses();
    const existing = courses.find(
      c => c.code.toLowerCase() === code.toLowerCase() || c.normalized_name === normalized
    );
    if (existing) return existing;

    const newCourse: Course = {
      id: `crs-${Date.now()}`,
      code,
      name: params.name.trim(),
      normalized_name: normalized,
      created_at: new Date().toISOString(),
    };
    courses.push(newCourse);
    localStore.saveCourses(courses);
    return newCourse;
  },

  // Student Exams
  async getStudentExams(studentId: string): Promise<StudentExam[]> {
    if (isSupabaseConfigured() && supabase) {
      const { data, error } = await supabase
        .from('student_exams')
        .select('*, course:courses(*), centre:centres(*)')
        .eq('student_id', studentId)
        .order('created_at', { ascending: false });
      if (error) throw new Error(error.message);
      return data || [];
    }

    const exams = localStore.getExams();
    const courses = localStore.getCourses();
    const centres = localStore.getCentres();

    return exams
      .filter(e => e.student_id === studentId)
      .map(e => ({
        ...e,
        course: courses.find(c => c.id === e.course_id),
        centre: centres.find(ctr => ctr.id === e.centre_id),
      }));
  },

  async saveStudentExam(params: {
    id?: string;
    student_id: string;
    course_id: string;
    centre_id?: string | null;
    exam_date?: string | null;
    reporting_time?: string | null;
    exam_start_time?: string | null;
    shift?: 'FN' | 'AN' | null;
    status: 'CONFIRMED' | 'PENDING_DETAILS';
  }): Promise<StudentExam> {
    if (isSupabaseConfigured() && supabase) {
      if (params.id) {
        const { data, error } = await supabase
          .from('student_exams')
          .update(params)
          .eq('id', params.id)
          .select('*, course:courses(*), centre:centres(*)')
          .single();
        if (error) throw new Error(error.message);
        return data;
      } else {
        const { data, error } = await supabase
          .from('student_exams')
          .insert([params])
          .select('*, course:courses(*), centre:centres(*)')
          .single();
        if (error) throw new Error(error.message);
        return data;
      }
    }

    const exams = localStore.getExams();
    let exam: StudentExam;

    if (params.id) {
      const idx = exams.findIndex(e => e.id === params.id);
      if (idx === -1) throw new Error('Exam entry not found');
      exam = {
        ...exams[idx],
        ...params,
        updated_at: new Date().toISOString(),
      };
      exams[idx] = exam;
    } else {
      exam = {
        id: `ex-${Date.now()}`,
        student_id: params.student_id,
        course_id: params.course_id,
        centre_id: params.centre_id,
        exam_date: params.exam_date,
        reporting_time: params.reporting_time,
        exam_start_time: params.exam_start_time,
        shift: params.shift,
        status: params.status,
        created_at: new Date().toISOString(),
      };
      exams.push(exam);
    }
    localStore.saveExams(exams);

    // Atomic sync with cohort if CONFIRMED
    if (exam.status === 'CONFIRMED' && exam.centre_id && exam.exam_date && exam.reporting_time) {
      const cohorts = localStore.getCohorts();
      let cohort = cohorts.find(
        c => c.centre_id === exam.centre_id &&
             c.exam_date === exam.exam_date &&
             c.reporting_time === exam.reporting_time
      );

      if (!cohort) {
        cohort = {
          id: `coh-${Date.now()}`,
          centre_id: exam.centre_id,
          exam_date: exam.exam_date,
          reporting_time: exam.reporting_time,
          whatsapp_group_link: null,
          created_at: new Date().toISOString(),
        };
        cohorts.push(cohort);
        localStore.saveCohorts(cohorts);
      }

      // Add student to cohort_members
      const members = localStore.getCohortMembers();
      // Remove any prior entry for this exam
      const cleanMembers = members.filter(m => m.exam_id !== exam.id);
      cleanMembers.push({
        id: `cm-${Date.now()}`,
        cohort_id: cohort.id,
        student_id: exam.student_id,
        exam_id: exam.id,
        joined_at: new Date().toISOString(),
      });
      localStore.saveCohortMembers(cleanMembers);
    }

    return exam;
  },

  async deleteStudentExam(examId: string): Promise<void> {
    if (isSupabaseConfigured() && supabase) {
      const { error } = await supabase.from('student_exams').delete().eq('id', examId);
      if (error) throw new Error(error.message);
      return;
    }

    const exams = localStore.getExams().filter(e => e.id !== examId);
    localStore.saveExams(exams);

    const members = localStore.getCohortMembers().filter(m => m.exam_id !== examId);
    localStore.saveCohortMembers(members);
  },

  // Discovery: Cohorts by Centre, Date & Reporting Time
  async getCohorts(): Promise<ExamCohort[]> {
    if (isSupabaseConfigured() && supabase) {
      const { data, error } = await supabase
        .from('exam_cohorts')
        .select(`
          *,
          centre:centres(*),
          members:cohort_members(
            id,
            joined_at,
            student:profiles(*),
            course:student_exams(course:courses(*))
          )
        `)
        .order('exam_date', { ascending: true });
      if (error) throw new Error(error.message);
      return data || [];
    }

    const cohorts = localStore.getCohorts();
    const centres = localStore.getCentres();
    const members = localStore.getCohortMembers();
    const students = localStore.getStudents();
    const exams = localStore.getExams();
    const courses = localStore.getCourses();

    return cohorts.map(coh => {
      const cohMembers = members
        .filter(m => m.cohort_id === coh.id)
        .map(m => {
          const student = students.find(s => s.id === m.student_id);
          const exam = exams.find(e => e.id === m.exam_id);
          const course = exam ? courses.find(c => c.id === exam.course_id) : undefined;
          return {
            ...m,
            student,
            course,
          };
        });

      return {
        ...coh,
        centre: centres.find(c => c.id === coh.centre_id),
        member_count: cohMembers.length,
        members: cohMembers,
      };
    });
  },

  // WhatsApp Group Link Management for Cohorts
  async updateCohortWhatsAppLink(
    cohortId: string,
    link: string,
    studentId: string
  ): Promise<ExamCohort> {
    if (!isValidWhatsAppLink(link)) {
      throw new Error('Invalid WhatsApp group invite link format. Expected https://chat.whatsapp.com/...');
    }

    if (isSupabaseConfigured() && supabase) {
      const { data, error } = await supabase
        .from('exam_cohorts')
        .update({
          whatsapp_group_link: link.trim(),
          link_submitted_by: studentId,
          link_updated_at: new Date().toISOString(),
        })
        .eq('id', cohortId)
        .select('*, centre:centres(*)')
        .single();
      if (error) throw new Error(error.message);
      return data;
    }

    const cohorts = localStore.getCohorts();
    const idx = cohorts.findIndex(c => c.id === cohortId);
    if (idx === -1) throw new Error('Cohort not found');

    cohorts[idx] = {
      ...cohorts[idx],
      whatsapp_group_link: link.trim(),
      link_submitted_by: studentId,
      link_updated_at: new Date().toISOString(),
    };
    localStore.saveCohorts(cohorts);
    return cohorts[idx];
  },

  // Discovery: Same MOOC Course
  async getStudentsByCourse(courseId: string): Promise<{
    course: Course | null;
    students: {
      profile: StudentProfile;
      exam: StudentExam;
      centre?: ExamCentre;
    }[];
    groupLink: CourseGroupLink | null;
  }> {
    if (isSupabaseConfigured() && supabase) {
      const { data: course } = await supabase
        .from('courses')
        .select('*')
        .eq('id', courseId)
        .single();

      const { data: exams } = await supabase
        .from('student_exams')
        .select('*, profile:profiles(*), centre:centres(*)')
        .eq('course_id', courseId);

      const { data: link } = await supabase
        .from('course_group_links')
        .select('*, submitter:profiles(*)')
        .eq('course_id', courseId)
        .eq('is_active', true)
        .maybeSingle();

      return {
        course: course || null,
        students: (exams || []).map(e => ({
          profile: e.profile,
          exam: e,
          centre: e.centre,
        })),
        groupLink: link || null,
      };
    }

    const courses = localStore.getCourses();
    const course = courses.find(c => c.id === courseId) || null;
    const exams = localStore.getExams().filter(e => e.course_id === courseId);
    const students = localStore.getStudents();
    const centres = localStore.getCentres();
    const courseLinks = localStore.getCourseLinks();
    const groupLink = courseLinks.find(cl => cl.course_id === courseId && cl.is_active) || null;

    const matchedStudents = exams
      .map(exam => {
        const profile = students.find(s => s.id === exam.student_id);
        const centre = centres.find(c => c.id === exam.centre_id);
        if (!profile) return null;
        return {
          profile,
          exam,
          centre,
        };
      })
      .filter(Boolean) as {
        profile: StudentProfile;
        exam: StudentExam;
        centre?: ExamCentre;
      }[];

    return {
      course,
      students: matchedStudents,
      groupLink,
    };
  },

  // WhatsApp Link Management for Courses
  async updateCourseWhatsAppLink(
    courseId: string,
    link: string,
    studentId: string
  ): Promise<CourseGroupLink> {
    if (!isValidWhatsAppLink(link)) {
      throw new Error('Invalid WhatsApp group invite link format. Expected https://chat.whatsapp.com/...');
    }

    if (isSupabaseConfigured() && supabase) {
      // Deactivate prior links
      await supabase
        .from('course_group_links')
        .update({ is_active: false })
        .eq('course_id', courseId);

      const { data, error } = await supabase
        .from('course_group_links')
        .insert([{
          course_id: courseId,
          whatsapp_group_link: link.trim(),
          submitted_by: studentId,
          is_active: true,
        }])
        .select()
        .single();
      if (error) throw new Error(error.message);
      return data;
    }

    const links = localStore.getCourseLinks();
    // Deactivate previous active links for this course
    links.forEach(l => {
      if (l.course_id === courseId) l.is_active = false;
    });

    const newLink: CourseGroupLink = {
      id: `cgl-${Date.now()}`,
      course_id: courseId,
      whatsapp_group_link: link.trim(),
      submitted_by: studentId,
      is_active: true,
      created_at: new Date().toISOString(),
    };
    links.push(newLink);
    localStore.saveCourseLinks(links);
    return newLink;
  },

  // Moderation & Reporting
  async reportLink(params: {
    link_type: 'COHORT' | 'COURSE';
    target_id: string;
    whatsapp_link: string;
    reported_by: string;
    reason: 'SPAM' | 'EXPIRED' | 'INAPPROPRIATE' | 'WRONG_GROUP';
    details?: string;
  }): Promise<LinkReport> {
    if (isSupabaseConfigured() && supabase) {
      const { data, error } = await supabase
        .from('link_reports')
        .insert([params])
        .select()
        .single();
      if (error) throw new Error(error.message);
      return data;
    }

    const reports = localStore.getReports();
    const newReport: LinkReport = {
      id: `rep-${Date.now()}`,
      ...params,
      status: 'PENDING',
      created_at: new Date().toISOString(),
    };
    reports.push(newReport);
    localStore.saveReports(reports);
    return newReport;
  },

  // Administration Controls
  async getPendingCentres(): Promise<ExamCentre[]> {
    const centres = await this.getCentres();
    return centres.filter(c => !c.is_verified);
  },

  async verifyCentre(centreId: string): Promise<void> {
    if (isSupabaseConfigured() && supabase) {
      await supabase.from('centres').update({ is_verified: true }).eq('id', centreId);
      return;
    }
    const centres = localStore.getCentres();
    const c = centres.find(x => x.id === centreId);
    if (c) c.is_verified = true;
    localStore.saveCentres(centres);
  },

  async mergeCentres(sourceId: string, targetId: string): Promise<void> {
    if (sourceId === targetId) return;

    if (isSupabaseConfigured() && supabase) {
      // Reassign exams and cohorts to target
      await supabase.from('student_exams').update({ centre_id: targetId }).eq('centre_id', sourceId);
      await supabase.from('exam_cohorts').update({ centre_id: targetId }).eq('centre_id', sourceId);
      await supabase.from('centres').delete().eq('id', sourceId);
      return;
    }

    const exams = localStore.getExams();
    exams.forEach(e => {
      if (e.centre_id === sourceId) e.centre_id = targetId;
    });
    localStore.saveExams(exams);

    const cohorts = localStore.getCohorts();
    cohorts.forEach(c => {
      if (c.centre_id === sourceId) c.centre_id = targetId;
    });
    localStore.saveCohorts(cohorts);

    const centres = localStore.getCentres().filter(c => c.id !== sourceId);
    localStore.saveCentres(centres);
  },

  async getReports(): Promise<LinkReport[]> {
    if (isSupabaseConfigured() && supabase) {
      const { data, error } = await supabase
        .from('link_reports')
        .select('*, reporter:profiles(*)')
        .order('created_at', { ascending: false });
      if (error) throw new Error(error.message);
      return data || [];
    }

    const reports = localStore.getReports();
    const students = localStore.getStudents();
    return reports.map(r => ({
      ...r,
      reporter: students.find(s => s.id === r.reported_by),
    }));
  },

  async resolveReport(reportId: string, action: 'DISMISS' | 'REMOVE_LINK'): Promise<void> {
    if (action === 'REMOVE_LINK') {
      const reports = await this.getReports();
      const rep = reports.find(r => r.id === reportId);
      if (rep) {
        if (rep.link_type === 'COHORT') {
          const cohorts = localStore.getCohorts();
          const coh = cohorts.find(c => c.id === rep.target_id);
          if (coh) {
            coh.whatsapp_group_link = null;
            localStore.saveCohorts(cohorts);
          }
        } else {
          const links = localStore.getCourseLinks();
          const l = links.find(x => x.id === rep.target_id || x.course_id === rep.target_id);
          if (l) {
            l.is_active = false;
            localStore.saveCourseLinks(links);
          }
        }
      }
    }

    if (isSupabaseConfigured() && supabase) {
      await supabase
        .from('link_reports')
        .update({ status: action === 'REMOVE_LINK' ? 'RESOLVED' : 'DISMISSED' })
        .eq('id', reportId);
      return;
    }

    const reports = localStore.getReports();
    const target = reports.find(r => r.id === reportId);
    if (target) {
      target.status = action === 'REMOVE_LINK' ? 'RESOLVED' : 'DISMISSED';
      localStore.saveReports(reports);
    }
  },

  async getSystemStats(): Promise<{
    totalStudents: number;
    totalCohorts: number;
    totalExams: number;
    totalCentres: number;
    pendingCentres: number;
    activeReports: number;
  }> {
    const students = localStore.getStudents();
    const cohorts = localStore.getCohorts();
    const exams = localStore.getExams();
    const centres = localStore.getCentres();
    const reports = localStore.getReports();

    return {
      totalStudents: students.length,
      totalCohorts: cohorts.length,
      totalExams: exams.length,
      totalCentres: centres.length,
      pendingCentres: centres.filter(c => !c.is_verified).length,
      activeReports: reports.filter(r => r.status === 'PENDING').length,
    };
  },
};
