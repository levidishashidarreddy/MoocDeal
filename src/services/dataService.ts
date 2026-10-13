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
  AcademicYear,
  PaginationParams,
  PaginatedResult,
  CourseBuddiesResult
} from '../types';
import { supabase, isSupabaseConfigured } from './supabaseClient';
import { rateLimiter } from './rateLimiter';
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
import { resolveCanonicalCourseMatch } from './courseMatcher';
import { resolveCanonicalCentreMatch } from './centreMatcher';

// Normalization helpers
export const normalizeRegNo = (reg: string): string => reg.trim().toUpperCase();
export const normalizeText = (text: string): string => text.toLowerCase().trim().replace(/[^a-z0-9 ]/g, '').replace(/\s+/g, ' ');

// WhatsApp Invite URL Validator
// Strictly enforces https://chat.whatsapp.com/[token] with 20 to 32 alphanumeric/underscore/dash characters
// Rejects trailing parameters, fragments, insecure protocols, or phishing domains.
export const isValidWhatsAppLink = (url: string): boolean => {
  if (!url || typeof url !== 'string') return false;
  const trimmed = url.trim().replace(/\/+$/, '');
  const pattern = /^https:\/\/chat\.whatsapp\.com\/[A-Za-z0-9_-]{20,32}$/;
  return pattern.test(trimmed);
};

// Local storage key constants
const STORAGE_PREFIX = 'srmap_nptel_';
const KEY_CURRENT_USER = `${STORAGE_PREFIX}current_user`;

// In-flight concurrency locks to prevent race conditions during simultaneous creations
const courseCreationLocks = new Map<string, Promise<Course>>();
const centreCreationLocks = new Map<string, Promise<ExamCentre>>();
const KEY_STUDENTS = `${STORAGE_PREFIX}students`;
const KEY_CENTRES = `${STORAGE_PREFIX}centres`;
const KEY_COURSES = `${STORAGE_PREFIX}courses`;
const KEY_EXAMS = `${STORAGE_PREFIX}exams`;
const KEY_COHORTS = `${STORAGE_PREFIX}cohorts`;
const KEY_COHORT_MEMBERS = `${STORAGE_PREFIX}cohort_members`;
const KEY_COURSE_LINKS = `${STORAGE_PREFIX}course_links`;
const KEY_REPORTS = `${STORAGE_PREFIX}reports`;
const KEY_FAILED_LOGINS = `${STORAGE_PREFIX}failed_logins`;
const KEY_CREDENTIALS = `${STORAGE_PREFIX}credentials`;

// In-Memory / LocalStorage State Manager
class LocalStore {
  private memory: Record<string, any> = {};

  private get<T>(key: string, fallback: T): T {
    if (this.memory[key] !== undefined) return this.memory[key];
    try {
      if (typeof window !== 'undefined' && typeof localStorage !== 'undefined') {
        const data = localStorage.getItem(key);
        if (data) {
          const parsed = JSON.parse(data);
          this.memory[key] = parsed;
          return parsed;
        }
      }
    } catch {
      // Fall through to fallback
    }
    return fallback;
  }

