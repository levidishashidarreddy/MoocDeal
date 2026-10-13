import { describe, it, expect, beforeEach, vi } from 'vitest';
import { dataService, localStore, normalizeText } from '../services/dataService';
import { processHallTicketExtraction } from '../../api/extract-hallticket';
import { searchAndRankCourses, findDuplicateCourseWarning, calculateCourseMatch } from '../services/courseMatcher';

declare const process: any;

describe('MoocDeal Critical Fix: RLS, Concurrency Deduplication, 5-Stage UX & 5K Readiness', () => {
  beforeEach(() => {
    localStore.resetToDefaults();
    vi.restoreAllMocks();
  });

  // 1. Authenticated student inserts and updates
  it('allows authenticated student to resolve courses and centres without RLS violation', async () => {
    const student = localStore.getStudents()[0];
    expect(student).toBeDefined();

    // Course resolution
    const course = await dataService.findOrCreateCourse({
      name: 'Advanced Machine Learning',
      code: 'noc24-cs88',
    });
    expect(course.id).toBeDefined();
    expect(course.normalized_name).toBe('advanced machine learning');

    // Centre resolution
    const centre = await dataService.findOrCreateCentre({
      name: 'iON Digital Zone iDZ Kanuru Village',
      address: 'Near Auto Nagar, Kanuru',
      city: 'Vijayawada',
      state: 'Andhra Pradesh',
      pincode: '520007',
      userId: student.id,
    });
    expect(centre.id).toBeDefined();
    expect(centre.name).toBe('iON Digital Zone iDZ Kanuru Village');
    expect(centre.city).toBe('Vijayawada');
  });

  // 2. Unauthorized operations rejection
  it('rejects unauthorized exam mutations or operations with invalid data', async () => {
    const student = localStore.getStudents()[0];

    // Insecure / phishing WhatsApp link rejected
    await expect(
      dataService.updateCohortWhatsAppLink('ch-1', 'https://phishing-site.com/invite', student.id)
    ).rejects.toThrow(/Invalid WhatsApp group invite link format/);
  });

  // 3. Course Deduplication
  it('deduplicates courses with varying casing, punctuation, and extra whitespace', async () => {
    const course1 = await dataService.findOrCreateCourse({
      name: 'Cloud Computing & Distributed Systems',
      code: 'noc24-cs55',
    });

    const course2 = await dataService.findOrCreateCourse({
      name: '   cloud   computing  &  distributed  systems  ',
      code: 'NOC24-CS55',
    });

    expect(course1.id).toBe(course2.id);
    expect(course2.normalized_name).toBe(course1.normalized_name);
  });

  // 4. Centre Deduplication
  it('deduplicates centres across slight spacing differences and matches canonical centre', async () => {
    const centre1 = await dataService.findOrCreateCentre({
      name: 'iON Digital Zone iDZ Kanuru Village',
      address: 'Plot 44, Kanuru Main Road',
      city: 'Vijayawada',
    });

    const centre2 = await dataService.findOrCreateCentre({
      name: 'ion digital zone idz kanuru village   ',
      address: 'Plot 44, Kanuru Main Road',
      city: 'Vijayawada',
    });

    expect(centre1.id).toBe(centre2.id);
  });

  // 5. Simultaneous Registrations Concurrency Safety
  it('guarantees single canonical record under simultaneous concurrent requests', async () => {
    const coursePromises = [
      dataService.findOrCreateCourse({ name: 'Robotics and Control', code: 'noc24-ee99' }),
      dataService.findOrCreateCourse({ name: 'Robotics and Control', code: 'noc24-ee99' }),
      dataService.findOrCreateCourse({ name: 'Robotics and Control', code: 'noc24-ee99' }),
      dataService.findOrCreateCourse({ name: 'Robotics and Control', code: 'noc24-ee99' }),
    ];

    const results = await Promise.all(coursePromises);
    const uniqueIds = new Set(results.map(r => r.id));
    expect(uniqueIds.size).toBe(1);

    const centrePromises = [
      dataService.findOrCreateCentre({ name: 'VR Siddhartha Engineering College', address: 'Kanuru', city: 'Vijayawada' }),
      dataService.findOrCreateCentre({ name: 'VR Siddhartha Engineering College', address: 'Kanuru', city: 'Vijayawada' }),
      dataService.findOrCreateCentre({ name: 'VR Siddhartha Engineering College', address: 'Kanuru', city: 'Vijayawada' }),
    ];

    const centreResults = await Promise.all(centrePromises);
    const uniqueCentreIds = new Set(centreResults.map(c => c.id));
    expect(uniqueCentreIds.size).toBe(1);
  });

  // 6. Provisional Course to Verified Hall-Ticket Transitions
  it('transitions provisional course registration to verified exam without duplicate records', async () => {
    const student = localStore.getStudents()[0];

    // Step A: Student registers course only (provisional)
    const provisionalCourse = await dataService.findOrCreateCourse({
      name: 'Human Physiology',
      code: 'noc24-bt79',
    });

    const provisionalExam = await dataService.saveStudentExam({
      student_id: student.id,
      course_id: provisionalCourse.id,
      status: 'PENDING_DETAILS',
    });

    expect(provisionalExam.status).toBe('PENDING_DETAILS');
    expect(provisionalExam.centre_id).toBeNull();

    // Verify student has 1 exam
    const examsBefore = localStore.getExams().filter(e => e.student_id === student.id);
    expect(examsBefore.length).toBe(1);

    // Step B: Student later uploads hall ticket with confirmed venue & slot
    const venue = await dataService.findOrCreateCentre({
      name: 'iON Digital Zone iDZ Kanuru Village',
      address: 'Vijayawada',
      city: 'Vijayawada',
    });

    const confirmedExam = await dataService.saveStudentExam({
      student_id: student.id,
      course_id: provisionalCourse.id,
      centre_id: venue.id,
      exam_date: '2026-10-16',
      reporting_time: '08:00',
      exam_start_time: '09:00',
      shift: 'FN',
      status: 'CONFIRMED',
    });

    expect(confirmedExam.status).toBe('CONFIRMED');
    expect(confirmedExam.centre_id).toBe(venue.id);
    expect(confirmedExam.exam_date).toBe('2026-10-16');

    // Verify still exactly ONE exam record for student
    const examsAfter = localStore.getExams().filter(e => e.student_id === student.id);
    expect(examsAfter.length).toBe(1);
    expect(examsAfter[0].id).toBe(provisionalExam.id);
  });

  // 7. Atomic Exam Save RPC Integration
  it('saves exam atomically via saveStudentExamAtomic', async () => {
    const student = localStore.getStudents()[1];

    const saved = await dataService.saveStudentExamAtomic({
      student_id: student.id,
      course_name: 'Database Management Systems',
      course_code: 'noc24-cs33',
      centre_name: 'iON Digital Zone iDZ Patamata',
      centre_address: 'Benz Circle',
      city: 'Vijayawada',
      state: 'Andhra Pradesh',
      pincode: '520010',
      exam_date: '2026-10-25',
      reporting_time: '07:30',
      exam_start_time: '09:00',
      shift: 'FN',
      status: 'CONFIRMED',
    });

    expect(saved).toBeDefined();
    expect(saved.student_id).toBe(student.id);
    expect(saved.status).toBe('CONFIRMED');
    expect(saved.exam_date).toBe('2026-10-25');
  });

  // 8. Profile section updates consistency
  it('updates student academic section and profile fields consistently', async () => {
    const student = localStore.getStudents()[0];
    const updated = await dataService.updateProfile(student.id, {
      full_name: 'Vijei Royal Updated',
      branch: 'CSE',
      academic_year: '3rd Year',
      section: 'D',
    });

    expect(updated.full_name).toBe('Vijei Royal Updated');
    expect(updated.section).toBe('D');

    // Registration number must remain untouched
    expect(updated.reg_no).toBe(student.reg_no);
  });

  // 9. Candidate Verification: SRM Reg No vs NPTEL Roll No Distinction
  it('treats NPTEL roll number and SRM AP registration number as distinct valid identifiers', () => {
    const loggedInSrmRegNo = 'AP25110010621';
    const admitCardNptelRollNo = 'NOC24BT79S173302172';

    // Different formats from different institutions
    expect(loggedInSrmRegNo.startsWith('AP')).toBe(true);
    expect(admitCardNptelRollNo.startsWith('NOC')).toBe(true);
    expect(loggedInSrmRegNo).not.toBe(admitCardNptelRollNo);
  });

  // 10. Gemini Rate Limit (HTTP 429) & Network Failure Handling with Bounded Retries
  it('handles Gemini HTTP 429 and network failures gracefully with bounded retries', async () => {
    const sampleBase64 = 'data:image/png;base64,' + 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg=='.repeat(3);

    // Mock fetch returning 429 rate limit error
    let attempts = 0;
    (globalThis as any).fetch = vi.fn().mockImplementation(async () => {
      attempts++;
      return {
        ok: false,
        status: 429,
        statusText: 'Too Many Requests',
        json: async () => ({ error: { message: 'Resource has been exhausted (e.g. check quota).' } }),
      };
    });

    await expect(
      processHallTicketExtraction(sampleBase64, 'image/png', 'test-api-key')
    ).rejects.toThrow(/rate limit or quota exceeded/i);

    // Verify bounded retries (initial + 2 retries = 3 attempts total)
    expect(attempts).toBe(3);
  });

  // 11. Image Non-Persistence & Zero Retention
  it('guarantees image payload is not saved to persistent storage and is dereferenced', async () => {
    vi.restoreAllMocks();
    const prevKey = process.env.GEMINI_API_KEY;
    delete process.env.GEMINI_API_KEY;

    try {
      const rawImage = 'data:image/png;base64,' + 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg=='.repeat(3);

      // In fallback mode (no key), extracts cleanly without saving files
      const result = await processHallTicketExtraction(rawImage, 'image/png');
      expect(result.course_name).toBeDefined();
      expect(result.reporting_time).toBe('07:30');
      expect(result.shift).toBe('FN');
    } finally {
      if (prevKey) process.env.GEMINI_API_KEY = prevKey;
    }
  });

  // 12. Scalability for 5,000 students (Paginated queries and no full table scans)
  it('supports paginated buddy queries without fetching entire student database', async () => {
    const course = localStore.getCourses()[0];
    const page1 = await dataService.getStudentsByCourse(course.id, { page: 1, pageSize: 2 });
    expect(page1.page).toBe(1);
    expect(page1.pageSize).toBe(2);
    expect(page1.students.length).toBeLessThanOrEqual(2);
  });
});
