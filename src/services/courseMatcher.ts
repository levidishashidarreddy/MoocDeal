import { Course } from '../types';

/**
 * Normalizes course title for deterministic matching:
 * - Lowercases
 * - Removes special characters and punctuation
 * - Collapses multiple spaces
 */
export function normalizeCourseText(text: string): string {
  if (!text) return '';
  return text
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9 ]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Normalizes course code (e.g., "noc24-cs101" -> "noc24cs101" / "cs101")
 */
export function normalizeCourseCode(code: string): string {
  if (!code) return '';
  return code.toLowerCase().trim().replace(/[^a-z0-9]/g, '');
}

/**
 * Levenshtein distance between two strings
 */
export function levenshteinDistance(a: string, b: string): number {
  const m = a.length;
  const n = b.length;
  if (m === 0) return n;
  if (n === 0) return m;

  const dp: number[][] = Array.from({ length: m + 1 }, () => Array(n + 1).fill(0));

  for (let i = 0; i <= m; i++) dp[i][0] = i;
  for (let j = 0; j <= n; j++) dp[0][j] = j;

  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      dp[i][j] = Math.min(
        dp[i - 1][j] + 1,      // deletion
        dp[i][j - 1] + 1,      // insertion
        dp[i - 1][j - 1] + cost // substitution
      );
    }
  }

  return dp[m][n];
}

/**
 * Levenshtein ratio (0.0 to 1.0)
 */
export function levenshteinRatio(a: string, b: string): number {
  if (!a && !b) return 1.0;
  if (!a || !b) return 0.0;
  const maxLen = Math.max(a.length, b.length);
  if (maxLen === 0) return 1.0;
  const dist = levenshteinDistance(a, b);
  return Math.max(0, 1 - dist / maxLen);
}

/**
 * Token overlap / Jaccard similarity between two strings
 */
export function tokenOverlapRatio(a: string, b: string): number {
  const tokensA = new Set(a.split(' ').filter(Boolean));
  const tokensB = new Set(b.split(' ').filter(Boolean));

  if (tokensA.size === 0 && tokensB.size === 0) return 1.0;
  if (tokensA.size === 0 || tokensB.size === 0) return 0.0;

  let intersectionCount = 0;
  for (const token of tokensA) {
    if (tokensB.has(token)) {
      intersectionCount++;
    } else {
      // Check for minor token typos (e.g. "computng" vs "computing")
      for (const tB of tokensB) {
        if (levenshteinRatio(token, tB) >= 0.8) {
          intersectionCount += 0.85;
          break;
        }
      }
    }
  }

  const unionSize = tokensA.size + tokensB.size - Math.floor(intersectionCount);
  return unionSize > 0 ? intersectionCount / unionSize : 0;
}

export type MatchConfidence = 'EXACT' | 'CODE_MATCH' | 'STRONG_FUZZY' | 'MODERATE_FUZZY' | 'CODE_CONFLICT' | 'WEAK';

export interface CourseMatchResult {
  course: Course;
  score: number; // 0.0 to 1.0
  confidence: MatchConfidence;
  isStrongMatch: boolean;
  matchReason: string;
}

export interface CanonicalCourseResolution {
  status: 'EXACT' | 'HIGH_CONFIDENCE' | 'AMBIGUOUS' | 'CODE_CONFLICT' | 'NO_MATCH';
  matchedCourse: Course | null;
  suggestion: {
    course: Course;
    text: string;
  } | null;
  candidates: CourseMatchResult[];
  reason: string;
}

/**
 * Checks whether two course codes explicitly conflict (e.g., cs101 vs cs102).
 * Returns false if one is missing, generic, or if one is a clean substring/suffix of the other.
 */
export function areCourseCodesConflicting(codeA: string, codeB: string): boolean {
  const cleanA = normalizeCourseCode(codeA);
  const cleanB = normalizeCourseCode(codeB);
  if (!cleanA || !cleanB) return false;
  // If one is generic noc prefix like 'noc24' without course identifier, not a conflict
  if (cleanA === 'noc24' || cleanB === 'noc24' || cleanA === 'noc' || cleanB === 'noc') return false;
  if (cleanA === cleanB) return false;
  if (cleanA.endsWith(cleanB) || cleanB.endsWith(cleanA)) return false;

  // Cross-namespace check: NPTEL NOC code (e.g. noc24-cs101) vs University MOOC number (e.g. mooc495)
  const isAUniversityMooc = cleanA.startsWith('mooc') || /^\d+$/.test(cleanA);
  const isBUniversityMooc = cleanB.startsWith('mooc') || /^\d+$/.test(cleanB);
  const isANptelNoc = cleanA.startsWith('noc');
  const isBNptelNoc = cleanB.startsWith('noc');

  if ((isAUniversityMooc && isBNptelNoc) || (isBUniversityMooc && isANptelNoc)) {
    // Different identifier systems: NPTEL national admit card code vs SRM AP university catalogue MOOC number.
    // They do not conflict; match resolution relies on the canonical course title.
    return false;
  }

  return true;
}

/**
 * Calculates a comprehensive match score between user query and candidate course
 */
