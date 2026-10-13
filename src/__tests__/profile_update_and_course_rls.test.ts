import { describe, it, expect, beforeEach } from 'vitest';
import {
  normalizeRegNo,
  normalizeText,
  dataService,
  localStore
} from '../services/dataService';
import { StudentProfile } from '../types';

const storageMap = new Map<string, string>();
const localStorageMock = {
  getItem: (key: string) => storageMap.get(key) || null,
  setItem: (key: string, value: string) => storageMap.set(key, value),
  removeItem: (key: string) => storageMap.delete(key),
  clear: () => storageMap.clear(),
};
// @ts-ignore
globalThis.localStorage = localStorageMock;

describe('Profile Updates, Student Data Synchronization & Course RLS Safety', () => {
  beforeEach(() => {
    localStorageMock.clear();
    localStore.resetToDefaults();
  });

  describe('1. Course Creation Without Hall Ticket & Deduplication', () => {
    it('creates a new course safely when no match exists', async () => {
      const course = await dataService.findOrCreateCourse({
        code: 'noc24-ai99',
        name: 'Reinforcement Learning and Control',
      });

      expect(course).toBeDefined();
      expect(course.id).toBeDefined();
      expect(course.name).toBe('Reinforcement Learning and Control');
      expect(course.normalized_name).toBe(normalizeText('Reinforcement Learning and Control'));
    });

    it('reuses existing canonical course record for case, whitespace, or punctuation variations', async () => {
      const course1 = await dataService.findOrCreateCourse({
        code: 'noc24-cs101',
        name: 'Deep Learning',
      });

      const course2 = await dataService.findOrCreateCourse({
        code: 'noc24-cs101',
        name: '  deep  learning!  ',
      });

      expect(course1.id).toBe(course2.id);
      expect(course2.name).toBe('Deep Learning');
    });

    it('generates a safe unique fallback course code if student leaves code empty', async () => {
      const course = await dataService.findOrCreateCourse({
        code: '',
        name: 'Advanced Quantum Computing',
      });

      expect(course.code).toMatch(/^noc24-[a-z0-9]+/);
      expect(course.name).toBe('Advanced Quantum Computing');
    });

    it('associates course-only student exam without fabricating venue details', async () => {
      const course = await dataService.findOrCreateCourse({
        code: 'noc24-cs102',
        name: 'Cloud Computing',
      });

      const exam = await dataService.saveStudentExam({
        student_id: 'std-test-1',
        course_id: course.id,
        centre_id: null,
        exam_date: null,
        reporting_time: null,
        status: 'PENDING_DETAILS',
      });

      expect(exam.status).toBe('PENDING_DETAILS');
      expect(exam.course_id).toBe(course.id);
      expect(exam.centre_id).toBeNull();
      expect(exam.exam_date).toBeNull();
      expect(exam.reporting_time).toBeNull();
    });
  });

  describe('2. Canonical Profile Updates & Global Synchronization', () => {
    it('updates branch, academic year, and section for the authenticated student', async () => {
      const initialStudent: StudentProfile = {
        id: 'std-sync-1',
        reg_no: 'AP25110010999',
        full_name: 'John Doe',
        branch: 'CSE',
        academic_year: '3rd Year',
        section: 'CSE C',
        phone_visible: false,
        is_admin: false,
        created_at: new Date().toISOString(),
      };

      const students = localStore.getStudents();
      students.push(initialStudent);
      localStore.saveStudents(students);
      localStore.setCurrentUser(initialStudent);

      // Perform update
      const updated = await dataService.updateProfile('std-sync-1', {
        full_name: 'Johnathan Doe',
        branch: 'AI_ML',
        academic_year: '4th Year',
        section: 'AI-A',
      });

      expect(updated.full_name).toBe('Johnathan Doe');
      expect(updated.branch).toBe('AI_ML');
      expect(updated.academic_year).toBe('4th Year');
      expect(updated.section).toBe('AI-A');
      expect(updated.reg_no).toBe('AP25110010999'); // Permanent registration number remains unchanged

      // Check current user cache in localStore
      const current = localStore.getCurrentUser();
      expect(current?.section).toBe('AI-A');
      expect(current?.branch).toBe('AI_ML');
      expect(current?.academic_year).toBe('4th Year');
      expect(current?.full_name).toBe('Johnathan Doe');
    });

    it('synchronizes updated student details into Course student lists immediately', async () => {
      const student: StudentProfile = {
        id: 'std-course-peer-1',
        reg_no: 'AP25110010888',
        full_name: 'Alice Smith',
        branch: 'ECE',
        academic_year: '2nd Year',
        section: 'ECE B',
        phone_visible: false,
        is_admin: false,
        created_at: new Date().toISOString(),
      };

      const students = localStore.getStudents();
      students.push(student);
      localStore.saveStudents(students);

      const course = await dataService.findOrCreateCourse({
        code: 'noc24-ee101',
        name: 'Digital Circuits',
      });

      await dataService.saveStudentExam({
        student_id: student.id,
        course_id: course.id,
        centre_id: null,
        status: 'PENDING_DETAILS',
      });

      // Verify initial peer view
      const beforeUpdate = await dataService.getStudentsByCourse(course.id, undefined, student.id);
      const studentBefore = beforeUpdate.students.find(s => s.profile.id === student.id);
      expect(studentBefore?.profile.section).toBe('ECE B');

      // Update student profile (e.g. from ECE B to ECE A, and 3rd Year)
      await dataService.updateProfile(student.id, {
        branch: 'ECE',
        academic_year: '3rd Year',
        section: 'ECE A',
      });

      // Fetch course peers again
      const afterUpdate = await dataService.getStudentsByCourse(course.id, undefined, student.id);
      const studentAfter = afterUpdate.students.find(s => s.profile.id === student.id);
      expect(studentAfter?.profile.section).toBe('ECE A');
      expect(studentAfter?.profile.academic_year).toBe('3rd Year');
    });

    it('synchronizes updated student details into Same Centre & Time cohort lists immediately', async () => {
      const student: StudentProfile = {
        id: 'std-cohort-peer-1',
        reg_no: 'AP25110010777',
        full_name: 'Bob Johnson',
        branch: 'CSE',
        academic_year: '3rd Year',
        section: 'CSE C',
        phone_visible: false,
        is_admin: false,
        created_at: new Date().toISOString(),
      };

      const students = localStore.getStudents();
      students.push(student);
      localStore.saveStudents(students);

      const centres = localStore.getCentres();
      const centre = centres[0];
      const course = (localStore.getCourses())[0];

      await dataService.saveStudentExam({
        student_id: student.id,
        course_id: course.id,
        centre_id: centre.id,
        exam_date: '2026-10-25',
        reporting_time: '07:30',
        exam_start_time: '09:00',
        shift: 'FN',
        status: 'CONFIRMED',
      });

      // Verify initial cohort view
      const cohortsBefore = await dataService.getCohorts(undefined, student.id);
      const myCohortBefore = cohortsBefore.find(c => c.centre_id === centre.id && c.exam_date === '2026-10-25' && c.reporting_time === '07:30');
      const memberBefore = myCohortBefore?.members?.find(m => m.student_id === student.id);
      expect(memberBefore?.student?.section).toBe('CSE C');

      // Update student section from CSE C to CSE A
      await dataService.updateProfile(student.id, {
        section: 'CSE A',
      });

      // Verify updated cohort view
      const cohortsAfter = await dataService.getCohorts(undefined, student.id);
      const myCohortAfter = cohortsAfter.find(c => c.centre_id === centre.id && c.exam_date === '2026-10-25' && c.reporting_time === '07:30');
      const memberAfter = myCohortAfter?.members?.find(m => m.student_id === student.id);
      expect(memberAfter?.student?.section).toBe('CSE A');
    });

    it('throws error when non-existent student profile ID is passed', async () => {
      await expect(
        dataService.updateProfile('std-non-existent-999', { section: 'A' })
      ).rejects.toThrow('Student profile not found');
    });
  });
});