  private set<T>(key: string, value: T): void {
    this.memory[key] = value;
    try {
      if (typeof window !== 'undefined' && typeof localStorage !== 'undefined') {
        localStorage.setItem(key, JSON.stringify(value));
      }
    } catch {
      // Ignore storage write issues
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

  getCredentials(): Record<string, string> {
    return this.get<Record<string, string>>(KEY_CREDENTIALS, {});
  }

  saveCredentials(creds: Record<string, string>): void {
    this.set(KEY_CREDENTIALS, creds);
  }

  getCurrentUser(): StudentProfile | null {
    return this.get<StudentProfile | null>(KEY_CURRENT_USER, null);
  }

  setCurrentUser(user: StudentProfile | null): void {
    this.set(KEY_CURRENT_USER, user);
  }

  resetToDefaults(): void {
    this.memory = {};
    this.saveStudents(INITIAL_STUDENTS);
    this.saveCentres(INITIAL_CENTRES);
    this.saveCourses(INITIAL_COURSES);
    this.saveExams(INITIAL_STUDENT_EXAMS);
    this.saveCohorts(INITIAL_COHORTS);
    this.saveCohortMembers(INITIAL_COHORT_MEMBERS);
    this.saveCourseLinks(INITIAL_COURSE_LINKS);
    this.saveReports(INITIAL_REPORTS);
    this.saveCredentials({});
    this.setCurrentUser(null);
  }
}

export const localStore = new LocalStore();

function getFailedLoginRecords(): Record<string, { count: number; lastTry: number }> {
  try {
    if (typeof localStorage !== 'undefined') {
      return JSON.parse(localStorage.getItem(KEY_FAILED_LOGINS) || '{}');
    }
  } catch {
    // ignore
  }
  return {};
}

function saveFailedLoginRecords(records: Record<string, { count: number; lastTry: number }>): void {
  try {
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(KEY_FAILED_LOGINS, JSON.stringify(records));
    }
  } catch {
    // ignore
  }
}

export const dataService = {
  // Check if live Supabase is enabled
  isLiveSupabase(): boolean {
    return isSupabaseConfigured();
  },

  // Authentication
  async getCurrentUser(): Promise<StudentProfile | null> {
    const cached = localStore.getCurrentUser();
    if (cached && isSupabaseConfigured() && supabase) {
      try {
        const { data: profile } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', cached.id)
          .maybeSingle();
        if (profile) {
          localStore.setCurrentUser(profile);
          return profile;
        }
      } catch (err) {
        console.warn('Failed to refresh user profile from Supabase:', err);
      }
    }
    return cached;
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

    if (params.password.length < 4) {
      return { user: null, error: 'Password or PIN must be at least 4 characters.' };
    }

    if (isSupabaseConfigured() && supabase) {
      try {
        const { data: profile, error } = await supabase.rpc('register_student', {
          p_reg_no: normalizedReg,
          p_full_name: params.full_name.trim(),
          p_branch: params.branch,
          p_academic_year: params.academic_year,
          p_section: params.section.trim(),
          p_password: params.password,
        });

        if (error) {
          return { user: null, error: error.message };
        }

        if (profile) {
          localStore.setCurrentUser(profile);
          return { user: profile };
        }
      } catch (err: any) {
        console.warn('Supabase register_student failed, using local store fallback:', err);
      }
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
    const creds = localStore.getCredentials();
    creds[normalizedReg] = params.password;
    localStore.saveCredentials(creds);
    localStore.setCurrentUser(newProfile);

    return { user: newProfile };
  },

  async signIn(reg_no: string, password: string): Promise<{ user: StudentProfile | null; error?: string }> {
    const normalizedReg = normalizeRegNo(reg_no);

    // Rate limit check: max 5 failed attempts in 5 minutes
    const failRecords = getFailedLoginRecords();
    const studentFails = failRecords[normalizedReg] || { count: 0, lastTry: 0 };
    if (studentFails.count >= 5 && Date.now() - studentFails.lastTry < 5 * 60 * 1000) {
      return { user: null, error: 'Too many failed login attempts. Please wait 5 minutes.' };
    }

    if (isSupabaseConfigured() && supabase) {
      try {
        const { data: profile, error } = await supabase.rpc('authenticate_student', {
          p_reg_no: normalizedReg,
          p_password: password,
        });

        if (error) {
          studentFails.count += 1;
          studentFails.lastTry = Date.now();
          failRecords[normalizedReg] = studentFails;
          saveFailedLoginRecords(failRecords);
          return { user: null, error: error.message || 'Invalid registration number or password.' };
        }

        if (profile) {
          if ((profile as any).error) {
            studentFails.count += 1;
            studentFails.lastTry = Date.now();
            failRecords[normalizedReg] = studentFails;
            saveFailedLoginRecords(failRecords);
            return { user: null, error: (profile as any).error };
          }

          if ((profile as any).id) {
            delete failRecords[normalizedReg];
            saveFailedLoginRecords(failRecords);
            localStore.setCurrentUser(profile as StudentProfile);
            return { user: profile as StudentProfile };
          }
        }
      } catch (err: any) {
        console.warn('Supabase authenticate_student failed, checking local store:', err);
      }
    }

    // Local Store Flow
    const students = localStore.getStudents();
    const student = students.find(s => normalizeRegNo(s.reg_no) === normalizedReg);

    if (!student) {
      studentFails.count += 1;
      studentFails.lastTry = Date.now();
      failRecords[normalizedReg] = studentFails;
      saveFailedLoginRecords(failRecords);
      return { user: null, error: 'Student registration number not found. Please create an account.' };
    }

    const creds = localStore.getCredentials();
    const storedPassword = creds[normalizedReg];
    if (storedPassword !== undefined && storedPassword !== password) {
      studentFails.count += 1;
      studentFails.lastTry = Date.now();
      failRecords[normalizedReg] = studentFails;
      saveFailedLoginRecords(failRecords);
      return { user: null, error: 'Invalid registration number or password.' };
    }

    // Clear failed attempts on success
    delete failRecords[normalizedReg];
    saveFailedLoginRecords(failRecords);

    localStore.setCurrentUser(student);
    return { user: student };
  },

  async signOut(): Promise<void> {
    if (isSupabaseConfigured() && supabase) {
      try {
        await supabase.auth.signOut();
      } catch {
        // ignore
      }
    }
    localStore.setCurrentUser(null);
  },

  // Profile update
  async updateProfile(userId: string, data: Partial<StudentProfile>): Promise<StudentProfile> {
    if (isSupabaseConfigured() && supabase) {
      if (data.full_name && data.branch && data.academic_year && data.section) {
        try {
          const { data: rpcData, error: rpcError } = await supabase.rpc('update_student_profile', {
            p_student_id: userId,
            p_full_name: data.full_name.trim(),
            p_branch: data.branch,
            p_academic_year: data.academic_year,
            p_section: data.section.trim().toUpperCase(),
          });
          if (!rpcError && rpcData) {
            localStore.setCurrentUser(rpcData);
            const students = localStore.getStudents();
            const idx = students.findIndex(s => s.id === userId);
            if (idx !== -1) {
              students[idx] = { ...students[idx], ...rpcData };
              localStore.saveStudents(students);
            }
            if (typeof window !== 'undefined') {
              window.dispatchEvent(new CustomEvent('moocdeal_profile_updated', { detail: rpcData }));
            }
            return rpcData;
          }
        } catch (rpcErr) {
          console.warn('RPC update_student_profile failed, falling back to direct update:', rpcErr);
        }
      }

      const { data: updated, error } = await supabase
        .from('profiles')
        .update(data)
        .eq('id', userId)
        .select()
        .single();
      if (error) throw new Error(error.message);

      localStore.setCurrentUser(updated);
      const students = localStore.getStudents();
      const idx = students.findIndex(s => s.id === userId);
      if (idx !== -1) {
        students[idx] = { ...students[idx], ...updated };
        localStore.saveStudents(students);
      }
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('moocdeal_profile_updated', { detail: updated }));
      }
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
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('moocdeal_profile_updated', { detail: students[idx] }));
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
    const rawName = params.name.trim();
    const city = params.city.trim() || 'Vijayawada';
    const lockKey = `${normalizeText(rawName)}_${city.toLowerCase()}`;

    if (centreCreationLocks.has(lockKey)) {
      return centreCreationLocks.get(lockKey)!;
    }

    const creationPromise = (async () => {
      // 1. Check canonical match against existing centre catalogue first
      const centres = await this.getCentres();
      const resolution = resolveCanonicalCentreMatch({
        name: rawName,
        address: params.address,
        city: city,
        pincode: params.pincode,
      }, centres);

      if ((resolution.status === 'EXACT' || resolution.status === 'STRONG_FUZZY') && resolution.matchedCentre) {
        return resolution.matchedCentre;
      }

      const normalized = normalizeText(rawName);

      if (isSupabaseConfigured() && supabase) {
        // 1. Try atomic server-side RPC first
        try {
          const { data: rpcData, error: rpcError } = await supabase.rpc('resolve_or_create_centre', {
            p_name: rawName,
            p_address: params.address.trim(),
            p_city: city,
            p_state: params.state || 'Andhra Pradesh',
            p_pincode: params.pincode || '',
            p_user_id: params.userId || null,
          });
          if (!rpcError && rpcData) {
            return rpcData as ExamCentre;
          }
          if (rpcError) {
            console.warn('RPC resolve_or_create_centre returned error:', rpcError.message);
          }
        } catch (err) {
          console.warn('RPC resolve_or_create_centre failed, falling back to query/insert:', err);
        }

        // 2. Query fallback
        const { data: existing } = await supabase
          .from('centres')
          .select('*')
          .eq('normalized_name', normalized)
          .ilike('city', city)
          .maybeSingle();

        if (existing) return existing;

        // Suggest new pending centre
        const newCentre = {
          name: rawName,
          normalized_name: normalized,
          address: params.address.trim() || 'Assigned Test Centre',
          city: city,
          state: params.state || 'Andhra Pradesh',
          pincode: params.pincode || '',
          is_verified: false,
          created_by: params.userId || null,
        };

        const { data: inserted, error } = await supabase
          .from('centres')
          .insert([newCentre])
          .select()
          .single();
        if (error) throw new Error(error.message);
        return inserted;
      }

      const localCentres = localStore.getCentres();
      const existing = localCentres.find(
        c => c.normalized_name === normalized && c.city.toLowerCase() === city.toLowerCase()
      );
      if (existing) return existing;

      const newCentre: ExamCentre = {
        id: `ctr-${Date.now()}`,
        name: rawName,
        normalized_name: normalized,
        address: params.address.trim(),
        city: city,
        state: params.state || 'Andhra Pradesh',
        pincode: params.pincode || '',
        is_verified: false, // Pending admin verification
        created_by: params.userId,
        created_at: new Date().toISOString(),
      };

      localCentres.push(newCentre);
      localStore.saveCentres(localCentres);
      return newCentre;
    })();

    centreCreationLocks.set(lockKey, creationPromise);
    try {
      return await creationPromise;
    } finally {
      centreCreationLocks.delete(lockKey);
    }
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

  async findOrCreateCourse(
    params: { code: string; name: string },
    options: { isStudent?: boolean } = {}
  ): Promise<Course> {
    const rawCode = params.code.trim();
    const rawName = params.name.trim();
    const normalized = normalizeText(rawName);
    const lockKey = normalized || rawCode.toLowerCase();

    if (courseCreationLocks.has(lockKey)) {
      return courseCreationLocks.get(lockKey)!;
    }

    const creationPromise = (async () => {
      // 1. Fetch official catalogue to check for canonical matches using shared matcher
      const courses = await this.getCourses();
      const resolution = resolveCanonicalCourseMatch({ title: rawName, code: rawCode }, courses);
      if ((resolution.status === 'EXACT' || resolution.status === 'HIGH_CONFIDENCE') && resolution.matchedCourse) {
        return resolution.matchedCourse;
      }
      if (resolution.candidates.length > 0 && resolution.candidates[0].isStrongMatch) {
        return resolution.candidates[0].course;
      }

      if (isSupabaseConfigured() && supabase) {
        try {
          const { data: rpcData, error: rpcError } = await supabase.rpc('resolve_canonical_course', {
            p_code: rawCode,
            p_name: rawName,
          });
          if (!rpcError && rpcData) {
            return rpcData;
          }
        } catch (err) {
          console.warn('RPC resolve_canonical_course failed, trying direct query:', err);
        }

        const { data: existing } = await supabase
          .from('courses')
          .select('*')
          .or(`code.ilike.${rawCode || 'NONE'},normalized_name.eq.${normalized}`)
          .maybeSingle();

        if (existing) return existing;
      }

      const localCourses = localStore.getCourses();
      const existing = localCourses.find(
        c => (rawCode && c.code.toLowerCase() === rawCode.toLowerCase()) || c.normalized_name === normalized
      );
      if (existing) return existing;

      // If student is initiating or saving, absolutely no student-created courses allowed
      if (options.isStudent) {
        throw new Error('Course not found in the official SRM AP course list. Please check the name or contact SRM DEALINGS.');
      }

      // Authorized / Admin / Migration fallback creation
      let assignedCode = rawCode;
      if (!assignedCode) {
        const hash = Math.abs(
          normalized.split('').reduce((acc, char) => (acc << 5) - acc + char.charCodeAt(0), 0)
        );
        assignedCode = `noc24-${hash.toString(36).substring(0, 6)}`;
      }

      if (isSupabaseConfigured() && supabase) {
        const { data: inserted, error: insertError } = await supabase
          .from('courses')
          .insert({
            code: assignedCode,
            name: rawName,
            normalized_name: normalized,
          })
          .select()
          .single();

        if (!insertError && inserted) {
          return inserted;
        }
      }

      const newCourse: Course = {
        id: `crs-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
        code: assignedCode,
        name: rawName,
        normalized_name: normalized,
        created_at: new Date().toISOString(),
      };
      const currentList = localStore.getCourses();
      localStore.saveCourses([...currentList, newCourse]);
      return newCourse;
    })();

    courseCreationLocks.set(lockKey, creationPromise);
    try {
      return await creationPromise;
    } finally {
      courseCreationLocks.delete(lockKey);
    }
  },

  // Student Exams (One exam per student)
  async getStudentExam(studentId: string): Promise<StudentExam | null> {
    if (isSupabaseConfigured() && supabase) {
      const { data, error } = await supabase
        .from('student_exams')
        .select('*, course:courses(*), centre:centres(*)')
        .eq('student_id', studentId)
        .maybeSingle();
      if (error) throw new Error(error.message);
      return data || null;
    }

    const exams = localStore.getExams();
    const existing = exams.find(e => e.student_id === studentId);
    if (!existing) return null;
    const courses = localStore.getCourses();
    const centres = localStore.getCentres();
    return {
      ...existing,
      course: courses.find(c => c.id === existing.course_id),
      centre: centres.find(ctr => ctr.id === existing.centre_id),
    };
  },

  async getStudentExams(studentId: string): Promise<StudentExam[]> {
    const exam = await this.getStudentExam(studentId);
    return exam ? [exam] : [];
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
      try {
        const { data: rpcData, error: rpcError } = await supabase.rpc('sync_student_exam_and_cohort', {
          p_student_id: params.student_id,
          p_course_id: params.course_id,
          p_centre_id: params.centre_id || null,
          p_exam_date: params.exam_date || null,
          p_reporting_time: params.reporting_time || null,
          p_exam_start_time: params.exam_start_time || null,
          p_shift: params.shift || null,
          p_status: params.status,
        });

        if (!rpcError && rpcData?.exam_id) {
          const { data, error } = await supabase
            .from('student_exams')
            .select('*, course:courses(*), centre:centres(*)')
            .eq('id', rpcData.exam_id)
            .single();
          if (!error && data) return data;
        }
      } catch (err) {
        console.warn('RPC sync failed, falling back to direct upsert:', err);
      }

      // Upsert based on unique student_id constraint
      const { data, error } = await supabase
        .from('student_exams')
        .upsert(
          {
            student_id: params.student_id,
            course_id: params.course_id,
            centre_id: params.status === 'CONFIRMED' ? params.centre_id : null,
            exam_date: params.status === 'CONFIRMED' ? params.exam_date : null,
            reporting_time: params.status === 'CONFIRMED' ? params.reporting_time : null,
            exam_start_time: params.status === 'CONFIRMED' ? params.exam_start_time : null,
            shift: params.status === 'CONFIRMED' ? params.shift : null,
            status: params.status,
            updated_at: new Date().toISOString(),
          },
          { onConflict: 'student_id' }
        )
        .select('*, course:courses(*), centre:centres(*)')
        .single();
      if (error) throw new Error(error.message);
      return data;
    }

    const exams = localStore.getExams();
    const existingIdx = exams.findIndex(e => e.student_id === params.student_id);
    let exam: StudentExam;

    if (existingIdx !== -1) {
      exam = {
        ...exams[existingIdx],
        course_id: params.course_id,
        centre_id: params.status === 'CONFIRMED' ? params.centre_id : null,
        exam_date: params.status === 'CONFIRMED' ? params.exam_date : null,
        reporting_time: params.status === 'CONFIRMED' ? params.reporting_time : null,
        exam_start_time: params.status === 'CONFIRMED' ? params.exam_start_time : null,
        shift: params.status === 'CONFIRMED' ? params.shift : null,
        status: params.status,
        updated_at: new Date().toISOString(),
      };
      exams[existingIdx] = exam;
    } else {
      exam = {
        id: params.id || `ex-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
        student_id: params.student_id,
        course_id: params.course_id,
        centre_id: params.status === 'CONFIRMED' ? params.centre_id : null,
        exam_date: params.status === 'CONFIRMED' ? params.exam_date : null,
        reporting_time: params.status === 'CONFIRMED' ? params.reporting_time : null,
        exam_start_time: params.status === 'CONFIRMED' ? params.exam_start_time : null,
        shift: params.status === 'CONFIRMED' ? params.shift : null,
        status: params.status,
        created_at: new Date().toISOString(),
      };
      exams.push(exam);
    }
    localStore.saveExams(exams);

    // Atomic sync with cohort: Always clean up prior cohort memberships for this student
    const members = localStore.getCohortMembers();
    const cleanMembers = members.filter(m => m.student_id !== exam.student_id);

    if (exam.status === 'CONFIRMED' && exam.centre_id && exam.exam_date && exam.reporting_time) {
      const cohorts = localStore.getCohorts();
      let cohort = cohorts.find(
        c => c.centre_id === exam.centre_id &&
             c.exam_date === exam.exam_date &&
             c.reporting_time === exam.reporting_time
      );

      if (!cohort) {
        cohort = {
          id: `coh-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
          centre_id: exam.centre_id,
          exam_date: exam.exam_date,
          reporting_time: exam.reporting_time,
          whatsapp_group_link: null,
          created_at: new Date().toISOString(),
        };
        cohorts.push(cohort);
        localStore.saveCohorts(cohorts);
      }

      // Add student to the matching cohort
      cleanMembers.push({
        id: `cm-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
        cohort_id: cohort.id,
        student_id: exam.student_id,
        exam_id: exam.id,
        joined_at: new Date().toISOString(),
      });
    }

    localStore.saveCohortMembers(cleanMembers);

    return exam;
  },

  async saveStudentExamAtomic(params: {
    student_id: string;
    course_id?: string;
    course_name: string;
    course_code?: string;
    centre_name?: string;
    centre_address?: string;
    city?: string;
    state?: string;
    pincode?: string;
    exam_date?: string | null;
    reporting_time?: string | null;
    exam_start_time?: string | null;
    shift?: 'FN' | 'AN' | null;
    status: 'CONFIRMED' | 'PENDING_DETAILS';
  }): Promise<StudentExam> {
    const courses = await this.getCourses();
    let resolvedCourse: Course | null = null;

    if (params.course_id) {
      resolvedCourse = courses.find(c => c.id === params.course_id) || null;
    }

    if (!resolvedCourse) {
      resolvedCourse = await this.findOrCreateCourse({
        code: params.course_code?.trim() || '',
        name: params.course_name.trim(),
      });
    }

    if (!resolvedCourse) {
      throw new Error('Course not found in the official SRM AP course list. Please check the name or contact SRM DEALINGS.');
    }

    let resolvedCentre: ExamCentre | null = null;
    if (params.status === 'CONFIRMED' && params.centre_name) {
      resolvedCentre = await this.findOrCreateCentre({
        name: params.centre_name,
        address: params.centre_address || '',
        city: params.city || 'Vijayawada',
        state: params.state || 'Andhra Pradesh',
        pincode: params.pincode || '',
        userId: params.student_id,
      });
    }

    if (isSupabaseConfigured() && supabase) {
      try {
        const { data: rpcData, error: rpcError } = await supabase.rpc('save_student_exam_atomic', {
          p_student_id: params.student_id,
          p_course_name: resolvedCourse.name,
          p_course_code: resolvedCourse.code,
          p_centre_name: resolvedCentre ? resolvedCentre.name : '',
          p_centre_address: resolvedCentre ? resolvedCentre.address : '',
          p_city: resolvedCentre ? resolvedCentre.city : 'Vijayawada',
          p_state: resolvedCentre?.state || params.state || 'Andhra Pradesh',
          p_pincode: resolvedCentre?.pincode || params.pincode || '',
          p_exam_date: params.exam_date || null,
          p_reporting_time: params.reporting_time || null,
          p_exam_start_time: params.exam_start_time || null,
          p_shift: params.shift || null,
          p_status: params.status,
        });

        if (!rpcError && rpcData) {
          return rpcData as StudentExam;
        }
        if (rpcError) {
          console.warn('RPC save_student_exam_atomic returned error:', rpcError.message);
        }
      } catch (err) {
        console.warn('RPC save_student_exam_atomic failed, using fallback:', err);
      }
    }

    // Fallback: save using canonical IDs
    return this.saveStudentExam({
      student_id: params.student_id,
      course_id: resolvedCourse.id,
      centre_id: resolvedCentre ? resolvedCentre.id : null,
      exam_date: params.exam_date,
      reporting_time: params.reporting_time,
      exam_start_time: params.exam_start_time,
      shift: params.shift,
      status: params.status,
    });
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

  // Discovery: Cohorts by Centre, Date & Reporting Time (with privacy filtering, caller authorization & pagination)
  async getCohorts(params?: PaginationParams, currentStudentId?: string): Promise<ExamCohort[]> {
    if (isSupabaseConfigured() && supabase) {
      let query = supabase
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

      if (params?.page && params?.pageSize) {
        const from = (params.page - 1) * params.pageSize;
        const to = from + params.pageSize - 1;
        query = query.range(from, to);
      }

      const { data, error } = await query;
      if (error) throw new Error(error.message);
      const rawCohorts = (data || []) as ExamCohort[];

      // Check caller profile & memberships if provided
      let isAdmin = false;
      let isVerified = false;
      const memberCohortIds = new Set<string>();

      if (currentStudentId) {
        const { data: profile } = await supabase
          .from('profiles')
          .select('is_admin, is_verified')
          .eq('id', currentStudentId)
          .maybeSingle();

        isAdmin = profile?.is_admin === true;
        isVerified = profile?.is_verified !== false;

        const { data: callerMemberships } = await supabase
          .from('cohort_members')
          .select('cohort_id')
          .eq('student_id', currentStudentId);

        (callerMemberships || []).forEach(m => memberCohortIds.add(m.cohort_id));
      }

      return rawCohorts.map(coh => {
        const hasLink = Boolean(coh.whatsapp_group_link);
        const isEligible = Boolean(currentStudentId && (isAdmin || (isVerified && memberCohortIds.has(coh.id))));
        const canEdit = isEligible && Boolean(
          !coh.whatsapp_group_link || coh.link_submitted_by === currentStudentId || isAdmin
        );

        return {
          ...coh,
          has_group_link: hasLink,
          is_eligible: isEligible,
          can_edit_link: canEdit,
          whatsapp_group_link: isEligible ? coh.whatsapp_group_link : null,
          organiser_id: coh.organiser_id,
          organiser_claimed_at: coh.organiser_claimed_at,
          organiser_status: coh.organiser_status,
        };
      });
    }

    const cohorts = localStore.getCohorts();
    const centres = localStore.getCentres();
    const members = localStore.getCohortMembers();
    const students = localStore.getStudents();
    const exams = localStore.getExams();
    const courses = localStore.getCourses();

    // Check caller eligibility
    const caller = currentStudentId ? students.find(s => s.id === currentStudentId) : undefined;
    const isCallerAdmin = caller?.is_admin === true;
    const isCallerVerified = caller ? caller.is_verified !== false : true;

    const populated = cohorts.map(coh => {
      const cohMembers = members
        .filter(m => m.cohort_id === coh.id)
        .map(m => {
          const student = students.find(s => s.id === m.student_id) || {
            id: m.student_id,
            full_name: `Student ${m.student_id}`,
            reg_no: m.student_id.toUpperCase(),
            branch: 'CSE',
            academic_year: '3rd Year',
            section: 'A',
            phone_visible: false,
            is_admin: false,
            created_at: new Date().toISOString(),
          };
          const exam = exams.find(e => e.id === m.exam_id);
          const course = exam ? courses.find(c => c.id === exam.course_id) : undefined;
          return {
            ...m,
            student,
            course,
          };
        });

      const isMember = currentStudentId ? members.some(m => m.cohort_id === coh.id && m.student_id === currentStudentId) : false;
      const hasGroupLink = Boolean(coh.whatsapp_group_link);
      const isEligible = Boolean(currentStudentId && (isCallerAdmin || (isCallerVerified && isMember)));
      const canEditLink = isEligible && Boolean(
        !coh.whatsapp_group_link || coh.link_submitted_by === currentStudentId || isCallerAdmin
      );

      return {
        ...coh,
        centre: centres.find(c => c.id === coh.centre_id),
        member_count: cohMembers.length,
        members: cohMembers,
        has_group_link: hasGroupLink,
        is_eligible: isEligible,
        can_edit_link: canEditLink,
        whatsapp_group_link: isEligible ? coh.whatsapp_group_link : null,
        organiser_id: coh.organiser_id,
        organiser_claimed_at: coh.organiser_claimed_at,
        organiser_status: coh.organiser_status,
      };
    });

    if (params?.page && params?.pageSize) {
      const from = (params.page - 1) * params.pageSize;
      return populated.slice(from, from + params.pageSize);
    }

    return populated;
  },

  // WhatsApp Group Link Management for Cohorts
  async updateCohortWhatsAppLink(
    cohortId: string,
    link: string,
    studentId: string
  ): Promise<ExamCohort> {
    const cleanLink = link.trim().replace(/\/+$/, '');
    if (!isValidWhatsAppLink(cleanLink)) {
      throw new Error('Invalid WhatsApp group invite link format. Expected https://chat.whatsapp.com/[code]');
    }

    // Rate Limiting: Max 5 link updates per 10 minutes per student
    rateLimiter.assertRateLimit('cohort_link', studentId, 5, 10 * 60 * 1000, 'cohort link updates');

    if (isSupabaseConfigured() && supabase) {
      // Call atomic RPC if configured, or update via table
      const { data: rpcRes, error: rpcErr } = await supabase.rpc('submit_or_update_cohort_whatsapp_link', {
        p_cohort_id: cohortId,
        p_link: cleanLink,
      });

      if (!rpcErr && rpcRes?.success) {
        const { data } = await supabase
          .from('exam_cohorts')
          .select('*, centre:centres(*)')
          .eq('id', cohortId)
          .single();
        return data;
      }

      const { data, error } = await supabase
        .from('exam_cohorts')
        .update({
          whatsapp_group_link: cleanLink,
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

    const students = localStore.getStudents();
    const student = students.find(s => s.id === studentId);
    const isAdmin = student?.is_admin === true;

    // Check verification if profile is registered in store
    if (student && student.is_verified === false) {
      throw new Error('Only verified students can share WhatsApp group links.');
    }

    // Check cohort membership if student is registered in store
    const members = localStore.getCohortMembers();
    const isMember = members.some(m => m.cohort_id === cohortId && m.student_id === studentId);
    if (student && !isMember && !isAdmin) {
      throw new Error('You must be taking your exam in this cohort to share or update its WhatsApp group link.');
    }

    // Check authorship: Only the author or an admin can edit or replace an existing link
    const existing = cohorts[idx];
    if (
      existing.whatsapp_group_link &&
      existing.link_submitted_by &&
      existing.link_submitted_by !== studentId &&
      !isAdmin
    ) {
      throw new Error(
        'This group link was shared by a peer. Only the author or an administrator can edit or replace it. If this link is broken, expired, or invalid, please report it.'
      );
    }

    cohorts[idx] = {
      ...cohorts[idx],
      whatsapp_group_link: cleanLink,
      link_submitted_by: studentId,
      link_updated_at: new Date().toISOString(),
      organiser_id: cohorts[idx].organiser_id || studentId,
      organiser_status: 'COMPLETED',
    };
    localStore.saveCohorts(cohorts);
    return cohorts[idx];
  },

  // Claim cohort organiser role
  async claimCohortOrganiser(
    cohortId: string,
    studentId: string
  ): Promise<{ success: boolean; cohort_id: string; organiser_id: string; organiser_status: string }> {
    if (isSupabaseConfigured() && supabase) {
      const { data, error } = await supabase.rpc('claim_cohort_organiser', {
        p_cohort_id: cohortId,
        p_student_id: studentId,
      });
      if (error) throw new Error(error.message);
      return data;
    }

    const cohorts = localStore.getCohorts();
    const cohort = cohorts.find(c => c.id === cohortId);
    if (!cohort) throw new Error('Cohort not found');

    if (cohort.whatsapp_group_link) {
      throw new Error('A WhatsApp group link already exists for this cohort');
    }

    if (cohort.organiser_id && cohort.organiser_id !== studentId && cohort.organiser_status === 'CLAIMED') {
      throw new Error('Another student has already volunteered to create this group');
    }

    const members = localStore.getCohortMembers();
    const isMember = members.some(m => m.cohort_id === cohortId && m.student_id === studentId);
    if (!isMember) {
      throw new Error('You must be taking your exam in this cohort to organise the group');
    }

    cohort.organiser_id = studentId;
    cohort.organiser_claimed_at = new Date().toISOString();
    cohort.organiser_status = 'CLAIMED';
    localStore.saveCohorts(cohorts);

    return {
      success: true,
      cohort_id: cohortId,
      organiser_id: studentId,
      organiser_status: 'CLAIMED',
    };
  },

  // Release / Cancel cohort organiser role
  async releaseCohortOrganiser(cohortId: string, studentId: string): Promise<void> {
    if (isSupabaseConfigured() && supabase) {
      const { error } = await supabase.rpc('release_cohort_organiser', {
        p_cohort_id: cohortId,
        p_student_id: studentId,
      });
      if (error) throw new Error(error.message);
      return;
    }

    const cohorts = localStore.getCohorts();
    const cohort = cohorts.find(c => c.id === cohortId);
    if (cohort && (cohort.organiser_id === studentId || !cohort.organiser_id)) {
      cohort.organiser_id = undefined;
      cohort.organiser_claimed_at = undefined;
      cohort.organiser_status = 'NONE';
      localStore.saveCohorts(cohorts);
    }
  },

  // Discovery: Same MOOC Course (Ignores centre, date, and reporting time)
  async getStudentsByCourse(
    courseId: string,
    params?: PaginationParams,
    currentStudentId?: string
  ): Promise<CourseBuddiesResult> {
    const page = params?.page && params.page > 0 ? params.page : 1;
    const pageSize = params?.pageSize && params.pageSize > 0 ? params.pageSize : 20;

    if (isSupabaseConfigured() && supabase) {
      const { data: course } = await supabase
        .from('courses')
        .select('*')
        .eq('id', courseId)
        .single();

      // Exact count for pagination
      const { count: totalCount } = await supabase
        .from('student_exams')
        .select('*', { count: 'exact', head: true })
        .eq('course_id', courseId);

      const from = (page - 1) * pageSize;
      const to = from + pageSize - 1;

      const { data: exams } = await supabase
        .from('student_exams')
        .select('*, profile:profiles(*), centre:centres(*)')
        .eq('course_id', courseId)
        .order('created_at', { ascending: false })
        .range(from, to);

      const { data: link } = await supabase
        .from('course_group_links')
        .select('*, submitter:profiles(*)')
        .eq('course_id', courseId)
        .eq('is_active', true)
        .maybeSingle();

      // Authorization check for course study group link
      let isEligible = false;
      let isAdmin = false;
      if (currentStudentId) {
        const { data: profile } = await supabase
          .from('profiles')
          .select('is_admin, is_verified')
          .eq('id', currentStudentId)
          .maybeSingle();

        isAdmin = profile?.is_admin === true;
        const isVerified = profile?.is_verified !== false;

        const { data: enrolledExam } = await supabase
          .from('student_exams')
          .select('id')
          .eq('course_id', courseId)
          .eq('student_id', currentStudentId)
          .maybeSingle();

        isEligible = isAdmin || (isVerified && Boolean(enrolledExam));
      }

      const hasGroupLink = Boolean(link);
      const canEditLink = isEligible && Boolean(
        !link || link.submitted_by === currentStudentId || isAdmin
      );

      const total = totalCount || 0;
      const totalPages = Math.max(1, Math.ceil(total / pageSize));

      return {
        course: course || null,
        students: (exams || []).map(e => ({
          profile: e.profile,
          exam: e,
          centre: e.centre,
        })),
        groupLink: isEligible ? (link || null) : null,
        hasGroupLink,
        isEligible,
        canEditLink,
        organiser_id: course?.organiser_id,
        organiser_status: course?.organiser_status,
        total,
        page,
        pageSize,
        totalPages,
        hasMore: page < totalPages,
      };
    }

    const courses = localStore.getCourses();
    const course = courses.find(c => c.id === courseId) || null;
    const exams = localStore.getExams().filter(e => e.course_id === courseId);
    const students = localStore.getStudents();
    const centres = localStore.getCentres();
    const courseLinks = localStore.getCourseLinks();
    const rawActiveLink = courseLinks.find(cl => cl.course_id === courseId && cl.is_active) || null;

    // Caller authorization check
    const caller = currentStudentId ? students.find(s => s.id === currentStudentId) : undefined;
    const isCallerAdmin = caller?.is_admin === true;
    const isCallerVerified = caller ? caller.is_verified !== false : true;
    const isCallerEnrolled = currentStudentId
      ? localStore.getExams().some(e => e.student_id === currentStudentId && e.course_id === courseId)
      : false;

    const isEligible = Boolean(currentStudentId && (isCallerAdmin || (isCallerVerified && isCallerEnrolled)));
    const hasGroupLink = Boolean(rawActiveLink);
    const canEditLink = isEligible && Boolean(
      !rawActiveLink || rawActiveLink.submitted_by === currentStudentId || isCallerAdmin
    );
    const groupLink = isEligible ? rawActiveLink : null;

    const allMatched = exams
      .map(exam => {
        const profile = students.find(s => s.id === exam.student_id) || {
          id: exam.student_id,
          full_name: `Student ${exam.student_id}`,
          reg_no: exam.student_id.toUpperCase(),
          branch: 'CSE',
          academic_year: '3rd Year',
          section: 'A',
          phone_visible: false,
          is_admin: false,
          created_at: new Date().toISOString(),
        };
        const centre = centres.find(c => c.id === exam.centre_id);
        return {
          profile,
          exam,
          centre,
        };
      });

    const total = allMatched.length;
    const totalPages = Math.max(1, Math.ceil(total / pageSize));
    const paginated = allMatched.slice((page - 1) * pageSize, page * pageSize);

    return {
      course,
      students: paginated,
      groupLink,
      hasGroupLink,
      isEligible,
      canEditLink,
      organiser_id: course?.organiser_id,
      organiser_status: course?.organiser_status,
      total,
      page,
      pageSize,
      totalPages,
      hasMore: page < totalPages,
    };
  },

  // WhatsApp Link Management for Courses
  async updateCourseWhatsAppLink(
    courseId: string,
    link: string,
    studentId: string
  ): Promise<CourseGroupLink> {
    const cleanLink = link.trim().replace(/\/+$/, '');
    if (!isValidWhatsAppLink(cleanLink)) {
      throw new Error('Invalid WhatsApp group invite link format. Expected https://chat.whatsapp.com/[code]');
    }

    // Rate Limiting: Max 5 updates per 10 minutes per student
    rateLimiter.assertRateLimit('course_link', studentId, 5, 10 * 60 * 1000, 'course link updates');

    if (isSupabaseConfigured() && supabase) {
      const { data: rpcRes, error: rpcErr } = await supabase.rpc('submit_or_update_course_whatsapp_link', {
        p_course_id: courseId,
        p_link: cleanLink,
      });

      if (!rpcErr && rpcRes?.success) {
        const { data } = await supabase
          .from('course_group_links')
          .select('*, submitter:profiles(*)')
          .eq('id', rpcRes.link_id)
          .single();
        return data;
      }

      // Deactivate prior links
      await supabase
        .from('course_group_links')
        .update({ is_active: false })
        .eq('course_id', courseId);

      const { data, error } = await supabase
        .from('course_group_links')
        .insert([{
          course_id: courseId,
          whatsapp_group_link: cleanLink,
          submitted_by: studentId,
          is_active: true,
        }])
        .select()
        .single();
      if (error) throw new Error(error.message);
      return data;
    }

    const students = localStore.getStudents();
    const student = students.find(s => s.id === studentId);
    const isAdmin = student?.is_admin === true;

    // Check verification if registered in store
    if (student && student.is_verified === false) {
      throw new Error('Only verified students can share WhatsApp group links.');
    }

    // Check enrollment if registered in store
    const exams = localStore.getExams();
    const isEnrolled = exams.some(e => e.student_id === studentId && e.course_id === courseId);
    if (student && !isEnrolled && !isAdmin) {
      throw new Error('You must be enrolled in this course to share or update its WhatsApp study group.');
    }

    // Check authorship: Only author or admin can edit/replace an active link
    const links = localStore.getCourseLinks();
    const activeLink = links.find(l => l.course_id === courseId && l.is_active);
    if (activeLink && activeLink.submitted_by !== studentId && !isAdmin) {
      throw new Error(
        'An active study group link has already been shared by another student. Only the link author or an administrator can edit or replace it. If this link is broken or inappropriate, please use the Report button.'
      );
    }

    // Deactivate previous active links for this course
    links.forEach(l => {
      if (l.course_id === courseId) l.is_active = false;
    });

    const newLink: CourseGroupLink = {
      id: `cgl-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
      course_id: courseId,
      whatsapp_group_link: cleanLink,
      submitted_by: studentId,
      is_active: true,
      created_at: new Date().toISOString(),
    };
    links.push(newLink);
    localStore.saveCourseLinks(links);

    const courses = localStore.getCourses();
    const crs = courses.find(c => c.id === courseId);
    if (crs) {
      crs.organiser_id = crs.organiser_id || studentId;
      crs.organiser_status = 'COMPLETED';
      localStore.saveCourses(courses);
    }

    return newLink;
  },

  // Claim course organiser role
  async claimCourseOrganiser(
    courseId: string,
    studentId: string
  ): Promise<{ success: boolean; course_id: string; organiser_id: string; organiser_status: string }> {
    if (isSupabaseConfigured() && supabase) {
      const { data, error } = await supabase.rpc('claim_course_organiser', {
        p_course_id: courseId,
        p_student_id: studentId,
      });
      if (error) throw new Error(error.message);
      return data;
    }

    const courses = localStore.getCourses();
    const course = courses.find(c => c.id === courseId);
    if (!course) throw new Error('Course not found');

    const courseLinks = localStore.getCourseLinks();
    if (courseLinks.some(l => l.course_id === courseId && l.is_active)) {
      throw new Error('A WhatsApp group link already exists for this course');
    }

    if (course.organiser_id && course.organiser_id !== studentId && course.organiser_status === 'CLAIMED') {
      throw new Error('Another student has already volunteered to create this group');
    }

    const exams = localStore.getExams();
    const isEnrolled = exams.some(e => e.student_id === studentId && e.course_id === courseId);
    const students = localStore.getStudents();
    const student = students.find(s => s.id === studentId);
    const isAdmin = student?.is_admin === true;

    if (!isEnrolled && !isAdmin) {
      throw new Error('You must be enrolled in this course to organise the group');
    }

    course.organiser_id = studentId;
    course.organiser_claimed_at = new Date().toISOString();
    course.organiser_status = 'CLAIMED';
    localStore.saveCourses(courses);

    return {
      success: true,
      course_id: courseId,
      organiser_id: studentId,
      organiser_status: 'CLAIMED',
    };
  },

  // Release / Cancel course organiser role
  async releaseCourseOrganiser(courseId: string, studentId: string): Promise<void> {
    if (isSupabaseConfigured() && supabase) {
      const { error } = await supabase.rpc('release_course_organiser', {
        p_course_id: courseId,
        p_student_id: studentId,
      });
      if (error) throw new Error(error.message);
      return;
    }

    const courses = localStore.getCourses();
    const course = courses.find(c => c.id === courseId);
    if (course && (course.organiser_id === studentId || !course.organiser_id)) {
      course.organiser_id = undefined;
      course.organiser_claimed_at = undefined;
      course.organiser_status = 'NONE';
      localStore.saveCourses(courses);
    }
  },

  // Remove / Clear WhatsApp link for cohort (Author or Admin only)
  async removeCohortWhatsAppLink(cohortId: string, studentId: string): Promise<void> {
    const cohorts = localStore.getCohorts();
    const coh = cohorts.find(c => c.id === cohortId);
    if (!coh) throw new Error('Cohort not found');

    const students = localStore.getStudents();
    const student = students.find(s => s.id === studentId);
    const isAdmin = student?.is_admin === true;

    if (coh.link_submitted_by !== studentId && !isAdmin) {
      throw new Error('Only the author or an administrator can remove this link.');
    }

    coh.whatsapp_group_link = null;
    coh.link_submitted_by = null;
    coh.link_updated_at = new Date().toISOString();
    localStore.saveCohorts(cohorts);

    if (isSupabaseConfigured() && supabase) {
      await supabase.from('exam_cohorts').update({
        whatsapp_group_link: null,
        link_submitted_by: null,
        link_updated_at: new Date().toISOString(),
      }).eq('id', cohortId);
    }
  },

  // Deactivate Course WhatsApp link (Author or Admin only)
  async removeCourseWhatsAppLink(courseId: string, studentId: string): Promise<void> {
    const links = localStore.getCourseLinks();
    const activeLink = links.find(l => l.course_id === courseId && l.is_active);
    if (!activeLink) return;

    const students = localStore.getStudents();
    const student = students.find(s => s.id === studentId);
    const isAdmin = student?.is_admin === true;

    if (activeLink.submitted_by !== studentId && !isAdmin) {
      throw new Error('Only the author or an administrator can remove this link.');
    }

    activeLink.is_active = false;
    localStore.saveCourseLinks(links);

    if (isSupabaseConfigured() && supabase) {
      await supabase.from('course_group_links').update({ is_active: false }).eq('id', activeLink.id);
    }
  },

  // Moderation & Reporting with rate limiting and duplicate prevention
  async reportLink(params: {
    link_type: 'COHORT' | 'COURSE';
    target_id: string;
    whatsapp_link: string;
    reported_by: string;
    reason: 'SPAM' | 'EXPIRED' | 'INAPPROPRIATE' | 'WRONG_GROUP';
    details?: string;
  }): Promise<LinkReport> {
    // Rate Limiting: Max 3 reports per 10 minutes per student
    rateLimiter.assertRateLimit('report', params.reported_by, 3, 10 * 60 * 1000, 'report submissions');

    if (isSupabaseConfigured() && supabase) {
      const { data: rpcRes, error: rpcErr } = await supabase.rpc('report_whatsapp_link', {
        p_link_type: params.link_type,
        p_target_id: params.target_id,
        p_whatsapp_link: params.whatsapp_link,
        p_reason: params.reason,
        p_details: params.details || '',
      });

      if (!rpcErr && rpcRes?.success) {
        const { data } = await supabase
          .from('reports')
          .select('*')
          .eq('id', rpcRes.report_id)
          .single();
        return data;
      }

      const { data, error } = await supabase
        .from('reports')
        .insert([params])
        .select()
        .single();
      if (error) throw new Error(error.message);
      return data;
    }

    const reports = localStore.getReports();

    // Check duplicate pending report by same student
    const existingPending = reports.find(
      r => r.reported_by === params.reported_by &&
           r.target_id === params.target_id &&
           r.status === 'PENDING'
    );
    if (existingPending) {
      throw new Error('You have already submitted a pending report for this group link. Community moderators will review it shortly.');
    }

    const newReport: LinkReport = {
      id: `rep-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
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
        .from('reports')
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
        .from('reports')
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

  // Account Recovery
  async requestPasswordReset(reg_no: string): Promise<{ success: boolean; message?: string; error?: string; email?: string }> {
    const normalizedReg = normalizeRegNo(reg_no);
    if (!normalizedReg) {
      return { success: false, error: 'Please enter your registration number.' };
    }

    const email = `${normalizedReg.toLowerCase()}@srmap.edu.in`;

    if (isSupabaseConfigured() && supabase) {
      const { data: profile } = await supabase
        .from('profiles')
        .select('id, reg_no')
        .eq('reg_no', normalizedReg)
        .maybeSingle();

      if (!profile) {
        return { success: false, error: 'Student registration number not found.' };
      }

      return {
        success: true,
        email,
        message: `Account verified for ${normalizedReg}. Enter your new PIN/password to complete reset.`,
      };
    }

    const students = localStore.getStudents();
    const student = students.find(s => normalizeRegNo(s.reg_no) === normalizedReg);
    if (!student) {
      return { success: false, error: 'Student registration number not found.' };
    }
    return {
      success: true,
      email,
      message: `Account verified for ${normalizedReg}. Enter your new PIN/password to complete reset.`,
    };
  },

  async updatePassword(newPassword: string, regNo?: string): Promise<{ success: boolean; error?: string }> {
    if (newPassword.length < 4) {
      return { success: false, error: 'Password or PIN must be at least 4 characters.' };
    }
    const current = localStore.getCurrentUser();
    const targetReg = regNo || current?.reg_no;
    if (!targetReg) {
      return { success: false, error: 'Registration number required to update password.' };
    }

    if (isSupabaseConfigured() && supabase) {
      const { error } = await supabase.rpc('reset_student_password', {
        p_reg_no: targetReg,
        p_new_password: newPassword,
      });
      if (error) return { success: false, error: error.message };
      return { success: true };
    }

    const creds = localStore.getCredentials();
    creds[normalizeRegNo(targetReg)] = newPassword;
    localStore.saveCredentials(creds);
    return { success: true };
  },
};