export function calculateCourseMatch(
  query: string | { title: string; code?: string },
  candidate: Course
): CourseMatchResult {
  const queryTitle = typeof query === 'string' ? query : query.title;
  const queryCode = typeof query === 'object' && query.code ? query.code : '';

  const normQuery = normalizeCourseText(queryTitle);
  const normCandName = normalizeCourseText(candidate.name);
  const cleanCodeQuery = normalizeCourseCode(queryCode || (typeof query === 'string' ? query : ''));
  const cleanCandCode = normalizeCourseCode(candidate.code);

  // 0. Check explicit course code conflict
  if (queryCode && candidate.code && areCourseCodesConflicting(queryCode, candidate.code)) {
    return {
      course: candidate,
      score: 0.35,
      confidence: 'CODE_CONFLICT',
      isStrongMatch: false,
      matchReason: `Conflicting official course codes (${candidate.code} vs ${queryCode})`,
    };
  }

  // 1. Exact normalized name match
  if (normQuery && normQuery === normCandName) {
    return {
      course: candidate,
      score: 1.0,
      confidence: 'EXACT',
      isStrongMatch: true,
      matchReason: 'Exact title match',
    };
  }

  // 2. Exact code match (e.g. "noc24-cs101" or "cs101" or "bt79")
  if (cleanCodeQuery && (cleanCandCode === cleanCodeQuery || cleanCandCode.endsWith(cleanCodeQuery) || cleanCodeQuery.endsWith(cleanCandCode))) {
    return {
      course: candidate,
      score: 0.98,
      confidence: 'CODE_MATCH',
      isStrongMatch: true,
      matchReason: `Matches official course code (${candidate.code})`,
    };
  }

  // 3. High-confidence spelling similarity (Levenshtein ratio >= 0.84)
  // e.g. "Human Physilogy" vs "Human Physiology" (ratio ~0.94)
  const levScore = levenshteinRatio(normQuery, normCandName);
  const tokenScore = tokenOverlapRatio(normQuery, normCandName);
  const compositeScore = Math.max(levScore, tokenScore * 0.7 + levScore * 0.3);

  if (compositeScore >= 0.84) {
    return {
      course: candidate,
      score: Math.round(compositeScore * 100) / 100,
      confidence: 'STRONG_FUZZY',
      isStrongMatch: true,
      matchReason: 'High-confidence spelling similarity',
    };
  }

  // 4. Substring / Omitted words match (e.g. "Machine Learning" inside "Introduction to Machine Learning")
  if (normCandName.includes(normQuery) && normQuery.length >= 4) {
    const ratio = normQuery.length / normCandName.length;
    // If significantly shorter (omitted leading words like "Introduction to"), it requires confirmation
    const isShortenedOmission = ratio < 0.75;
    const score = 0.75 + ratio * 0.15;
    return {
      course: candidate,
      score: Math.round(score * 100) / 100,
      confidence: isShortenedOmission ? 'MODERATE_FUZZY' : 'STRONG_FUZZY',
      isStrongMatch: !isShortenedOmission,
      matchReason: isShortenedOmission
        ? 'Shortened title: candidate match requiring confirmation'
        : 'Substring of canonical course',
    };
  }

  if (normQuery.includes(normCandName) && normCandName.length >= 4) {
    const ratio = normCandName.length / normQuery.length;
    const isExtraWords = ratio < 0.75;
    const score = 0.72 + ratio * 0.15;
    return {
      course: candidate,
      score: Math.round(score * 100) / 100,
      confidence: isExtraWords ? 'MODERATE_FUZZY' : 'STRONG_FUZZY',
      isStrongMatch: !isExtraWords,
      matchReason: isExtraWords
        ? 'Extended title: candidate match requiring confirmation'
        : 'Covers canonical course title',
    };
  }

  // 4b. Word-level fuzzy similarity (handles typos in individual query words against candidate words)
  // e.g. "renewabel" vs "renewable", "machne" vs "machine", "physilogy" vs "physiology"
  const qWords = normQuery.split(' ').filter(w => w.length >= 3);
  const cWords = normCandName.split(' ').filter(w => w.length >= 3);
  if (qWords.length > 0 && cWords.length > 0) {
    let matchedWordCount = 0;
    let totalWordSim = 0;
    for (const qw of qWords) {
      let maxSimForQw = 0;
      for (const cw of cWords) {
        if (cw === qw) {
          maxSimForQw = 1.0;
          break;
        }
        if (cw.includes(qw) || qw.includes(cw)) {
          const subSim = Math.min(qw.length, cw.length) / Math.max(qw.length, cw.length);
          if (subSim > maxSimForQw) maxSimForQw = Math.max(0.75, subSim);
        }
        const sim = levenshteinRatio(qw, cw);
        if (sim > maxSimForQw) maxSimForQw = sim;
      }
      if (maxSimForQw >= 0.72) {
        matchedWordCount++;
        totalWordSim += maxSimForQw;
      }
    }
    if (matchedWordCount > 0) {
      const avgSim = totalWordSim / qWords.length;
      if (matchedWordCount === qWords.length && avgSim >= 0.75) {
        const fuzzyScore = 0.65 + avgSim * 0.20;
        if (fuzzyScore > compositeScore) {
          return {
            course: candidate,
            score: Math.round(fuzzyScore * 100) / 100,
            confidence: fuzzyScore >= 0.80 ? 'STRONG_FUZZY' : 'MODERATE_FUZZY',
            isStrongMatch: avgSim >= 0.90 && qWords.length === cWords.length,
            matchReason: 'Word-level spelling match with canonical course',
          };
        }
      }
    }
  }

  // 5. Moderate token overlap (e.g. > 0.50)
  if (compositeScore >= 0.50) {
    return {
      course: candidate,
      score: Math.round(compositeScore * 100) / 100,
      confidence: 'MODERATE_FUZZY',
      isStrongMatch: false,
      matchReason: 'Similar course title',
    };
  }

  return {
    course: candidate,
    score: Math.round(compositeScore * 100) / 100,
    confidence: 'WEAK',
    isStrongMatch: false,
    matchReason: 'Partial match',
  };
}

