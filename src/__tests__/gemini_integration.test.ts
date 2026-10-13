import { describe, it, expect, vi, afterEach } from 'vitest';
import {
  validateAndSanitizeExtraction,
  processHallTicketExtraction
} from '../../api/extract-hallticket';
import {
  processAiCourseMatch
} from '../../api/ai-match-course';
import { resolveCanonicalCourseMatch } from '../services/courseMatcher';

describe('Gemini Vision & AI Integration Tests', () => {
  describe('1. Extraction Validation and Data Sanitization', () => {
    it('validates a complete, authentic NPTEL admit card payload', () => {
      const raw = {
        course_name: 'Deep Learning',
        course_code: 'noc24-cs101',
        candidate_name: 'Master Student',
        reg_no: 'AP25110010622',
        exam_date: '2026-10-25',
        reporting_time: '07:30 AM',
        exam_start_time: '09:00 AM',
        shift: 'FN',
        centre_name: 'iON Digital Zone iDZ Patamata',
        centre_address: 'Near Benz Circle, High School Road, Patamata',
        city: 'Vijayawada',
        state: 'Andhra Pradesh',
        pincode: '520010',
        is_hall_ticket: true,
      };

      const result = validateAndSanitizeExtraction(raw);

      expect(result.is_hall_ticket).toBe(true);
      expect(result.course_name).toBe('Deep Learning');
      expect(result.course_code).toBe('noc24-cs101');
      expect(result.candidate_name).toBe('Master Student');
      expect(result.reg_no).toBe('AP25110010622');
      expect(result.exam_date).toBe('2026-10-25');
      expect(result.reporting_time).toBe('07:30');
      expect(result.exam_start_time).toBe('09:00');
      expect(result.shift).toBe('FN');
      expect(result.centre_name).toBe('iON Digital Zone iDZ Patamata');
      expect(result.pincode).toBe('520010');
      expect(result.confidence_score).toBe(100);
      expect(result.ambiguous_fields).toEqual([]);
    });

    it('strictly distinguishes reporting arrival time from exam start time', () => {
      // If model erroneously reports arrival time equal to or later than exam start time
      const raw = {
        course_name: 'Cloud Computing',
        course_code: 'noc24-cs102',
        exam_date: '2026-10-25',
        reporting_time: '09:00', // Conflated with exam start time!
        exam_start_time: '09:00',
        shift: 'FN',
        centre_name: 'iON Digital Zone',
        centre_address: 'Patamata Road',
        pincode: '520010',
      };

      const result = validateAndSanitizeExtraction(raw);

      expect(result.ambiguous_fields).toContain('reporting_time');
      expect(result.ambiguous_fields).toContain('exam_start_time');
      expect(result.confidence_score).toBeLessThan(80);
    });

    it('flags unreadable or missing fields into ambiguous_fields rather than guessing', () => {
      const raw = {
        course_name: '', // missing
        course_code: '',
        exam_date: 'invalid-date-string',
        reporting_time: '',
        exam_start_time: '',
        centre_name: 'iON Digital Zone',
        centre_address: 'Near Benz Circle',
        pincode: 'abc', // invalid
        is_hall_ticket: true,
      };

      const result = validateAndSanitizeExtraction(raw);

      expect(result.ambiguous_fields).toContain('course_name');
      expect(result.ambiguous_fields).toContain('exam_date');
      expect(result.ambiguous_fields).toContain('reporting_time');
      expect(result.ambiguous_fields).toContain('pincode');
      expect(result.confidence_score).toBeLessThan(50);
    });

    it('rejects non-hall-ticket documents gracefully', () => {
      const raw = {
        is_hall_ticket: false,
        notes: 'Document is a college ID card, not an NPTEL admit card.',
      };

      const result = validateAndSanitizeExtraction(raw);

      expect(result.is_hall_ticket).toBe(false);
      expect(result.notes).toContain('college ID');
    });
  });

  describe('2. Image Validation, Security and In-Memory Handling', () => {
    it('rejects unsupported image MIME types', async () => {
      await expect(
        processHallTicketExtraction('sample_base64_data', 'application/pdf')
      ).rejects.toThrow('Unsupported image format: application/pdf');

      await expect(
        processHallTicketExtraction('sample_base64_data', 'text/plain')
      ).rejects.toThrow('Unsupported image format: text/plain');
    });

    it('rejects files exceeding 5MB payload size', async () => {
      // 8MB base64 string
      const largeBase64 = 'A'.repeat(8 * 1024 * 1024);
      await expect(
        processHallTicketExtraction(largeBase64, 'image/jpeg')
      ).rejects.toThrow('Image size exceeds 5MB limit');
    });

    it('handles blank / empty image payload safely with zero storage leakage', async () => {
      const tinyBase64 = 'AAAA'; // length < 100
      const result = await processHallTicketExtraction(tinyBase64, 'image/png');

      expect(result.is_hall_ticket).toBe(false);
      expect(result.notes).toContain('Image is unreadable or empty');
      expect(result.ambiguous_fields).toContain('course_name');
    });
  });

  describe('3. AI Course Deduplication and Matcher Fallback', () => {
    it('returns NONE confidence when query is too short', async () => {
      const result = await processAiCourseMatch('A', [
        { id: '1', name: 'Deep Learning', code: 'noc24-cs101' },
      ]);

      expect(result.confidence).toBe('NONE');
      expect(result.matchedCourseId).toBeNull();
    });

    it('returns NONE confidence when candidate list is empty', async () => {
      const result = await processAiCourseMatch('Machine Learning', []);

      expect(result.confidence).toBe('NONE');
      expect(result.matchedCourseId).toBeNull();
    });
  });

  describe('4. Rate Limiting, Retries, Timeout, and Failure Resilience', () => {
    const validBase64 = 'data:image/png;base64,' + 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg=='.repeat(3);

    const mockSuccessResponse = {
      ok: true,
      status: 200,
      json: async () => ({
        candidates: [{
          content: {
            parts: [{
              text: JSON.stringify({
                course_name: 'Database Management Systems',
                course_code: 'noc24-cs33',
                candidate_name: 'SRM AP Student',
                reg_no: 'AP25110010001',
                exam_date: '2026-10-25',
                reporting_time: '07:30',
                exam_start_time: '09:00',
                shift: 'FN',
                centre_name: 'iON Digital Zone iDZ Patamata',
                centre_address: 'Patamata Road',
                city: 'Vijayawada',
                state: 'Andhra Pradesh',
                pincode: '520010',
                is_hall_ticket: true,
                ambiguous_fields: [],
                confidence_score: 95,
              })
            }]
          }
        }]
      })
    };

    afterEach(() => {
      vi.restoreAllMocks();
    });

    it('recovers transparently from a transient HTTP 429 rate limit on retry', async () => {
      let callCount = 0;
      globalThis.fetch = vi.fn().mockImplementation(async () => {
        callCount++;
        if (callCount === 1) {
          return {
            ok: false,
            status: 429,
            statusText: 'Too Many Requests',
            json: async () => ({ error: { message: 'Quota exceeded' } }),
          };
        }
        return mockSuccessResponse;
      });

      const result = await processHallTicketExtraction(validBase64, 'image/png', 'test-api-key');
      expect(callCount).toBe(2);
      expect(result.course_name).toBe('Database Management Systems');
      expect(result.shift).toBe('FN');
      expect(result.confidence_score).toBe(100);
    });

    it('recovers from transient HTTP 503 Service Unavailable on retry', async () => {
      let callCount = 0;
      globalThis.fetch = vi.fn().mockImplementation(async () => {
        callCount++;
        if (callCount === 1) {
          return {
            ok: false,
            status: 503,
            statusText: 'Service Unavailable',
            json: async () => ({ error: { message: 'Backend unavailable' } }),
          };
        }
        return mockSuccessResponse;
      });

      const result = await processHallTicketExtraction(validBase64, 'image/png', 'test-api-key');
      expect(callCount).toBe(2);
      expect(result.course_name).toBe('Database Management Systems');
    });

    it('exhausts retries and returns actionable rate limit error when 429 persists', async () => {
      let callCount = 0;
      globalThis.fetch = vi.fn().mockImplementation(async () => {
        callCount++;
        return {
          ok: false,
          status: 429,
          statusText: 'Too Many Requests',
          json: async () => ({ error: { message: 'Resource exhausted' } }),
        };
      });

      await expect(
        processHallTicketExtraction(validBase64, 'image/png', 'test-api-key')
      ).rejects.toThrow(/rate limit or quota exceeded/i);

      expect(callCount).toBe(3); // 1 initial + 2 retries
    });

    it('handles network request timeout (AbortError) with clear user guidance', async () => {
      globalThis.fetch = vi.fn().mockImplementation(async () => {
        const err = new Error('The operation was aborted');
        err.name = 'AbortError';
        throw err;
      });

      await expect(
        processHallTicketExtraction(validBase64, 'image/png', 'test-api-key')
      ).rejects.toThrow(/timed out after 12s\. Please enter details manually/i);
    });

    it('fails immediately without retrying on HTTP 401/403 authentication errors', async () => {
      let callCount = 0;
      globalThis.fetch = vi.fn().mockImplementation(async () => {
        callCount++;
        return {
          ok: false,
          status: 403,
          statusText: 'Forbidden',
          json: async () => ({ error: { message: 'API key not valid' } }),
        };
      });

      await expect(
        processHallTicketExtraction(validBase64, 'image/png', 'invalid-key')
      ).rejects.toThrow(/AI authentication error/i);

      expect(callCount).toBe(1); // Fast-fail, no retry
    });

    it('gracefully falls back when course matcher encounters 429 rate limit', async () => {
      const prevKey = process.env.GEMINI_API_KEY;
      process.env.GEMINI_API_KEY = 'test-key';
      try {
        globalThis.fetch = vi.fn().mockImplementation(async () => ({
          ok: false,
          status: 429,
          statusText: 'Too Many Requests',
          json: async () => ({ error: { message: 'Rate limited' } }),
        }));

        const result = await processAiCourseMatch('Machine Learning', [
          { id: 'c1', name: 'Introduction to Machine Learning', code: 'MOOC 495' }
        ]);

        expect(result.confidence).toBe('NONE');
        expect(result.matchedCourseId).toBeNull();
        expect(result.reason).toBe('AI matching unavailable');
      } finally {
        if (prevKey) process.env.GEMINI_API_KEY = prevKey;
        else delete process.env.GEMINI_API_KEY;
      }
    });

    it('allows complete manual selection fallback against official catalogue when AI extraction fails', () => {
      const officialCourses = [
        { id: 'srm-mooc-495', name: 'INTRODUCTION TO MACHINE LEARNING', code: 'MOOC 495' },
        { id: 'srm-mooc-511', name: 'DEEP LEARNING', code: 'MOOC 511' },
      ];

      // Student enters course title with omitted prefix "Introduction to"
      const fuzzyResolution = resolveCanonicalCourseMatch(
        { title: 'Machine Learning', code: '' },
        officialCourses as any
      );
      expect(fuzzyResolution.status).toBe('AMBIGUOUS');
      expect(fuzzyResolution.suggestion?.course.id).toBe('srm-mooc-495');
      expect(fuzzyResolution.candidates[0].course.name).toBe('INTRODUCTION TO MACHINE LEARNING');

      // Student selects exact course from catalogue dropdown
      const exactResolution = resolveCanonicalCourseMatch(
        { title: 'INTRODUCTION TO MACHINE LEARNING', code: 'MOOC 495' },
        officialCourses as any
      );
      expect(exactResolution.status).toBe('EXACT');
      expect(exactResolution.matchedCourse?.id).toBe('srm-mooc-495');
    });
  });
});
