import { describe, it, expect, beforeEach } from 'vitest';
import {
  normalizeRegNo,
  dataService,
  localStore
} from '../services/dataService';
import { StudentProfile, ExamCohort, StudentExam } from '../types';

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

const createVerifiedStudent = (id: string, regNo: string, name: string): StudentProfile => ({
  id,
  reg_no: regNo,
  full_name: name,
  branch: 'CSE',
  academic_year: '3rd Year',
  section: 'A',
  phone_visible: false,
  is_verified: true,
  is_admin: false,
  created_at: new Date().toISOString(),
});

describe('Final Matching, Group Visibility & Organiser Requirements', () => {
  beforeEach(() => {
    localStorageMock.clear();
    localStore.resetToDefaults();
  });

  describe('1. Full Registration Number Display', () => {
    it('preserves full registration numbers without masking', () => {
      const student1Reg = 'AP21110010145';
      const student2Reg = 'AP22110010999';

      expect(normalizeRegNo(student1Reg)).toBe('AP21110010145');
      expect(normalizeRegNo(student2Reg)).toBe('AP22110010999');
      // Verify no asterisks or truncated characters
      expect(normalizeRegNo(student1Reg)).not.toContain('*');
      expect(normalizeRegNo(student2Reg)).not.toContain('*');
    });
  });

  describe('2. Single Exam per Student & Updating Existing Record', () => {
    it('enforces exactly one exam per student and updates existing record', async () => {
      const studentId = 'std-single-exam';
      const students = localStore.getStudents();
      students.push(createVerifiedStudent(studentId, 'AP21110010900', 'Single Exam Student'));
      localStore.saveStudents(students);

      // 1. Initial provisional course registration
      const exam1 = await dataService.saveStudentExam({
        student_id: studentId,
        course_id: 'crs-1',
        status: 'PENDING_DETAILS',
      });

      expect(exam1.student_id).toBe(studentId);
      expect(exam1.status).toBe('PENDING_DETAILS');

      // 2. Student uploads hall ticket and updates their single record
      const exam2 = await dataService.saveStudentExam({
        student_id: studentId,
        course_id: 'crs-1',
        centre_id: 'ctr-1',
        exam_date: '2026-11-15',
        reporting_time: '08:00',
        exam_start_time: '09:00',
        shift: 'FN',
        status: 'CONFIRMED',
      });

      // Confirm there is still only one exam record
      const allExams = await dataService.getStudentExams(studentId);
      expect(allExams.length).toBe(1);
      expect(allExams[0].id).toBe(exam1.id);
      expect(allExams[0].status).toBe('CONFIRMED');
      expect(allExams[0].reporting_time).toBe('08:00');
      expect(allExams[0].exam_start_time).toBe('09:00');
    });
  });

  describe('3. Same Centre & Time Matching & Cross-Centre Link Isolation', () => {
    it('matches two students with same centre, same date, and same reporting time', async () => {
      const students = localStore.getStudents();
      students.push(createVerifiedStudent('std-cohort-a', 'AP21110010101', 'Cohort Student A'));
      students.push(createVerifiedStudent('std-cohort-b', 'AP21110010102', 'Cohort Student B'));
      localStore.saveStudents(students);

      // Student A & Student B take different courses at the same centre and reporting time
      await dataService.saveStudentExam({
        student_id: 'std-cohort-a',
        course_id: 'crs-1',
        centre_id: 'ctr-1',
        exam_date: '2026-11-15',
        reporting_time: '08:00',
        exam_start_time: '09:00',
        shift: 'FN',
        status: 'CONFIRMED',
      });

      await dataService.saveStudentExam({
        student_id: 'std-cohort-b',
        course_id: 'crs-2',
        centre_id: 'ctr-1',
        exam_date: '2026-11-15',
        reporting_time: '08:00',
        exam_start_time: '09:00',
        shift: 'FN',
        status: 'CONFIRMED',
      });

      // Retrieve cohorts for Student A
      const cohortsForA = await dataService.getCohorts(undefined, 'std-cohort-a');
      const matching = cohortsForA.find(
        c => c.centre_id === 'ctr-1' && c.exam_date === '2026-11-15' && c.reporting_time === '08:00'
      );

      expect(matching).toBeDefined();
      expect(matching!.is_eligible).toBe(true);

      const memberIds = matching!.members?.map(m => m.student_id);
      expect(memberIds).toContain('std-cohort-a');
      expect(memberIds).toContain('std-cohort-b');
    });

    it('isolates centre WhatsApp links so students at different centres cannot see each other links', async () => {
      const students = localStore.getStudents();
      students.push(createVerifiedStudent('std-patamata', 'AP21110010201', 'Patamata Student'));
      students.push(createVerifiedStudent('std-gannavaram', 'AP21110010202', 'Gannavaram Student'));
      localStore.saveStudents(students);

      // Centre 1 slot (date with no default links)
      await dataService.saveStudentExam({
        student_id: 'std-patamata',
        course_id: 'crs-1',
        centre_id: 'ctr-1', // Patamata
        exam_date: '2026-11-15',
        reporting_time: '08:00',
        shift: 'FN',
        status: 'CONFIRMED',
      });

      // Centre 2 slot
      await dataService.saveStudentExam({
        student_id: 'std-gannavaram',
        course_id: 'crs-1',
        centre_id: 'ctr-2', // Gannavaram
        exam_date: '2026-11-15',
        reporting_time: '08:00',
        shift: 'FN',
        status: 'CONFIRMED',
      });

      // Find Patamata cohort and submit link
      const cohorts = await dataService.getCohorts(undefined, 'std-patamata');
      const patamataCohort = cohorts.find(c => c.centre_id === 'ctr-1' && c.exam_date === '2026-11-15')!;

      await dataService.updateCohortWhatsAppLink(
        patamataCohort.id,
        'https://chat.whatsapp.com/PatamataGroupSlotFN123',
        'std-patamata'
      );

      // Student from Patamata can see the link
      const patamataView = await dataService.getCohorts(undefined, 'std-patamata');
      const cohForPatamata = patamataView.find(c => c.id === patamataCohort.id)!;
      expect(cohForPatamata.is_eligible).toBe(true);
      expect(cohForPatamata.whatsapp_group_link).toBe('https://chat.whatsapp.com/PatamataGroupSlotFN123');

      // Student from Gannavaram CANNOT see Patamata cohort group link
      const gannavaramView = await dataService.getCohorts(undefined, 'std-gannavaram');
      const cohForGannavaram = gannavaramView.find(c => c.id === patamataCohort.id)!;
      expect(cohForGannavaram.is_eligible).toBe(false);
      expect(cohForGannavaram.whatsapp_group_link).toBeNull();
      expect(cohForGannavaram.has_group_link).toBe(true);
    });
  });

  describe('4. Organiser Workflow for Missing Links', () => {
    it('supports first organiser claim and prevents duplicate organiser claims', async () => {
      const students = localStore.getStudents();
      students.push(createVerifiedStudent('std-org-1', 'AP21110010301', 'Organiser 1'));
      students.push(createVerifiedStudent('std-org-2', 'AP21110010302', 'Organiser 2'));
      localStore.saveStudents(students);

      // Setup cohort with 2 members on an unlinked slot
      await dataService.saveStudentExam({
        student_id: 'std-org-1',
        course_id: 'crs-1',
        centre_id: 'ctr-3',
        exam_date: '2026-11-20',
        reporting_time: '12:30',
        shift: 'AN',
        status: 'CONFIRMED',
      });

      await dataService.saveStudentExam({
        student_id: 'std-org-2',
        course_id: 'crs-2',
        centre_id: 'ctr-3',
        exam_date: '2026-11-20',
        reporting_time: '12:30',
        shift: 'AN',
        status: 'CONFIRMED',
      });

      const cohorts = await dataService.getCohorts(undefined, 'std-org-1');
      const cohort = cohorts.find(c => c.centre_id === 'ctr-3' && c.exam_date === '2026-11-20')!;
      expect(cohort.whatsapp_group_link).toBeNull();
      expect(cohort.organiser_id).toBeUndefined();

      // Student 1 volunteers to organise the group
      const claimResult = await dataService.claimCohortOrganiser(cohort.id, 'std-org-1');
      expect(claimResult.success).toBe(true);
      expect(claimResult.organiser_id).toBe('std-org-1');
      expect(claimResult.organiser_status).toBe('CLAIMED');

      // Student 2 attempts to claim the same cohort -> Must be rejected
      await expect(
        dataService.claimCohortOrganiser(cohort.id, 'std-org-2')
      ).rejects.toThrow('Another student has already volunteered');

      // Student 1 submits the WhatsApp invite link
      await dataService.updateCohortWhatsAppLink(
        cohort.id,
        'https://chat.whatsapp.com/PerecherlaSlotAN12345',
        'std-org-1'
      );

      // Verify link is now visible to eligible peers
      const updatedCohorts = await dataService.getCohorts(undefined, 'std-org-2');
      const peerView = updatedCohorts.find(c => c.id === cohort.id)!;
      expect(peerView.whatsapp_group_link).toBe('https://chat.whatsapp.com/PerecherlaSlotAN12345');
      expect(peerView.organiser_status).toBe('COMPLETED');
    });

    it('supports course organiser workflow and link submission', async () => {
      const students = localStore.getStudents();
      students.push(createVerifiedStudent('std-course-org', 'AP21110010401', 'Course Organiser'));
      localStore.saveStudents(students);

      // Enrolled student in crs-3
      await dataService.saveStudentExam({
        student_id: 'std-course-org',
        course_id: 'crs-3',
        status: 'PENDING_DETAILS',
      });

      // Claim course organiser
      const claimRes = await dataService.claimCourseOrganiser('crs-3', 'std-course-org');
      expect(claimRes.success).toBe(true);
      expect(claimRes.organiser_status).toBe('CLAIMED');

      // Organiser submits course link
      await dataService.updateCourseWhatsAppLink(
        'crs-3',
        'https://chat.whatsapp.com/CourseProgrammingC123',
        'std-course-org'
      );

      // Peer in same course can view study group link
      const peerResult = await dataService.getStudentsByCourse('crs-3', undefined, 'std-course-org');
      expect(peerResult.groupLink).toBeDefined();
      expect(peerResult.groupLink?.whatsapp_group_link).toBe('https://chat.whatsapp.com/CourseProgrammingC123');
    });
  });

  describe('5. Same MOOC Course Discovery Mode Isolation', () => {
    it('retrieves enrolled students for a specific course regardless of exam centres', async () => {
      const students = localStore.getStudents();
      students.push(createVerifiedStudent('std-course-diff-centre-1', 'AP21110010501', 'Course Peer 1'));
      students.push(createVerifiedStudent('std-course-diff-centre-2', 'AP21110010502', 'Course Peer 2'));
      localStore.saveStudents(students);

      // Two students taking crs-1 at DIFFERENT examination centres
      await dataService.saveStudentExam({
        student_id: 'std-course-diff-centre-1',
        course_id: 'crs-1',
        centre_id: 'ctr-1',
        exam_date: '2026-11-15',
        reporting_time: '08:00',
        status: 'CONFIRMED',
      });

      await dataService.saveStudentExam({
        student_id: 'std-course-diff-centre-2',
        course_id: 'crs-1',
        centre_id: 'ctr-4', // KL University
        exam_date: '2026-11-15',
        reporting_time: '12:30',
        status: 'CONFIRMED',
      });

      const result = await dataService.getStudentsByCourse('crs-1', undefined, 'std-course-diff-centre-1');
      expect(result.course?.id).toBe('crs-1');
      expect(result.students.length).toBeGreaterThanOrEqual(2);

      const enrolledIds = result.students.map(s => s.profile.id);
      expect(enrolledIds).toContain('std-course-diff-centre-1');
      expect(enrolledIds).toContain('std-course-diff-centre-2');
    });
  });
});