/**
 * Searches and ranks courses matching a user query with autocomplete support
 */
export function searchAndRankCourses(
  query: string | { title: string; code?: string },
  courses: Course[],
  options: { minScore?: number; limit?: number } = {}
): CourseMatchResult[] {
  const minScore = options.minScore ?? 0.35;
  const limit = options.limit ?? 8;
  const qTitle = typeof query === 'string' ? query : query.title;
  const qCode = typeof query === 'object' && query.code ? query.code : '';

  if (!qTitle?.trim() && !qCode?.trim()) {
    return courses.slice(0, limit).map(c => ({
      course: c,
      score: 1.0,
      confidence: 'EXACT',
      isStrongMatch: false,
      matchReason: 'Catalogue course',
    }));
  }

  const results: CourseMatchResult[] = [];

  for (const course of courses) {
    const match = calculateCourseMatch(query, course);
    if (match.score >= minScore) {
      results.push(match);
    }
  }

  results.sort((a, b) => b.score - a.score);
  return results.slice(0, limit);
}

/**
 * Detects if a new course creation would be a duplicate of an existing canonical course
 */
export function findDuplicateCourseWarning(
  query: string | { title: string; code?: string },
  courses: Course[]
): CourseMatchResult | null {
  const matches = searchAndRankCourses(query, courses, { minScore: 0.80, limit: 1 });
  if (matches.length > 0 && matches[0].isStrongMatch) {
    return matches[0];
  }
  return null;
}

/**
 * Unified shared resolution service used by both hall-ticket and manual flows.
 * Never creates duplicate canonical records when an existing course matches.
 */
export function resolveCanonicalCourseMatch(
  query: string | { title: string; code?: string },
  catalogue: Course[]
): CanonicalCourseResolution {
  const queryObj = typeof query === 'string' ? { title: query } : query;
  const title = (queryObj.title || '').trim();
  const code = (queryObj.code || '').trim();

  if (!title && !code) {
    return {
      status: 'NO_MATCH',
      matchedCourse: null,
      suggestion: null,
      candidates: [],
      reason: 'Empty query',
    };
  }

  const candidates = searchAndRankCourses({ title, code }, catalogue, { minScore: 0.35, limit: 6 });

  if (candidates.length === 0) {
    return {
      status: 'NO_MATCH',
      matchedCourse: null,
      suggestion: null,
      candidates: [],
      reason: 'No matching courses found in catalogue',
    };
  }

  const top = candidates[0];

  // 1. Explicit code conflict
  if (top.confidence === 'CODE_CONFLICT') {
    return {
      status: 'CODE_CONFLICT',
      matchedCourse: null,
      suggestion: null,
      candidates,
      reason: top.matchReason,
    };
  }

  // 2. Exact normalized match
  if (top.confidence === 'EXACT') {
    return {
      status: 'EXACT',
      matchedCourse: top.course,
      suggestion: null,
      candidates,
      reason: top.matchReason,
    };
  }

  // 3. Official code match
  if (top.confidence === 'CODE_MATCH') {
    return {
      status: 'EXACT',
      matchedCourse: top.course,
      suggestion: null,
      candidates,
      reason: top.matchReason,
    };
  }

  // 4. High-confidence spelling similarity (e.g. "Human Physilogy" -> Human Physiology BT79)
  if (top.confidence === 'STRONG_FUZZY' && top.isStrongMatch) {
    return {
      status: 'HIGH_CONFIDENCE',
      matchedCourse: top.course,
      suggestion: {
        course: top.course,
        text: `Did you mean ${top.course.name} (${top.course.code})?`,
      },
      candidates,
      reason: `High-confidence match for ${top.course.name}`,
    };
  }

  // 5. Ambiguous / Partial / Omitted words (e.g. "Machine Learning" vs "Introduction to Machine Learning")
  return {
    status: 'AMBIGUOUS',
    matchedCourse: null,
    suggestion: {
      course: top.course,
      text: `Did you mean ${top.course.name} (${top.course.code})?`,
    },
    candidates,
    reason: top.matchReason,
  };
}
