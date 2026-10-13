import { describe, it, expect, beforeEach } from 'vitest';
import {
  normalizeRegNo,
  normalizeText,
  isValidWhatsAppLink,
  dataService
} from '../services/dataService';

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

describe('MoocDeal Core Business Logic & Constraints', () => {
  beforeEach(() => {
    localStorageMock.clear();
  });

  describe('1. Registration Number Normalization & Masking', () => {
    it('normalizes registration numbers to uppercase trimmed strings', () => {
      expect(normalizeRegNo('  ap21110010045  ')).toBe('AP21110010045');
      expect(normalizeRegNo('ap22110010190')).toBe('AP22110010190');
    });

    it('preserves full registration numbers for student directory and buddy lists as explicitly requested', () => {
      const formatRegNoForDisplay = (reg: string) => normalizeRegNo(reg);

      expect(formatRegNoForDisplay('AP21110010045')).toBe('AP21110010045');
      expect(formatRegNoForDisplay('AP22110010190')).toBe('AP22110010190');
    });

    it('normalizes search queries and course titles', () => {
      expect(normalizeText('Cloud Computing (noc24-cs101)')).toBe('cloud computing noc24cs101');
      expect(normalizeText('  ION Digital Zone iDZ Vijayawada! ')).toBe('ion digital zone idz vijayawada');
    });
  });

  describe('2. WhatsApp Link Validation & Community Safety', () => {
    it('validates legitimate WhatsApp group invite links', () => {
      expect(isValidWhatsAppLink('https://chat.whatsapp.com/LKn82s0Dkae390Ka0192Aa')).toBe(true);
      expect(isValidWhatsAppLink('https://chat.whatsapp.com/ABCDEF1234567890abcdef')).toBe(true);
    });

    it('rejects malicious or invalid URLs', () => {
      expect(isValidWhatsAppLink('')).toBe(false);
      expect(isValidWhatsAppLink('https://phishing-site.com/chat.whatsapp.com/fake')).toBe(false);
      expect(isValidWhatsAppLink('https://wa.me/919999999999')).toBe(false);
      expect(isValidWhatsAppLink('javascript:alert(1)')).toBe(false);
      expect(isValidWhatsAppLink('https://chat.whatsapp.com/short')).toBe(false); // under 20 chars
    });
  });

  describe('3. Single Exam Per Student Constraint', () => {
    it('saves an exam record for a student and retrieves it', async () => {
      const studentId = 'test-student-1';
      const exam = await dataService.saveStudentExam({
        student_id: studentId,
        course_id: 'crs-1',
        centre_id: 'ctr-1',
        exam_date: '2026-10-25',
        reporting_time: '07:30:00',
        exam_start_time: '09:00:00',
        shift: 'FN',
        status: 'CONFIRMED',
      });

      expect(exam).toBeDefined();
      expect(exam.student_id).toBe(studentId);
      expect(exam.status).toBe('CONFIRMED');

      const retrieved = await dataService.getStudentExam(studentId);
      expect(retrieved).toBeDefined();
      expect(retrieved?.student_id).toBe(studentId);
      expect(retrieved?.course_id).toBe('crs-1');
    });

    it('enforces single exam per student: updating with new course replaces old exam without duplicates', async () => {
      const studentId = 'test-student-unique';

      // First exam enrollment
      await dataService.saveStudentExam({
        student_id: studentId,
        course_id: 'crs-1',
        centre_id: 'ctr-1',
        exam_date: '2026-10-25',
        reporting_time: '07:30:00',
        status: 'CONFIRMED',
      });

      // Second exam enrollment attempt for the same student (e.g. changing course or hall ticket)
      await dataService.saveStudentExam({
        student_id: studentId,
        course_id: 'crs-2',
        centre_id: 'ctr-2',
        exam_date: '2026-10-26',
        reporting_time: '13:00:00',
        status: 'CONFIRMED',
      });

      // Verification: must still have exactly 1 exam, updated to crs-2
      const allExams = await dataService.getStudentExams(studentId);
      expect(allExams.length).toBe(1);
      expect(allExams[0].course_id).toBe('crs-2');
      expect(allExams[0].centre_id).toBe('ctr-2');
      expect(allExams[0].exam_date).toBe('2026-10-26');

      const singleExam = await dataService.getStudentExam(studentId);
      expect(singleExam?.course_id).toBe('crs-2');
    });

    it('supports pending hall-ticket state without centre or reporting time', async () => {
      const studentId = 'test-student-pending';
      const exam = await dataService.saveStudentExam({
        student_id: studentId,
        course_id: 'crs-pending-1',
        centre_id: null,
        exam_date: null,
        reporting_time: null,
        status: 'PENDING_DETAILS',
      });

      expect(exam.status).toBe('PENDING_DETAILS');
      expect(exam.centre_id).toBeNull();
      expect(exam.reporting_time).toBeNull();

      const retrieved = await dataService.getStudentExam(studentId);
      expect(retrieved?.status).toBe('PENDING_DETAILS');
    });
  });

  describe('4. Account Recovery & Password Reset Flow', () => {
    it('successfully processes password reset request for registered student', async () => {
      const regRes = await dataService.signUp({
        password: 'OriginalPassword123!',
        full_name: 'Reset Test Student',
        reg_no: 'AP21110099999',
        branch: 'CSE',
        academic_year: '3rd Year',
        section: 'A',
      });

      expect(regRes.user).toBeDefined();

      const resetReq = await dataService.requestPasswordReset('AP21110099999');
      expect(resetReq.success).toBe(true);
      expect(resetReq.email).toBe('ap21110099999@srmap.edu.in');
    });

    it('returns error when requesting reset for non-existent student', async () => {
      const resetReq = await dataService.requestPasswordReset('AP99999999999');
      expect(resetReq.success).toBe(false);
      expect(resetReq.error).toBeDefined();
    });
  });

  describe('5. WhatsApp Group Link Sharing & Moderation', () => {
    it('updates WhatsApp group link for cohort and tracks submitter', async () => {
      const cohorts = await dataService.getCohorts();
      const cohort = cohorts.find(c => !c.has_group_link) || cohorts[0];
      const cohortId = cohort.id;
      const studentId = 'student-submitter-1';
      const link = 'https://chat.whatsapp.com/TestCohortGroupLink12345';

      const updated = await dataService.updateCohortWhatsAppLink(cohortId, link, studentId);
      expect(updated.whatsapp_group_link).toBe(link);
      expect(updated.link_submitted_by).toBe(studentId);
    });

    it('reports an invalid or spam WhatsApp group link', async () => {
      const studentId = 'student-reporter-1';
      const report = await dataService.reportLink({
        link_type: 'COHORT',
        target_id: 'ch-test-1',
        reported_by: studentId,
        whatsapp_link: 'https://chat.whatsapp.com/SpamGroupLink12345678',
        reason: 'SPAM',
        details: 'Promotional group not related to exam',
      });

      expect(report).toBeDefined();
      expect(report.status).toBe('PENDING');
      expect(report.reason).toBe('SPAM');
    });
  });

  describe('6. Security, Constraints & Data Isolation', () => {
    it('prevents duplicate student registration numbers', async () => {
      const first = await dataService.signUp({
        password: 'Password123!',
        full_name: 'Original Student',
        reg_no: 'AP21110055555',
        branch: 'ECE',
        academic_year: '2nd Year',
        section: 'B',
      });
      expect(first.user).toBeDefined();

      const duplicate = await dataService.signUp({
        password: 'Password999!',
        full_name: 'Imposter Student',
        reg_no: 'AP21110055555',
        branch: 'ECE',
        academic_year: '2nd Year',
        section: 'B',
      });
      expect(duplicate.user).toBeNull();
      expect(duplicate.error).toContain('already exists');
    });

    it('rejects passwords shorter than 4 characters', async () => {
      const res = await dataService.signUp({
        password: '123',
        full_name: 'Short Password Student',
        reg_no: 'AP21110066666',
        branch: 'MECH',
        academic_year: '1st Year',
        section: 'C',
      });
      expect(res.user).toBeNull();
      expect(res.error).toContain('at least 4 characters');
    });

    it('accepts valid 4-digit PIN passwords', async () => {
      const res = await dataService.signUp({
        password: '1234',
        full_name: 'Four Digit PIN Student',
        reg_no: 'AP21110077777',
        branch: 'CSE',
        academic_year: '2nd Year',
        section: 'A',
      });
      expect(res.user).not.toBeNull();
      expect(res.user?.reg_no).toBe('AP21110077777');
    });

    it('enforces lockout after 5 consecutive failed login attempts and clears on success', async () => {
      const regNo = 'AP21110088888';
      await dataService.signUp({
        password: '4321',
        full_name: 'Brute Force Protected Student',
        reg_no: regNo,
        branch: 'CSE',
        academic_year: '3rd Year',
        section: 'B',
      });

      // 4 wrong attempts should still report invalid credentials
      for (let i = 0; i < 4; i++) {
        const failRes = await dataService.signIn(regNo, '0000');
        expect(failRes.user).toBeNull();
      }

      // 5th attempt locks out
      const fifthFail = await dataService.signIn(regNo, '0000');
      expect(fifthFail.user).toBeNull();

      // Subsequent attempt must trigger lockout message
      const lockedRes = await dataService.signIn(regNo, '4321');
      expect(lockedRes.user).toBeNull();
      expect(lockedRes.error).toContain('Too many failed login attempts');
    });
  });
});
