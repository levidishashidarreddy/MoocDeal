import { describe, it, expect } from 'vitest';
import {
  normalizeCourseText,
  normalizeCourseCode,
  levenshteinRatio,
  tokenOverlapRatio,
  calculateCourseMatch,
  searchAndRankCourses,
  findDuplicateCourseWarning
} from '../services/courseMatcher';
import { Course } from '../types';

const mockCourses: Course[] = [
  {
    id: 'c-1',
    code: 'noc24-cs101',
    name: 'Deep Learning',
    normalized_name: 'deep learning',
    created_at: new Date().toISOString(),
  },
  {
    id: 'c-2',
    code: 'noc24-cs102',
    name: 'Cloud Computing',
    normalized_name: 'cloud computing',
    created_at: new Date().toISOString(),
  },
  {
    id: 'c-3',
    code: 'noc24-cs103',
    name: 'Problem Solving Through Programming In C',
    normalized_name: 'problem solving through programming in c',
    created_at: new Date().toISOString(),
  },
  {
    id: 'c-4',
    code: 'noc24-cs105',
    name: 'Design and Analysis of Algorithms',
    normalized_name: 'design and analysis of algorithms',
    created_at: new Date().toISOString(),
  },
];

describe('Course Autocomplete and Deduplication Engine', () => {
  it('normalizes titles by removing punctuation, casing, and redundant whitespace', () => {
    expect(normalizeCourseText('  Deep   Learning!!  ')).toBe('deep learning');
    expect(normalizeCourseText('Cloud-Computing (NPTEL)')).toBe('cloud computing nptel');
    expect(normalizeCourseText('Problem Solving, Through Programming; in C')).toBe(
      'problem solving through programming in c'
    );
  });

  it('matches exact titles regardless of case or spacing', () => {
    const match = calculateCourseMatch('   dEeP   LeArNiNg  ', mockCourses[0]);
    expect(match.score).toBe(1.0);
    expect(match.confidence).toBe('EXACT');
    expect(match.isStrongMatch).toBe(true);
  });

  it('matches course by course code or partial code', () => {
    const match1 = calculateCourseMatch('noc24-cs101', mockCourses[0]);
    expect(match1.confidence).toBe('CODE_MATCH');
    expect(match1.isStrongMatch).toBe(true);

    const match2 = calculateCourseMatch('cs101', mockCourses[0]);
    expect(match2.confidence).toBe('CODE_MATCH');
    expect(match2.isStrongMatch).toBe(true);
  });

  it('handles single and double character typographical errors via fuzzy matching', () => {
    // "Cloud Computng" has missing 'i'
    const typo1 = calculateCourseMatch('Cloud Computng', mockCourses[1]);
    expect(typo1.score).toBeGreaterThanOrEqual(0.85);
    expect(typo1.isStrongMatch).toBe(true);

    // "Depp Learning" has 'e' instead of 'ee'
    const typo2 = calculateCourseMatch('Depp Learning', mockCourses[0]);
    expect(typo2.score).toBeGreaterThanOrEqual(0.85);
    expect(typo2.isStrongMatch).toBe(true);

    // "Desing and Analysis of Algoritms"
    const typo3 = calculateCourseMatch('Desing and Analysis of Algoritms', mockCourses[3]);
    expect(typo3.score).toBeGreaterThanOrEqual(0.82);
    expect(typo3.isStrongMatch).toBe(true);
  });

  it('ranks existing canonical courses as user types (autocomplete)', () => {
    const results = searchAndRankCourses('cloud', mockCourses);
    expect(results.length).toBeGreaterThan(0);
    expect(results[0].course.code).toBe('noc24-cs102');
    expect(results[0].course.name).toBe('Cloud Computing');
  });

  it('detects strong matches to warn against creating duplicate courses', () => {
    const warn1 = findDuplicateCourseWarning('deep learning', mockCourses);
    expect(warn1).not.toBeNull();
    expect(warn1?.course.id).toBe('c-1');

    const warn2 = findDuplicateCourseWarning('Clud Computing', mockCourses);
    expect(warn2).not.toBeNull();
    expect(warn2?.course.id).toBe('c-2');

    // Truly new course should NOT trigger duplicate warning
    const warn3 = findDuplicateCourseWarning('Quantum Computing & Nanotechnology', mockCourses);
    expect(warn3).toBeNull();
  });
});
