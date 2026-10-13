import { describe, it, expect, beforeEach } from 'vitest';
import fs from 'fs';
import path from 'path';
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

describe('Exam Setup Flow Options Order & Wording Verification', () => {
  beforeEach(() => {
    localStorageMock.clear();
    localStore.resetToDefaults();
  });

  describe('1. UI Structure & Order in OnboardingModal', () => {
    const modalPath = path.resolve(__dirname, '../components/OnboardingModal.tsx');
    const modalContent = fs.readFileSync(modalPath, 'utf-8');

    it('displays Option 1: Upload Hall Ticket before Option 2 in the choice screen', () => {
      const option1Index = modalContent.indexOf('Option 1: Upload Hall Ticket');
      const option2Index = modalContent.indexOf('Option 2: I Don\'t Have Hall Ticket Yet');

      expect(option1Index).toBeGreaterThan(-1);
      expect(option2Index).toBeGreaterThan(-1);
      expect(option1Index).toBeLessThan(option2Index);
    });

    it('has "Upload Hall Ticket" as the heading and Recommended badge for Option 1', () => {
      expect(modalContent).toContain('Upload Hall Ticket');
      expect(modalContent).toContain('Recommended');
      expect(modalContent).toContain('UPLOAD_AI');
    });

    it('has "I Don\'t Have Hall Ticket Yet" as the heading and updated description for Option 2', () => {
      expect(modalContent).toContain('I Don\'t Have Hall Ticket Yet');
      expect(modalContent).toContain(
        "Don't have your hall ticket yet? Enter your course details manually and connect with study peers. You can upload your hall ticket later to verify your exam centre and reporting slot."
      );
      expect(modalContent).toContain('NO_HALL_TICKET');
    });

    it('contains "Prefer to enter all exam details manually? Click here" inside Option 2 and no duplicate outside', () => {
      const option2Start = modalContent.indexOf('Option 2: I Don\'t Have Hall Ticket Yet');
      const option2End = modalContent.indexOf('Zero-Storage Guarantee: Hall tickets are processed');
      const option2Block = modalContent.slice(option2Start, option2End);

      expect(option2Block).toContain('Prefer to enter all exam details manually? Click here');
      expect(option2Block).toContain('handleOpenManualEntry()');
      expect(option2Block).toContain('stopPropagation()');

      // Check that the duplicate outside button was removed
      const outsideBlock = modalContent.slice(option2End);
      expect(outsideBlock).not.toContain('Prefer to enter all exam details manually? Click here');
    });

    it('uses the same OnboardingModal for both new user (Set Up My Exam) and existing user (Update My Exam)', () => {
      expect(modalContent).toContain(
        "{step === 'CHOICE' && (existingExam ? 'Update My Exam' : 'Set Up My Exam')}"
      );
    });
  });

  describe('2. Functionality: Both flows and later hall-ticket upload verification', () => {
    it('flow 1: manual course registration sets status to PENDING_DETAILS without requiring centre/slot', async () => {
      const studentId = 'test-student-pending-1';
      await dataService.saveStudentExamAtomic({
        student_id: studentId,
        course_name: 'Deep Learning',
        course_code: 'noc24-cs101',
        status: 'PENDING_DETAILS',
      });

      const fetched = await dataService.getStudentExam(studentId);
      expect(fetched?.status).toBe('PENDING_DETAILS');
      expect(fetched?.course?.name).toBe('Deep Learning');
      expect(fetched?.centre_id).toBeNull();
      expect(fetched?.exam_date).toBeNull();
    });

    it('flow 2: user can upload hall ticket later to verify their pending exam into CONFIRMED with centre and reporting slot', async () => {
      const studentId = 'test-student-pending-2';
      // First registered manually without hall ticket
      await dataService.saveStudentExamAtomic({
        student_id: studentId,
        course_name: 'Cloud Computing',
        course_code: 'noc24-cs102',
        status: 'PENDING_DETAILS',
      });

      const pendingExam = await dataService.getStudentExam(studentId);
      expect(pendingExam?.status).toBe('PENDING_DETAILS');

      // Later uploads hall ticket: verifies centre and reporting slot
      await dataService.saveStudentExamAtomic({
        student_id: studentId,
        course_name: 'Cloud Computing',
        course_code: 'noc24-cs102',
        exam_date: '2026-10-25',
        reporting_time: '07:30',
        exam_start_time: '09:00',
        shift: 'FN',
        centre_name: 'iON Digital Zone iDZ Patamata',
        centre_address: 'Near Benz Circle, Patamata',
        city: 'Vijayawada',
        state: 'Andhra Pradesh',
        pincode: '520010',
        status: 'CONFIRMED',
      });

      const confirmedExam = await dataService.getStudentExam(studentId);
      expect(confirmedExam?.status).toBe('CONFIRMED');
      expect(confirmedExam?.exam_date).toBe('2026-10-25');
      expect(confirmedExam?.reporting_time).toBe('07:30');
      expect(confirmedExam?.shift).toBe('FN');
      expect(confirmedExam?.centre?.name).toBe('iON Digital Zone iDZ Patamata');
    });
  });
});
