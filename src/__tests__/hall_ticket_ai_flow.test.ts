import { describe, it, expect, beforeEach } from 'vitest';
import {
  validateAndSanitizeExtraction,
  processHallTicketExtraction
} from '../../api/extract-hallticket';
import { dataService } from '../services/dataService';

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

describe('AI Hall-Ticket Extraction & Autofill Engine', () => {
  beforeEach(() => {
    localStorageMock.clear();
  });

  describe('1. Reporting Time vs Exam Start Time Distinction', () => {
    it('correctly maintains separate reporting time (07:30) and exam start time (09:00) for FN shift', () => {
      const raw = {
        course_name: 'Deep Learning',
        course_code: 'noc24-cs101',
        exam_date: '2026-10-25',
        reporting_time: '07:30',
        exam_start_time: '09:00',
        shift: 'FN',
        centre_name: 'iON Digital Zone iDZ Patamata',
        centre_address: 'High School Road, Patamata',
        city: 'Vijayawada',
        state: 'Andhra Pradesh',
        pincode: '520010',
      };

      const result = validateAndSanitizeExtraction(raw);
      expect(result.reporting_time).toBe('07:30');
      expect(result.exam_start_time).toBe('09:00');
      expect(result.shift).toBe('FN');
      expect(result.ambiguous_fields).not.toContain('reporting_time');
      expect(result.ambiguous_fields).not.toContain('exam_start_time');
    });

    it('normalizes 12-hour AM/PM times to 24-hour format correctly', () => {
      const raw = {
        course_name: 'Cloud Computing',
        exam_date: '2026-10-26',
        reporting_time: '12:45 PM',
        exam_start_time: '2:00 PM',
        shift: 'AN',
        centre_name: 'iON Digital Zone Guntur',
        centre_address: 'Autonagar, Guntur',
      };

      const result = validateAndSanitizeExtraction(raw);
      expect(result.reporting_time).toBe('12:45');
      expect(result.exam_start_time).toBe('14:00');
      expect(result.shift).toBe('AN');
    });

    it('flags uncertain fields when reporting time is after or equal to exam start time', () => {
      const raw = {
        course_name: 'Database Management',
        exam_date: '2026-10-25',
        reporting_time: '10:00', // invalid: reporting is later than start
        exam_start_time: '09:00',
        centre_name: 'Test Centre',
      };

      const result = validateAndSanitizeExtraction(raw);
      expect(result.ambiguous_fields).toContain('reporting_time');
      expect(result.ambiguous_fields).toContain('exam_start_time');
    });

    it('flags reporting time when it is mistakenly assigned the default exam start time (09:00)', () => {
      const raw = {
        course_name: 'Problem Solving in C',
        exam_date: '2026-10-25',
        reporting_time: '09:00', // exam start time mistakenly assigned as reporting time
        exam_start_time: '',
        centre_name: 'Test Centre',
      };

      const result = validateAndSanitizeExtraction(raw);
      expect(result.ambiguous_fields).toContain('reporting_time');
    });
  });

  describe('2. Date Validation & Formatting', () => {
    it('accepts valid ISO date format YYYY-MM-DD', () => {
      const raw = {
        course_name: 'Design and Analysis of Algorithms',
        exam_date: '2026-10-25',
        reporting_time: '07:30',
        centre_name: 'iON Digital Zone',
      };

      const result = validateAndSanitizeExtraction(raw);
      expect(result.exam_date).toBe('2026-10-25');
      expect(result.ambiguous_fields).not.toContain('exam_date');
    });

    it('flags invalid dates and malformed strings in ambiguous_fields', () => {
      const raw = {
        course_name: 'Digital Circuits',
        exam_date: 'not-a-valid-date-string',
        reporting_time: '07:30',
        centre_name: 'iON Digital Zone',
      };

      const result = validateAndSanitizeExtraction(raw);
      expect(result.ambiguous_fields).toContain('exam_date');
      expect(result.exam_date).toBe('');
    });

    it('flags out-of-range calendar dates (e.g. month 15)', () => {
      const raw = {
        course_name: 'Operating Systems',
        exam_date: '2026-15-45',
        reporting_time: '07:30',
        centre_name: 'iON Digital Zone',
      };

      const result = validateAndSanitizeExtraction(raw);
      expect(result.ambiguous_fields).toContain('exam_date');
    });
  });

  describe('3. Missing Fields & Uncertain Fields Flagging', () => {
    it('flags missing course name, missing centre name, and missing reporting time rather than guessing', () => {
      const raw = {
        course_name: '', // missing
        centre_name: '', // missing
        exam_date: '2026-10-25',
        reporting_time: '', // missing
        pincode: '999', // invalid pincode
      };

      const result = validateAndSanitizeExtraction(raw);
      expect(result.ambiguous_fields).toContain('course_name');
      expect(result.ambiguous_fields).toContain('centre_name');
      expect(result.ambiguous_fields).toContain('reporting_time');
      expect(result.ambiguous_fields).toContain('pincode');
      expect(result.confidence_score).toBeLessThan(50);
    });

    it('generates fallback course code when course name exists but code is absent', () => {
      const raw = {
        course_name: 'Computer Networks',
        exam_date: '2026-10-25',
        reporting_time: '07:30',
        centre_name: 'iON Digital Zone',
      };

      const result = validateAndSanitizeExtraction(raw);
      expect(result.course_code).toBe('noc24-compu');
    });
  });

  describe('4. Unreadable & Non-Hall-Ticket Image Handling', () => {
    it('marks tiny or unreadable image payloads as is_hall_ticket: false', async () => {
      // 50 bytes base64 is not a valid document image
      const smallBase64 = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';
      const result = await processHallTicketExtraction(smallBase64, 'image/png');

      expect(result.is_hall_ticket).toBe(false);
      expect(result.ambiguous_fields).toContain('course_name');
      expect(result.ambiguous_fields).toContain('exam_date');
      expect(result.confidence_score).toBeLessThan(30);
    });

    it('rejects unsupported image mime types', async () => {
      await expect(
        processHallTicketExtraction('base64...', 'image/gif')
      ).rejects.toThrow(/Unsupported image format/);

      await expect(
        processHallTicketExtraction('base64...', 'application/pdf')
      ).rejects.toThrow(/Unsupported image format/);
    });
  });

  describe('5. Student Confirmation & Data Persistence', () => {
    it('persists only student-confirmed fields and ignores discarded temporary data', async () => {
      const studentId = 'test-ai-student-1';

      // Simulated extracted data that the student verified and confirmed on the form
      const confirmedFields = {
        course_name: 'Natural Language Processing',
        course_code: 'noc24-cs55',
        exam_date: '2026-10-25',
        reporting_time: '07:30',
        exam_start_time: '09:00',
        shift: 'FN' as const,
        centre_name: 'iON Digital Zone iDZ Vijayawada',
        centre_address: 'Near Benz Circle, Patamata',
        city: 'Vijayawada',
        state: 'Andhra Pradesh',
        pincode: '520010',
      };

      const course = await dataService.findOrCreateCourse({
        code: confirmedFields.course_code,
        name: confirmedFields.course_name,
      });

      const centre = await dataService.findOrCreateCentre({
        name: confirmedFields.centre_name,
        address: confirmedFields.centre_address,
        city: confirmedFields.city,
        state: confirmedFields.state,
        pincode: confirmedFields.pincode,
        userId: studentId,
      });

      const savedExam = await dataService.saveStudentExam({
        student_id: studentId,
        course_id: course.id,
        centre_id: centre.id,
        exam_date: confirmedFields.exam_date,
        reporting_time: confirmedFields.reporting_time,
        exam_start_time: confirmedFields.exam_start_time,
        shift: confirmedFields.shift,
        status: 'CONFIRMED',
      });

      expect(savedExam).toBeDefined();
      expect(savedExam.status).toBe('CONFIRMED');
      expect(savedExam.reporting_time).toBe('07:30');
      expect(savedExam.exam_start_time).toBe('09:00');

      // Verify single exam record retrieved
      const retrieved = await dataService.getStudentExam(studentId);
      expect(retrieved?.id).toBe(savedExam.id);
      expect(retrieved?.course?.name).toBe('Natural Language Processing');
      expect(retrieved?.centre?.name).toBe('iON Digital Zone iDZ Vijayawada');
    });
  });
});
