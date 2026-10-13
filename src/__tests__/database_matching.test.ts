import { describe, it, expect, beforeEach } from 'vitest';
import { dataService, localStore } from '../services/dataService';

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

describe('Database-Backed Buddy Matching & Concurrency Operations', () => {
  beforeEach(() => {
    localStorageMock.clear();
    localStore.resetToDefaults();
  });

  describe('1. Identical Slots Matching (Different Courses at Same Venue & Reporting Time)', () => {
    it('matches students taking DIFFERENT courses into the SAME cohort when centre, date and reporting time match', async () => {
      const centreId = 'ctr-patamata-1';
      const examDate = '2026-10-25';
      const reportingTime = '07:30';

      // Student 1: Deep Learning (crs-1)
      await dataService.saveStudentExam({
        student_id: 'std-karthik',
        course_id: 'crs-1',
        centre_id: centreId,
        exam_date: examDate,
        reporting_time: reportingTime,
        exam_start_time: '09:00',
        shift: 'FN',
        status: 'CONFIRMED',
      });

      // Student 2: Cloud Computing (crs-2) - DIFFERENT COURSE!
      await dataService.saveStudentExam({
        student_id: 'std-ananya',
        course_id: 'crs-2',
        centre_id: centreId,
        exam_date: examDate,
        reporting_time: reportingTime,
        exam_start_time: '09:00',
        shift: 'FN',
        status: 'CONFIRMED',
      });

      const cohorts = await dataService.getCohorts();
      // Find the cohort for this venue, date, and reporting slot
      const matchingCohort = cohorts.find(
        c => c.centre_id === centreId && c.exam_date === examDate && c.reporting_time === reportingTime
      );

      expect(matchingCohort).toBeDefined();
      expect(matchingCohort?.members?.length).toBe(2);

      const memberIds = matchingCohort?.members?.map(m => m.student_id);
      expect(memberIds).toContain('std-karthik');
      expect(memberIds).toContain('std-ananya');

      // Verify that their individual courses are preserved
      const karthikMember = matchingCohort?.members?.find(m => m.student_id === 'std-karthik');
      const ananyaMember = matchingCohort?.members?.find(m => m.student_id === 'std-ananya');
      expect(karthikMember?.course?.id).toBe('crs-1');
      expect(ananyaMember?.course?.id).toBe('crs-2');
    });
  });

  describe('2. Different Slots at Same Centre', () => {
    it('places students in DIFFERENT cohorts when reporting time differs (e.g. FN 07:30 vs AN 12:30)', async () => {
      const centreId = 'ctr-patamata-1';
      const examDate = '2026-10-25';

      // Student A: Morning slot (07:30)
      await dataService.saveStudentExam({
        student_id: 'std-morning',
        course_id: 'crs-1',
        centre_id: centreId,
        exam_date: examDate,
        reporting_time: '07:30',
        shift: 'FN',
        status: 'CONFIRMED',
      });

      // Student B: Afternoon slot (12:30)
      await dataService.saveStudentExam({
        student_id: 'std-afternoon',
        course_id: 'crs-1',
        centre_id: centreId,
        exam_date: examDate,
        reporting_time: '12:30',
        shift: 'AN',
        status: 'CONFIRMED',
      });

      const cohorts = await dataService.getCohorts();
      const morningCohort = cohorts.find(
        c => c.centre_id === centreId && c.exam_date === examDate && c.reporting_time === '07:30'
      );
      const afternoonCohort = cohorts.find(
        c => c.centre_id === centreId && c.exam_date === examDate && c.reporting_time === '12:30'
      );

      expect(morningCohort).toBeDefined();
      expect(afternoonCohort).toBeDefined();
      expect(morningCohort?.id).not.toBe(afternoonCohort?.id);

      expect(morningCohort?.members?.map(m => m.student_id)).toEqual(['std-morning']);
      expect(afternoonCohort?.members?.map(m => m.student_id)).toEqual(['std-afternoon']);
    });
  });

  describe('3. Different Centres on Same Date & Time', () => {
    it('isolates students into separate cohorts when test centres differ', async () => {
      const examDate = '2026-10-25';
      const reportingTime = '07:30';

      // Student Vijayawada
      await dataService.saveStudentExam({
        student_id: 'std-vijayawada',
        course_id: 'crs-1',
        centre_id: 'ctr-vja',
        exam_date: examDate,
        reporting_time: reportingTime,
        status: 'CONFIRMED',
      });

      // Student Guntur
      await dataService.saveStudentExam({
        student_id: 'std-guntur',
        course_id: 'crs-1',
        centre_id: 'ctr-gnt',
        exam_date: examDate,
        reporting_time: reportingTime,
        status: 'CONFIRMED',
      });

      const cohorts = await dataService.getCohorts();
      const vjaCohort = cohorts.find(c => c.centre_id === 'ctr-vja');
      const gntCohort = cohorts.find(c => c.centre_id === 'ctr-gnt');

      expect(vjaCohort).toBeDefined();
      expect(gntCohort).toBeDefined();
      expect(vjaCohort?.id).not.toBe(gntCohort?.id);
      expect(vjaCohort?.members?.length).toBe(1);
      expect(gntCohort?.members?.length).toBe(1);
    });
  });

  describe('4. Separate Course Discovery Query (Ignores Centre, Date, Time)', () => {
    it('discovers all peers in the same MOOC course regardless of centre, date or time, including students with no hall ticket', async () => {
      const courseId = 'crs-shared-study';

      // Student 1: Confirmed in Vijayawada
      await dataService.saveStudentExam({
        student_id: 'std-1',
        course_id: courseId,
        centre_id: 'ctr-1',
        exam_date: '2026-10-25',
        reporting_time: '07:30',
        status: 'CONFIRMED',
      });

      // Student 2: Confirmed in Guntur on another date
      await dataService.saveStudentExam({
        student_id: 'std-2',
        course_id: courseId,
        centre_id: 'ctr-2',
        exam_date: '2026-10-26',
        reporting_time: '12:30',
        status: 'CONFIRMED',
      });

      // Student 3: NO HALL TICKET YET (PENDING_DETAILS, no invented details)
      await dataService.saveStudentExam({
        student_id: 'std-3',
        course_id: courseId,
        centre_id: null,
        exam_date: null,
        reporting_time: null,
        status: 'PENDING_DETAILS',
      });

      const courseResult = await dataService.getStudentsByCourse(courseId);

      expect(courseResult.total).toBe(3);
      expect(courseResult.students.length).toBe(3);

      const studentIds = courseResult.students.map(s => s.profile.id);
      expect(studentIds).toContain('std-1');
      expect(studentIds).toContain('std-2');
      expect(studentIds).toContain('std-3');

      // Check student 3 details: NO invented centre or date!
      const pendingStudent = courseResult.students.find(s => s.profile.id === 'std-3');
      expect(pendingStudent?.exam.status).toBe('PENDING_DETAILS');
      expect(pendingStudent?.exam.centre_id).toBeNull();
      expect(pendingStudent?.exam.exam_date).toBeNull();
      expect(pendingStudent?.exam.reporting_time).toBeNull();
    });

    it('ensures student with pending hall ticket is excluded from exam centre cohorts', async () => {
      const studentId = 'std-pending-isolated';
      await dataService.saveStudentExam({
        student_id: studentId,
        course_id: 'crs-1',
        status: 'PENDING_DETAILS',
      });

      const cohorts = await dataService.getCohorts();
      const allCohortMembers = cohorts.flatMap(c => c.members || []);
      const foundPending = allCohortMembers.find(m => m.student_id === studentId);
      expect(foundPending).toBeUndefined();
    });
  });

  describe('5. Changed Exam Details & Atomic Membership Migration', () => {
    it('atomically moves student from old cohort to new cohort when exam slot details change', async () => {
      const studentId = 'std-migrator';

      // 1. Initial registration: Slot 1 (Centre 1, Date 25, 07:30)
      await dataService.saveStudentExam({
        student_id: studentId,
        course_id: 'crs-1',
        centre_id: 'ctr-1',
        exam_date: '2026-10-25',
        reporting_time: '07:30',
        status: 'CONFIRMED',
      });

      let cohorts = await dataService.getCohorts();
      let cohort1 = cohorts.find(c => c.centre_id === 'ctr-1' && c.reporting_time === '07:30');
      expect(cohort1?.members?.some(m => m.student_id === studentId)).toBe(true);

      // 2. Student updates exam: changes slot to Centre 2, Date 26, 12:30
      await dataService.saveStudentExam({
        student_id: studentId,
        course_id: 'crs-1',
        centre_id: 'ctr-2',
        exam_date: '2026-10-26',
        reporting_time: '12:30',
        status: 'CONFIRMED',
      });

      cohorts = await dataService.getCohorts();
      cohort1 = cohorts.find(c => c.centre_id === 'ctr-1' && c.reporting_time === '07:30');
      const cohort2 = cohorts.find(c => c.centre_id === 'ctr-2' && c.reporting_time === '12:30');

      // Student must no longer be in Cohort 1
      expect(cohort1?.members?.some(m => m.student_id === studentId)).toBe(false);
      // Student must now be in Cohort 2
      expect(cohort2?.members?.some(m => m.student_id === studentId)).toBe(true);

      // Student must still have strictly 1 exam record in the system
      const studentExams = await dataService.getStudentExams(studentId);
      expect(studentExams.length).toBe(1);
      expect(studentExams[0].centre_id).toBe('ctr-2');
    });

    it('removes cohort membership entirely if student reverts to PENDING_DETAILS', async () => {
      const studentId = 'std-reverter';

      // Confirmed slot
      await dataService.saveStudentExam({
        student_id: studentId,
        course_id: 'crs-1',
        centre_id: 'ctr-1',
        exam_date: '2026-10-25',
        reporting_time: '07:30',
        status: 'CONFIRMED',
      });

      // Revert to pending
      await dataService.saveStudentExam({
        student_id: studentId,
        course_id: 'crs-1',
        status: 'PENDING_DETAILS',
      });

      const cohorts = await dataService.getCohorts();
      const allMembers = cohorts.flatMap(c => c.members || []);
      expect(allMembers.some(m => m.student_id === studentId)).toBe(false);
    });
  });

  describe('6. Concurrency & Duplicate Prevention', () => {
    it('prevents duplicate cohorts and duplicate memberships under concurrent submissions for the same slot', async () => {
      const centreId = 'ctr-concurrent';
      const examDate = '2026-10-25';
      const reportingTime = '07:30';

      // Simulate simultaneous submissions
      await Promise.all([
        dataService.saveStudentExam({
          student_id: 'std-concurrent-1',
          course_id: 'crs-1',
          centre_id: centreId,
          exam_date: examDate,
          reporting_time: reportingTime,
          status: 'CONFIRMED',
        }),
        dataService.saveStudentExam({
          student_id: 'std-concurrent-2',
          course_id: 'crs-2',
          centre_id: centreId,
          exam_date: examDate,
          reporting_time: reportingTime,
          status: 'CONFIRMED',
        }),
        dataService.saveStudentExam({
          student_id: 'std-concurrent-3',
          course_id: 'crs-3',
          centre_id: centreId,
          exam_date: examDate,
          reporting_time: reportingTime,
          status: 'CONFIRMED',
        }),
      ]);

      const cohorts = await dataService.getCohorts();
      const matchingCohorts = cohorts.filter(
        c => c.centre_id === centreId && c.exam_date === examDate && c.reporting_time === reportingTime
      );

      // Exactly ONE cohort created for this slot
      expect(matchingCohorts.length).toBe(1);
      // All 3 students are members without duplicates
      expect(matchingCohorts[0].members?.length).toBe(3);
    });
  });

  describe('7. Pagination of Course Discovery and Cohorts', () => {
    it('paginates course discovery results correctly', async () => {
      const courseId = 'crs-paginated';

      // Create 5 students for this course
      for (let i = 1; i <= 5; i++) {
        await dataService.saveStudentExam({
          student_id: `std-page-${i}`,
          course_id: courseId,
          centre_id: `ctr-${i}`,
          exam_date: '2026-10-25',
          reporting_time: '07:30',
          status: 'CONFIRMED',
        });
      }

      // Page 1 with pageSize: 2
      const page1 = await dataService.getStudentsByCourse(courseId, { page: 1, pageSize: 2 });
      expect(page1.total).toBe(5);
      expect(page1.students.length).toBe(2);
      expect(page1.totalPages).toBe(3);
      expect(page1.hasMore).toBe(true);

      // Page 2 with pageSize: 2
      const page2 = await dataService.getStudentsByCourse(courseId, { page: 2, pageSize: 2 });
      expect(page2.students.length).toBe(2);
      expect(page2.hasMore).toBe(true);

      // Page 3 with pageSize: 2
      const page3 = await dataService.getStudentsByCourse(courseId, { page: 3, pageSize: 2 });
      expect(page3.students.length).toBe(1);
      expect(page3.hasMore).toBe(false);
    });

    it('paginates cohort lists', async () => {
      const paginatedCohorts = await dataService.getCohorts({ page: 1, pageSize: 2 });
      expect(paginatedCohorts.length).toBeLessThanOrEqual(2);
    });
  });
});
