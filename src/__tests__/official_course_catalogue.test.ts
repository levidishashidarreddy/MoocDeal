import { describe, it, expect, beforeEach, vi } from 'vitest';
import { OFFICIAL_SRMAP_COURSES } from '../data/officialCourses';
import { dataService, localStore, normalizeText } from '../services/dataService';
import {
  calculateCourseMatch,
  searchAndRankCourses,
  resolveCanonicalCourseMatch,
  normalizeCourseText,
  normalizeCourseCode,
} from '../services/courseMatcher';

describe('Official SRM University-AP MOOC Course Catalogue Feature', () => {
  beforeEach(() => {
    localStore.resetToDefaults();
    vi.restoreAllMocks();
  });

  // -------------------------------------------------------------------------
  // 1. EXTRACT AND SEED THE OFFICIAL COURSE LIST
  // -------------------------------------------------------------------------
  describe('1. Extraction and Catalogue Integrity', () => {
    it('contains exactly 91 official canonical course records from the university PDF', () => {
      expect(OFFICIAL_SRMAP_COURSES.length).toBe(91);
    });

    it('preserves exact official course names and MOOC numbers without alteration', () => {
      // Test key sample records from the university document
      const ml = OFFICIAL_SRMAP_COURSES.find(c => c.code === 'MOOC 495');
      expect(ml).toBeDefined();
      expect(ml!.name).toBe('INTRODUCTION TO MACHINE LEARNING');

      const renewable = OFFICIAL_SRMAP_COURSES.find(c => c.code === 'MOOC 529');
      expect(renewable).toBeDefined();
      expect(renewable!.name).toBe('RENEWABLE ENERGY SOURCES: FUNDAMENTALS AND TECHNOLOGIES');

      const drone = OFFICIAL_SRMAP_COURSES.find(c => c.name === 'DRONE SYSTEMS AND CONTROL');
      expect(drone).toBeDefined();
      expect(drone!.code).toBe('MOOC 506');

      const cellBio = OFFICIAL_SRMAP_COURSES.find(c => c.name === 'INTRODUCTION TO CELL BIOLOGY');
      expect(cellBio).toBeDefined();
      expect(cellBio!.code).toBe('MOOC 506');

      const sliding = OFFICIAL_SRMAP_COURSES.find(c => c.name === 'SLIDING MODE CONTROL AND APPLICATIONS');
      expect(sliding).toBeDefined();
      expect(sliding!.code).toBe('MOOC 505');

      const humanPhys = OFFICIAL_SRMAP_COURSES.find(c => c.name === 'HUMAN PHYSIOLOGY');
      expect(humanPhys).toBeDefined();
      expect(humanPhys!.code).toBe('MOOC 505');
    });

    it('assigns deterministic RFC-4122 v4 UUID identifiers to all canonical courses', () => {
      const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
      const idSet = new Set<string>();

      for (const course of OFFICIAL_SRMAP_COURSES) {
        expect(course.id).toMatch(uuidRegex);
        expect(idSet.has(course.id)).toBe(false);
        idSet.add(course.id);
      }

      expect(idSet.size).toBe(91);
    });

    it('handles shared MOOC numbers across different departments without data collisions', () => {
      // MOOC 505 is used for both 'SLIDING MODE CONTROL AND APPLICATIONS' and 'HUMAN PHYSIOLOGY'
      const mooc505Courses = OFFICIAL_SRMAP_COURSES.filter(c => c.code === 'MOOC 505');
      expect(mooc505Courses.length).toBe(2);
      expect(mooc505Courses[0].id).not.toBe(mooc505Courses[1].id);

      // MOOC 506 is used for both 'DRONE SYSTEMS AND CONTROL' and 'INTRODUCTION TO CELL BIOLOGY'
      const mooc506Courses = OFFICIAL_SRMAP_COURSES.filter(c => c.code === 'MOOC 506');
      expect(mooc506Courses.length).toBe(2);
      expect(mooc506Courses[0].id).not.toBe(mooc506Courses[1].id);
    });
  });

  // -------------------------------------------------------------------------
  // 2. COURSE AUTOCOMPLETE FOR MANUAL ENTRY
  // -------------------------------------------------------------------------
  describe('2. Course Autocomplete & Dynamic Suggestions', () => {
    it('suggests official course when student types lowercase partial name: "renewable"', () => {
      const results = searchAndRankCourses('renewable', OFFICIAL_SRMAP_COURSES);
      expect(results.length).toBeGreaterThan(0);
      expect(results[0].course.code).toBe('MOOC 529');
      expect(results[0].course.name).toBe('RENEWABLE ENERGY SOURCES: FUNDAMENTALS AND TECHNOLOGIES');
    });

    it('suggests official course when student types mixed case: "Renewable Energy"', () => {
      const results = searchAndRankCourses('Renewable Energy', OFFICIAL_SRMAP_COURSES);
      expect(results.length).toBeGreaterThan(0);
      expect(results[0].course.code).toBe('MOOC 529');
      expect(results[0].course.name).toBe('RENEWABLE ENERGY SOURCES: FUNDAMENTALS AND TECHNOLOGIES');
    });

    it('suggests official course when student types with extra whitespace: "   renewable   energy   "', () => {
      const results = searchAndRankCourses('   renewable   energy   ', OFFICIAL_SRMAP_COURSES);
      expect(results.length).toBeGreaterThan(0);
      expect(results[0].course.code).toBe('MOOC 529');
      expect(results[0].course.name).toBe('RENEWABLE ENERGY SOURCES: FUNDAMENTALS AND TECHNOLOGIES');
    });

    it('suggests official course when student types a minor misspelling: "renewabel"', () => {
      const results = searchAndRankCourses('renewabel', OFFICIAL_SRMAP_COURSES);
      expect(results.length).toBeGreaterThan(0);
      const matched = results.find(r => r.course.code === 'MOOC 529');
      expect(matched).toBeDefined();
    });

    it('suggests official course when student types a minor misspelling: "machne learning"', () => {
      const results = searchAndRankCourses('machne learning', OFFICIAL_SRMAP_COURSES);
      expect(results.length).toBeGreaterThan(0);
      const matched = results.find(r => r.course.code === 'MOOC 495');
      expect(matched).toBeDefined();
      expect(matched!.course.name).toBe('INTRODUCTION TO MACHINE LEARNING');
    });

    it('suggests official course by exact MOOC number: "MOOC 529" or "529"', () => {
      const byCode = searchAndRankCourses({ title: '', code: 'MOOC 529' }, OFFICIAL_SRMAP_COURSES);
      expect(byCode.length).toBeGreaterThan(0);
      expect(byCode[0].course.name).toBe('RENEWABLE ENERGY SOURCES: FUNDAMENTALS AND TECHNOLOGIES');

      const byNum = searchAndRankCourses('529', OFFICIAL_SRMAP_COURSES);
      expect(byNum.length).toBeGreaterThan(0);
      expect(byNum[0].course.code).toBe('MOOC 529');
    });

    it('ranks multiple candidates when query is broad (e.g. "management")', () => {
      const results = searchAndRankCourses('management', OFFICIAL_SRMAP_COURSES);
      expect(results.length).toBeGreaterThan(1);
      // All returned candidates should contain management in title
      for (const res of results) {
        expect(res.course.name.toLowerCase()).toContain('management');
      }
    });
  });

  // -------------------------------------------------------------------------
  // 3. ABSOLUTELY NO STUDENT-CREATED COURSES
  // -------------------------------------------------------------------------
  describe('3. Strict Prevention of Student-Created Courses', () => {
    it('rejects uncatalogued course submissions with the exact university warning message', async () => {
      const student = localStore.getStudents()[0];
      const initialCourseCount = (await dataService.getCourses()).length;

      await expect(
        dataService.findOrCreateCourse(
          {
            name: 'Non Existent Artificial Intelligence Course 999',
            code: 'NOC-FAKE-123',
          },
          { isStudent: true }
        )
      ).rejects.toThrow(
        'Course not found in the official SRM AP course list. Please check the name or contact SRM DEALINGS.'
      );

      // Verify no phantom course record was inserted into catalogue
      const coursesAfter = await dataService.getCourses();
      expect(coursesAfter.length).toBe(initialCourseCount);
    });

    it('saves exam registration using the exact canonical course ID from official catalogue', async () => {
      const student = localStore.getStudents()[0];
      const officialCourse = OFFICIAL_SRMAP_COURSES.find(c => c.code === 'MOOC 495')!;

      const exam = await dataService.saveStudentExamAtomic({
        student_id: student.id,
        course_id: officialCourse.id,
        course_name: officialCourse.name,
        course_code: officialCourse.code,
        status: 'PENDING_DETAILS',
      });

      expect(exam).toBeDefined();
      expect(exam.course_id).toBe(officialCourse.id);

      // Re-fetch from database/store to verify persistence
      const fetchedExam = await dataService.getStudentExam(student.id);
      expect(fetchedExam).toBeDefined();
      expect(fetchedExam!.course_id).toBe(officialCourse.id);
      expect(fetchedExam!.course?.name).toBe('INTRODUCTION TO MACHINE LEARNING');
      expect(fetchedExam!.course?.code).toBe('MOOC 495');
    });

    it('does not create any new WhatsApp cohort from an unmatched text entry', async () => {
      const cohortsBefore = localStore.getCohorts().length;

      await expect(
        dataService.findOrCreateCourse(
          {
            name: 'Completely Invalid Course XYZ',
            code: 'XYZ-999',
          },
          { isStudent: true }
        )
      ).rejects.toThrow(
        'Course not found in the official SRM AP course list. Please check the name or contact SRM DEALINGS.'
      );

      const cohortsAfter = localStore.getCohorts().length;
      expect(cohortsAfter).toBe(cohortsBefore);
    });
  });

  // -------------------------------------------------------------------------
  // 4. HALL-TICKET AI EXTRACTION INTEGRATION WITH CATALOGUE
  // -------------------------------------------------------------------------
  describe('4. Hall Ticket AI OCR Integration with Official Catalogue', () => {
    it('automatically associates OCR extracted course to official canonical course', () => {
      // Extracted text from admit card
      const extractedOCR = {
        course_name: 'Introduction to Machine Learning',
        course_code: 'noc24-cs101',
      };

      const resolution = resolveCanonicalCourseMatch(
        { title: extractedOCR.course_name, code: extractedOCR.course_code },
        OFFICIAL_SRMAP_COURSES
      );

      // High-confidence match against MOOC 495
      expect(resolution.matchedCourse).toBeDefined();
      expect(resolution.matchedCourse?.code).toBe('MOOC 495');
      expect(resolution.matchedCourse?.name).toBe('INTRODUCTION TO MACHINE LEARNING');
    });

    it('flags uncatalogued hall-ticket courses as ambiguous candidate for student manual selection', () => {
      const extractedOCR = {
        course_name: 'Introduction to Underwater Robotics 999',
        course_code: 'noc24-ro999',
      };

      const resolution = resolveCanonicalCourseMatch(
        { title: extractedOCR.course_name, code: extractedOCR.course_code },
        OFFICIAL_SRMAP_COURSES
      );

      expect(resolution.matchedCourse).toBeNull();
      expect(['NO_MATCH', 'AMBIGUOUS']).toContain(resolution.status);
    });
  });
});
