import { describe, it, expect, beforeEach } from 'vitest';
import { dataService, isValidWhatsAppLink, localStore } from '../services/dataService';
import { rateLimiter } from '../services/rateLimiter';
import {
  resolveCanonicalCourseMatch,
  calculateCourseMatch,
  normalizeCourseText,
  normalizeCourseCode,
  areCourseCodesConflicting
} from '../services/courseMatcher';
import {
  resolveCanonicalCentreMatch,
  calculateCentreMatch,
  normalizeCentreText,
  normalizeCity
} from '../services/centreMatcher';
import { Course, ExamCentre } from '../types';

// In-memory localStorage mock for node test runner
const storageMap = new Map<string, string>();
const localStorageMock = {
  getItem: (key: string) => storageMap.get(key) || null,
  setItem: (key: string, value: string) => storageMap.set(key, value),
  removeItem: (key: string) => storageMap.delete(key),
  clear: () => storageMap.clear(),
};
// @ts-ignore
globalThis.localStorage = localStorageMock;

describe('MoocDeal — Intelligent Course & Centre Matching & Deduplication (All 10 Scenarios)', () => {
  beforeEach(() => {
    localStorageMock.clear();
    localStore.resetToDefaults();
  });

  // Scenario 1: Hall-ticket user and manual user select the same course
  it('Scenario 1: Hall-ticket user and manual user resolve to the same canonical course ID', async () => {
    // Verified course in catalogue: Human Physiology (BT79)
    const canonicalCourse = await dataService.findOrCreateCourse({
      name: 'Human Physiology',
      code: 'bt79',
    });

    // Path A: Hall ticket extracted details
    const hallTicketExam = await dataService.saveStudentExamAtomic({
      student_id: 'std-karthik',
      course_name: 'Human Physiology',
      course_code: 'bt79',
      centre_name: 'iON Digital Zone iDZ Patamata',
      centre_address: 'Near Benz Circle, High School Road, Patamata',
      city: 'Vijayawada',
      exam_date: '2026-10-25',
      reporting_time: '07:30',
      shift: 'FN',
      status: 'CONFIRMED',
    });

    // Path B: Manual user enters lowercase and extra whitespace without code
    const manualExam = await dataService.saveStudentExamAtomic({
      student_id: 'std-ananya',
      course_name: '  human physiology   ',
      status: 'PENDING_DETAILS',
    });

    // Both registrations must reference the exact same canonical course ID
    expect(hallTicketExam.course_id).toBe(canonicalCourse.id);
    expect(manualExam.course_id).toBe(canonicalCourse.id);

    // Verify catalogue did not create a duplicate course
    const allCourses = await dataService.getCourses();
    const physCourses = allCourses.filter(c => c.normalized_name === 'human physiology');
    expect(physCourses.length).toBe(1);
    expect(physCourses[0].id).toBe(canonicalCourse.id);
  });

  // Scenario 2: A manual user misspells the course name
  it('Scenario 2: Manual user misspells course name ("Human Physilogy") and resolves to canonical course with one-tap suggestion', async () => {
    const canonical = await dataService.findOrCreateCourse({
      name: 'Human Physiology',
      code: 'bt79',
    });

    const courses = await dataService.getCourses();

    // 1. Check shared courseMatcher resolution
    const resolution = resolveCanonicalCourseMatch(
      { title: 'Human Physilogy' }, // missing 'o'
      courses
    );

    expect(resolution.status).toBe('HIGH_CONFIDENCE');
    expect(resolution.matchedCourse).toBeDefined();
    expect(resolution.matchedCourse?.id).toBe(canonical.id);
    expect(resolution.suggestion).toBeDefined();
    expect(resolution.suggestion?.text).toBe(`Did you mean ${canonical.name} (${canonical.code})?`);

    // 2. When saved via shared service, reuses canonical course
    const savedExam = await dataService.saveStudentExamAtomic({
      student_id: 'std-rahul',
      course_name: 'Human Physilogy',
      status: 'PENDING_DETAILS',
    });

    expect(savedExam.course_id).toBe(canonical.id);
  });

  // Scenario 3: A manual user omits part of a course title
  it('Scenario 3: Manual user omits words ("Machine Learning" vs "Introduction to Machine Learning") -> flags as ambiguous candidate requiring confirmation', async () => {
    const canonical = await dataService.findOrCreateCourse({
      name: 'Introduction to Machine Learning',
      code: 'noc24-cs106',
    });

    const courses = await dataService.getCourses();

    // Matching query: "Machine Learning" (omits "Introduction to")
    const resolution = resolveCanonicalCourseMatch(
      { title: 'Machine Learning' },
      courses
    );

    // Must NOT silently merge as an exact or strong match!
    expect(resolution.status).toBe('AMBIGUOUS');
    expect(resolution.matchedCourse).toBeNull(); // Requires explicit confirmation
    expect(resolution.suggestion).toBeDefined();
    expect(resolution.suggestion?.course.name).toBe(canonical.name);
    expect(resolution.candidates.length).toBeGreaterThan(0);
    expect(resolution.candidates[0].isStrongMatch).toBe(false);
  });

  // Scenario 4: Two centre addresses differ only in punctuation
  it('Scenario 4: Two centre addresses differing only in punctuation resolve to the exact same canonical centre', async () => {
    // Centre 1: Standard punctuation
    const centre1 = await dataService.findOrCreateCentre({
      name: 'iON Digital Zone iDZ Kanuru Village',
      address: 'D No. 7-777, Vyjayanthi Bhavan, 100 Feet Road, Kanuru Village',
      city: 'Vijayawada',
    });

    // Centre 2: Different harmless punctuation (commas, slashes, hyphens)
    const centre2 = await dataService.findOrCreateCentre({
      name: 'ION Digital Zone, iDZ Kanuru Village',
      address: 'D No. 7/777, Vyjayanthi Bhavan, 100 Feet Road - Kanuru Village',
      city: 'Vijayawada',
    });

    // Punctuation differences must resolve to the identical canonical centre ID
    expect(centre1.id).toBe(centre2.id);
    expect(centre2.name).toBe('iON Digital Zone iDZ Kanuru Village');

    // Verify centres list does not contain duplicate
    const allCentres = await dataService.getCentres();
    const kanuruCentres = allCentres.filter(c => c.normalized_name.includes('kanuru'));
    expect(kanuruCentres.length).toBe(1);
  });

  // Scenario 5: Two centres have similar names but different physical addresses
  it('Scenario 5: Two centres with similar names but different physical localities ("Patamata" vs "Kanuru") are NEVER merged', async () => {
    const centrePatamata = await dataService.findOrCreateCentre({
      name: 'iON Digital Zone iDZ Patamata',
      address: 'Near Benz Circle, High School Road, Patamata',
      city: 'Vijayawada',
    });

    const centreKanuru = await dataService.findOrCreateCentre({
      name: 'iON Digital Zone iDZ Kanuru Village',
      address: '100 Feet Road, Kanuru Village',
      city: 'Vijayawada',
    });

    // Must be two distinct canonical records
    expect(centrePatamata.id).not.toBe(centreKanuru.id);
    expect(centrePatamata.normalized_name).not.toBe(centreKanuru.normalized_name);

    // Matching check: calculateCentreMatch between them must have isStrongMatch = false
    const match = calculateCentreMatch(
      { name: centrePatamata.name, address: centrePatamata.address, city: 'Vijayawada' },
      centreKanuru
    );
    expect(match.isStrongMatch).toBe(false);
    expect(match.score).toBeLessThan(0.60);
  });

  // Scenario 6: Two students submit the same new course simultaneously
  it('Scenario 6: Simultaneous course submissions create exactly 1 canonical course record with no race collisions', async () => {
    const newCourseTitle = 'Quantum Computation and Information';
    const newCourseCode = 'noc24-ph99';

    // Simulate 4 concurrent registrations for this new course
    const results = await Promise.all([
      dataService.findOrCreateCourse({ name: newCourseTitle, code: newCourseCode }),
      dataService.findOrCreateCourse({ name: newCourseTitle, code: newCourseCode }),
      dataService.findOrCreateCourse({ name: newCourseTitle, code: newCourseCode }),
      dataService.findOrCreateCourse({ name: newCourseTitle, code: newCourseCode }),
    ]);

    // All must receive the exact same course ID
    const firstId = results[0].id;
    for (const res of results) {
      expect(res.id).toBe(firstId);
    }

    // Database / Store must have exactly one record for this course
    const courses = await dataService.getCourses();
    const matches = courses.filter(c => c.name === newCourseTitle);
    expect(matches.length).toBe(1);
  });

  // Scenario 7: A provisional manual entry is later verified by hall ticket
  it('Scenario 7: Provisional manual entry is later verified by hall ticket, updating status to CONFIRMED without creating duplicate registrations', async () => {
    const studentId = 'std-karthik';

    // Step 1: Student registers provisional course-only exam
    const provisional = await dataService.saveStudentExamAtomic({
      student_id: studentId,
      course_name: 'Human Physiology',
      course_code: 'bt79',
      status: 'PENDING_DETAILS',
    });

    expect(provisional.status).toBe('PENDING_DETAILS');
    expect(provisional.centre_id).toBeNull();

    // Step 2: Student later uploads hall ticket with confirmed venue & slot
    const confirmed = await dataService.saveStudentExamAtomic({
      student_id: studentId,
      course_name: 'Human Physiology',
      course_code: 'bt79',
      centre_name: 'iON Digital Zone iDZ Patamata',
      centre_address: 'Near Benz Circle, High School Road, Patamata',
      city: 'Vijayawada',
      exam_date: '2026-10-25',
      reporting_time: '07:30',
      shift: 'FN',
      status: 'CONFIRMED',
    });

    expect(confirmed.status).toBe('CONFIRMED');
    expect(confirmed.centre_id).toBeDefined();
    expect(confirmed.centre_id).not.toBeNull();

    // Step 3: Check student exams list: exactly ONE exam record exists for this student
    const exams = await dataService.getStudentExams(studentId);
    expect(exams.length).toBe(1);
    expect(exams[0].status).toBe('CONFIRMED');
    expect(exams[0].course_id).toBe(provisional.course_id);
  });

  // Scenario 8: Two courses have similar names but different official codes
  it('Scenario 8: Two courses with similar names but conflicting official codes (cs101 vs cs102) are NEVER merged', () => {
    const course1: Course = {
      id: 'crs-dl-adv',
      code: 'noc24-cs101',
      name: 'Deep Learning',
      normalized_name: 'deep learning',
      created_at: new Date().toISOString(),
    };

    // User provides conflicting code: cs102
    const match = calculateCourseMatch(
      { title: 'Deep Learning', code: 'noc24-cs102' },
      course1
    );

    // Code conflict must prevent strong match
    expect(match.confidence).toBe('CODE_CONFLICT');
    expect(match.isStrongMatch).toBe(false);
    expect(match.score).toBeLessThan(0.50);

    const resolution = resolveCanonicalCourseMatch(
      { title: 'Deep Learning', code: 'noc24-cs102' },
      [course1]
    );

    expect(resolution.status).toBe('CODE_CONFLICT');
    expect(resolution.matchedCourse).toBeNull();
  });

  // Scenario 9: Correct course and centre WhatsApp cohorts are reused
  it('Scenario 9: Correct course and centre WhatsApp cohorts are reused across distinct students', async () => {
    // Two students register for the same course and same venue slot
    const exam1 = await dataService.saveStudentExamAtomic({
      student_id: 'std-karthik',
      course_name: 'Human Physiology',
      course_code: 'bt79',
      centre_name: 'iON Digital Zone iDZ Patamata',
      centre_address: 'Near Benz Circle, High School Road, Patamata',
      city: 'Vijayawada',
      exam_date: '2026-10-25',
      reporting_time: '07:30',
      shift: 'FN',
      status: 'CONFIRMED',
    });

    const exam2 = await dataService.saveStudentExamAtomic({
      student_id: 'std-ananya',
      course_name: 'human physiology', // different casing
      course_code: 'bt79',
      centre_name: 'ION Digital Zone, iDZ Patamata', // different punctuation
      centre_address: 'Near Benz Circle, High School Road, Patamata',
      city: 'Vijayawada',
      exam_date: '2026-10-25',
      reporting_time: '07:30',
      shift: 'FN',
      status: 'CONFIRMED',
    });

    // 1. Course canonical reuse
    expect(exam1.course_id).toBe(exam2.course_id);

    // 2. Centre canonical reuse
    expect(exam1.centre_id).toBe(exam2.centre_id);

    // 3. Both belong to the same Exam Cohort (centre + date + reporting_time)
    const cohorts = await dataService.getCohorts();
    const sharedCohort = cohorts.find(
      c => c.centre_id === exam1.centre_id && c.exam_date === '2026-10-25' && c.reporting_time === '07:30'
    );

    expect(sharedCohort).toBeDefined();
    const memberStudentIds = sharedCohort?.members?.map(m => m.student_id);
    expect(memberStudentIds).toContain('std-karthik');
    expect(memberStudentIds).toContain('std-ananya');

    // 4. Course-learning group link reuse:
    // When std-karthik adds a study group link for this course, std-ananya sees the same canonical group link
    const validCourseLink = 'https://chat.whatsapp.com/DL101SRMAPNptelStudy24';
    await dataService.updateCourseWhatsAppLink(exam1.course_id, validCourseLink, 'std-karthik');

    const student1View = await dataService.getStudentsByCourse(exam1.course_id, undefined, 'std-karthik');
    const student2View = await dataService.getStudentsByCourse(exam2.course_id, undefined, 'std-ananya');

    expect(student1View.groupLink?.whatsapp_group_link).toBe(validCourseLink);
    expect(student2View.groupLink?.whatsapp_group_link).toBe(validCourseLink);

    // 5. Centre-cohort group link reuse:
    const validCohortLink = 'https://chat.whatsapp.com/CohortSecretLink12345';
    // Clear prior default link on this cohort in localStore so std-karthik can establish the official link
    const allCohorts = localStore.getCohorts();
    const cIdx = allCohorts.findIndex(c => c.id === sharedCohort!.id);
    if (cIdx !== -1) {
      allCohorts[cIdx].whatsapp_group_link = null;
      allCohorts[cIdx].link_submitted_by = null;
      localStore.saveCohorts(allCohorts);
    }

    await dataService.updateCohortWhatsAppLink(sharedCohort!.id, validCohortLink, 'std-karthik');

    const member2Cohorts = await dataService.getCohorts(undefined, 'std-ananya');
    const student2Cohort = member2Cohorts.find(c => c.id === sharedCohort!.id);
    expect(student2Cohort?.whatsapp_group_link).toBe(validCohortLink);
  });

  // Scenario 10: Database RLS rejects unauthorized operations
  it('Scenario 10: Unauthorized student cannot manipulate another student profile or unapproved links', async () => {
    // Malicious link format rejection
    expect(isValidWhatsAppLink('https://malicious-phishing.com/group')).toBe(false);
    expect(isValidWhatsAppLink('http://chat.whatsapp.com/short')).toBe(false);
    expect(isValidWhatsAppLink('https://chat.whatsapp.com/DL101SRMAPNptelStudy24')).toBe(true);

    // Rate limiting: multiple rapid links from same student trigger rate limit
    const submitter = 'std-attacker';
    rateLimiter.reset();
    expect(() => {
      for (let i = 0; i < 7; i++) {
        rateLimiter.assertRateLimit('cohort_link', submitter, 5, 60000);
      }
    }).toThrow(/Rate limit reached/);

    // Authorization check: student cannot update link for cohort they do not belong to
    const cohorts = await dataService.getCohorts();
    const cohort = cohorts[0];
    const nonMemberId = 'std-different-intruder';
    const validLink = 'https://chat.whatsapp.com/ValidCohortToken12345';

    await expect(
      dataService.updateCohortWhatsAppLink(cohort.id, validLink, nonMemberId)
    ).rejects.toThrow(/shared by a peer|taking your exam in this cohort/);
  });
});
