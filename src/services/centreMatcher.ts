import { ExamCentre } from '../types';
import { levenshteinRatio, tokenOverlapRatio } from './courseMatcher';

/**
 * Normalizes examination centre name and address for canonical matching:
 * - Lowercases and trims
 * - Replaces common address/venue abbreviations
 * - Strips harmless punctuation (commas, hyphens, periods, slashes)
 * - Collapses repeated whitespace
 */
export function normalizeCentreText(text: string): string {
  if (!text) return '';
  let norm = text
    .toLowerCase()
    .trim()
    // Harmless punctuation to space
    .replace(/[,./\\()\-#_]/g, ' ')
    // Normalize abbreviations
    .replace(/\bi\s*dz\b/g, 'idz')
    .replace(/\bengg\b|\beng\b/g, 'engineering')
    .replace(/\bcoll\b/g, 'college')
    .replace(/\buniv\b/g, 'university')
    .replace(/\brd\b/g, 'road')
    .replace(/\bst\b/g, 'street')
    .replace(/\bnr\b/g, 'near')
    .replace(/\bopp\b|\bopposite\b/g, 'opposite')
    .replace(/\s+/g, ' ')
    .trim();

  return norm;
}

/**
 * Normalizes city name (e.g. "Vijayawada ", "VIJAYAWADA" -> "vijayawada")
 */
export function normalizeCity(city: string): string {
  if (!city) return '';
  return city.toLowerCase().trim().replace(/[^a-z]/g, '');
}

export type CentreMatchConfidence = 'EXACT' | 'STRONG_FUZZY' | 'MODERATE_FUZZY' | 'CITY_MISMATCH' | 'NONE';

export interface CentreMatchResult {
  centre: ExamCentre;
  score: number; // 0.0 to 1.0
  confidence: CentreMatchConfidence;
  isStrongMatch: boolean;
  matchReason: string;
}

/**
 * Compares a user-entered or AI-extracted centre against an existing canonical centre.
 * Never merges centres across different cities or distinct physical localities.
 */
export function calculateCentreMatch(
  query: {
    name: string;
    address?: string;
    city?: string;
    pincode?: string;
  },
  candidate: ExamCentre
): CentreMatchResult {
  const normQueryName = normalizeCentreText(query.name);
  const normCandName = normalizeCentreText(candidate.name);

  // 1. City Check: If both provide city and they differ, they CANNOT be the same centre
  if (query.city && candidate.city) {
    const qCity = normalizeCity(query.city);
    const cCity = normalizeCity(candidate.city);
    if (qCity && cCity && qCity !== cCity) {
      return {
        centre: candidate,
        score: 0.0,
        confidence: 'CITY_MISMATCH',
        isStrongMatch: false,
        matchReason: `Different cities: ${query.city} vs ${candidate.city}`,
      };
    }
  }

  // 2. Exact normalized name match
  if (normQueryName && normQueryName === normCandName) {
    return {
      centre: candidate,
      score: 1.0,
      confidence: 'EXACT',
      isStrongMatch: true,
      matchReason: 'Exact venue title match',
    };
  }

  // 3. Address punctuation & format check
  const normQueryAddr = normalizeCentreText(query.address || '');
  const normCandAddr = normalizeCentreText(candidate.address || '');

  // Compare names with Levenshtein and Token overlap
  const nameLev = levenshteinRatio(normQueryName, normCandName);
  const nameTokens = tokenOverlapRatio(normQueryName, normCandName);
  const nameComposite = Math.max(nameLev, nameTokens * 0.7 + nameLev * 0.3);

  // Check key locality tokens (e.g. "patamata", "kanuru", "perecherla", "moula ali")
  // If candidates share a generic prefix ("ion digital zone") but have conflicting locality tokens, do NOT merge!
  const queryTokens = normQueryName.split(' ').filter(t => t.length > 3 && !['digital', 'zone', 'test', 'exam', 'centre', 'center'].includes(t));
  const candTokens = normCandName.split(' ').filter(t => t.length > 3 && !['digital', 'zone', 'test', 'exam', 'centre', 'center'].includes(t));

  const hasSpecificLocalityDifference = queryTokens.some(qt => !candTokens.includes(qt)) &&
                                        candTokens.some(ct => !queryTokens.includes(ct));

  if (hasSpecificLocalityDifference && nameLev < 0.90) {
    // Distinct localities (e.g. "Patamata" vs "Kanuru")
    return {
      centre: candidate,
      score: 0.45,
      confidence: 'MODERATE_FUZZY',
      isStrongMatch: false,
      matchReason: 'Different physical locality or branch',
    };
  }

  // If address is also provided, incorporate address similarity
  let addrScore = 1.0;
  if (normQueryAddr && normCandAddr) {
    const addrLev = levenshteinRatio(normQueryAddr, normCandAddr);
    addrScore = addrLev;
  }

  const finalScore = Math.round((nameComposite * 0.75 + addrScore * 0.25) * 100) / 100;

  if (finalScore >= 0.88) {
    return {
      centre: candidate,
      score: finalScore,
      confidence: 'STRONG_FUZZY',
      isStrongMatch: true,
      matchReason: 'High-confidence venue and address match',
    };
  }

  if (finalScore >= 0.60) {
    return {
      centre: candidate,
      score: finalScore,
      confidence: 'MODERATE_FUZZY',
      isStrongMatch: false,
      matchReason: 'Similar centre name in the same city',
    };
  }

  return {
    centre: candidate,
    score: finalScore,
    confidence: 'NONE',
    isStrongMatch: false,
    matchReason: 'Insufficient similarity',
  };
}

/**
 * Searches and ranks centres matching user search query with autocomplete support
 */
export function searchAndRankCentres(
  query: string,
  centres: ExamCentre[],
  city?: string,
  options: { minScore?: number; limit?: number } = {}
): CentreMatchResult[] {
  const minScore = options.minScore ?? 0.35;
  const limit = options.limit ?? 6;

  if (!query || query.trim().length === 0) {
    let pool = centres;
    if (city) {
      const normCity = normalizeCity(city);
      pool = pool.filter(c => normalizeCity(c.city) === normCity);
    }
    return pool.slice(0, limit).map(c => ({
      centre: c,
      score: 1.0,
      confidence: 'EXACT',
      isStrongMatch: false,
      matchReason: 'Catalogue centre',
    }));
  }

  const results: CentreMatchResult[] = [];

  for (const centre of centres) {
    const match = calculateCentreMatch({ name: query, city }, centre);
    if (match.score >= minScore && match.confidence !== 'CITY_MISMATCH') {
      results.push(match);
    }
  }

  results.sort((a, b) => b.score - a.score);
  return results.slice(0, limit);
}

/**
 * Detects if a newly submitted centre matches an existing canonical centre
 */
export function findDuplicateCentreMatch(
  query: { name: string; address?: string; city?: string; pincode?: string },
  centres: ExamCentre[]
): CentreMatchResult | null {
  const matches = searchAndRankCentres(query.name, centres, query.city, { minScore: 0.85, limit: 1 });
  if (matches.length > 0 && matches[0].isStrongMatch) {
    return matches[0];
  }
  return null;
}

export interface CanonicalCentreResolution {
  status: 'EXACT' | 'STRONG_FUZZY' | 'AMBIGUOUS' | 'CITY_MISMATCH' | 'NO_MATCH';
  matchedCentre: ExamCentre | null;
  suggestion: {
    centre: ExamCentre;
    text: string;
  } | null;
  candidates: CentreMatchResult[];
  reason: string;
}

/**
 * Unified shared centre resolution service used by both hall-ticket and manual flows.
 * Never creates duplicate canonical centre records across punctuation differences.
 */
export function resolveCanonicalCentreMatch(
  query: { name: string; address?: string; city?: string; pincode?: string },
  catalogue: ExamCentre[]
): CanonicalCentreResolution {
  const name = (query.name || '').trim();
  if (!name) {
    return {
      status: 'NO_MATCH',
      matchedCentre: null,
      suggestion: null,
      candidates: [],
      reason: 'Empty centre name',
    };
  }

  const candidates = searchAndRankCentres(name, catalogue, query.city, { minScore: 0.35, limit: 6 });
  if (candidates.length === 0) {
    return {
      status: 'NO_MATCH',
      matchedCentre: null,
      suggestion: null,
      candidates: [],
      reason: 'No matching centres found in catalogue',
    };
  }

  const top = candidates[0];

  if (top.confidence === 'CITY_MISMATCH') {
    return {
      status: 'CITY_MISMATCH',
      matchedCentre: null,
      suggestion: null,
      candidates,
      reason: top.matchReason,
    };
  }

  if (top.confidence === 'EXACT') {
    return {
      status: 'EXACT',
      matchedCentre: top.centre,
      suggestion: null,
      candidates,
      reason: top.matchReason,
    };
  }

  if (top.confidence === 'STRONG_FUZZY' && top.isStrongMatch) {
    return {
      status: 'STRONG_FUZZY',
      matchedCentre: top.centre,
      suggestion: {
        centre: top.centre,
        text: `Did you mean ${top.centre.name} (${top.centre.city})?`,
      },
      candidates,
      reason: top.matchReason,
    };
  }

  return {
    status: 'AMBIGUOUS',
    matchedCentre: null,
    suggestion: {
      centre: top.centre,
      text: `Did you mean ${top.centre.name} (${top.centre.city})?`,
    },
    candidates,
    reason: top.matchReason,
  };
}
