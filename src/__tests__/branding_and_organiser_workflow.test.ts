import { describe, it, expect, beforeEach } from 'vitest';
import { dataService, isValidWhatsAppLink } from '../services/dataService';
import {
  searchAndRankCourses,
  findDuplicateCourseWarning,
  calculateCourseMatch
} from '../services/courseMatcher';
import { StudentProfile, Course } from '../types';

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

describe('MoocDeal — Course Deduplication, Branding & Organiser Workflow Tests', () => {
  beforeEach(() => {
    localStorageMock.clear();
  });

  // A. Course autocomplete & duplicate prevention
  describe('A. Course Autocomplete & Duplicate Prevention', () => {
    it('finds courses with case differences, punctuation and typos', async () => {
      const courses = await dataService.getCourses();

      // Typo search: "Cloud Computng"
      const results1 = searchAndRankCourses('Cloud Computng', courses);
      expect(results1.length).toBeGreaterThan(0);
      expect(results1[0].course.name).toBe('Cloud Computing');
      expect(results1[0].isStrongMatch).toBe(true);

      // Punctuation & spaces: "Deep - Learning  "
      const results2 = searchAndRankCourses('Deep - Learning  ', courses);
      expect(results2.length).toBeGreaterThan(0);
      expect(results2[0].course.name).toBe('Deep Learning');

      // Course code search: "cs101"
      const results3 = searchAndRankCourses('cs101', courses);
      expect(results3.length).toBeGreaterThan(0);
      expect(results3[0].course.code).toBe('noc24-cs101');
    });

    it('warns about duplicate course creation when strong match exists', async () => {
      const courses = await dataService.getCourses();
      const warning = findDuplicateCourseWarning('deep learning', courses);
      expect(warning).not.toBeNull();
      expect(warning?.course.name).toBe('Deep Learning');
      expect(warning?.isStrongMatch).toBe(true);
    });

    it('creates new canonical course when truly unique', async () => {
      const course = await dataService.findOrCreateCourse({
        code: 'noc24-ai999',
        name: 'Quantum Machine Learning',
      });
      expect(course.name).toBe('Quantum Machine Learning');

      // Reusing same title returns identical course ID
      const secondLookup = await dataService.findOrCreateCourse({
        code: 'noc24-ai999',
        name: 'quantum machine learning',
      });
      expect(secondLookup.id).toBe(course.id);
    });
  });

  // Hall ticket verification later
  describe('Hall-Ticket Verification Later & Single Exam Enforcement', () => {
    it('allows student to start with pending course and verify exam later', async () => {
      const studentId = 'std-verify-1';
      const initialCourse = await dataService.findOrCreateCourse({
        code: 'noc24-cs102',
        name: 'Cloud Computing',
      });

      // 1. Initial join without hall ticket (status = PENDING_DETAILS)
      await dataService.saveStudentExam({
        student_id: studentId,
        course_id: initialCourse.id,
        status: 'PENDING_DETAILS',
      });

      let exam = await dataService.getStudentExam(studentId);
      expect(exam).not.toBeNull();
      expect(exam?.status).toBe('PENDING_DETAILS');
      expect(exam?.centre_id).toBeNull();

      // 2. Later hall ticket verification: extracts same course and confirms slot
      const centre = (await dataService.getCentres())[0];
      await dataService.saveStudentExam({
        student_id: studentId,
        course_id: initialCourse.id,
        centre_id: centre.id,
        exam_date: '2026-10-25',
        reporting_time: '07:30',
        exam_start_time: '09:00',
        shift: 'FN',
        status: 'CONFIRMED',
      });

      // Verify single exam record was updated, not duplicated
      const allExams = await dataService.getStudentExams(studentId);
      expect(allExams.length).toBe(1);
      expect(allExams[0].status).toBe('CONFIRMED');
      expect(allExams[0].centre_id).toBe(centre.id);
    });

    it('detects when extracted hall ticket course differs from pending course', async () => {
      const pendingCourse: Course = {
        id: 'c-old',
        code: 'noc24-cs102',
        name: 'Cloud Computing',
        normalized_name: 'cloud computing',
        created_at: new Date().toISOString(),
      };

      const extractedCourseTitle = 'Deep Learning';
      const match = calculateCourseMatch(extractedCourseTitle, pendingCourse);
      expect(match.isStrongMatch).toBe(false); // Indicates course change detected
    });
  });

  // E. WhatsApp organiser workflow
  describe('E. WhatsApp Group Organiser Workflow', () => {
    it('validates WhatsApp group invite links strictly', () => {
      expect(isValidWhatsAppLink('https://chat.whatsapp.com/AbCdEfGhIjKlMnOpQrStUv')).toBe(true);
      expect(isValidWhatsAppLink('https://chat.whatsapp.com/12345678901234567890')).toBe(true);
      expect(isValidWhatsAppLink('http://chat.whatsapp.com/AbCdEfGhIjKlMnOpQrStUv')).toBe(false); // HTTP insecure
      expect(isValidWhatsAppLink('https://phishing.com/chat.whatsapp.com')).toBe(false);
      expect(isValidWhatsAppLink('not-a-url')).toBe(false);
    });

    it('enforces organiser claim, prevents concurrent claims, and supports release', async () => {
      // Register two students in the same new cohort slot
      await dataService.saveStudentExam({
        student_id: 'std-vol-1',
        course_id: 'crs-1',
        centre_id: 'ctr-3',
        exam_date: '2026-11-20',
        reporting_time: '12:30',
        shift: 'AN',
        status: 'CONFIRMED',
      });

      await dataService.saveStudentExam({
        student_id: 'std-vol-2',
        course_id: 'crs-2',
        centre_id: 'ctr-3',
        exam_date: '2026-11-20',
        reporting_time: '12:30',
        shift: 'AN',
        status: 'CONFIRMED',
      });

      const cohorts = await dataService.getCohorts(undefined, 'std-vol-1');
      const testCohort = cohorts.find(c => c.centre_id === 'ctr-3' && c.exam_date === '2026-11-20')!;
      expect(testCohort.whatsapp_group_link).toBeNull();

      // Student 1 claims organiser role
      const claim1 = await dataService.claimCohortOrganiser(testCohort.id, 'std-vol-1');
      expect(claim1.success).toBe(true);
      expect(claim1.organiser_id).toBe('std-vol-1');

      // Student 2 cannot concurrently claim while active
      await expect(
        dataService.claimCohortOrganiser(testCohort.id, 'std-vol-2')
      ).rejects.toThrow('Another student has already volunteered');

      // Student 1 releases their claim
      await dataService.releaseCohortOrganiser(testCohort.id, 'std-vol-1');

      // Student 2 can now volunteer
      const claim2 = await dataService.claimCohortOrganiser(testCohort.id, 'std-vol-2');
      expect(claim2.success).toBe(true);
      expect(claim2.organiser_id).toBe('std-vol-2');
    });

    it('updates cohort WhatsApp group link and restricts visibility', async () => {
      await dataService.saveStudentExam({
        student_id: 'std-link-1',
        course_id: 'crs-1',
        centre_id: 'ctr-4',
        exam_date: '2026-11-22',
        reporting_time: '07:30',
        shift: 'FN',
        status: 'CONFIRMED',
      });

      const cohorts = await dataService.getCohorts(undefined, 'std-link-1');
      const testCohort = cohorts.find(c => c.centre_id === 'ctr-4' && c.exam_date === '2026-11-22')!;

      // Submit link
      const validLink = 'https://chat.whatsapp.com/AbCdEfGhIjKlMnOpQrStUv';
      await dataService.updateCohortWhatsAppLink(testCohort.id, validLink, 'std-link-1');

      // Check cohort now has active group
      const updatedCohorts = await dataService.getCohorts(undefined, 'std-link-1');
      const updated = updatedCohorts.find(c => c.id === testCohort.id);
      expect(updated?.whatsapp_group_link).toBe(validLink);

      // Non-member student does not see the private cohort link
      const nonMemberCohorts = await dataService.getCohorts(undefined, 'std-non-member');
      const nonMemberView = nonMemberCohorts.find(c => c.id === testCohort.id);
      expect(nonMemberView?.whatsapp_group_link).toBeNull();
    });
  });
});
