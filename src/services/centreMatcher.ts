import { ExamCentre } from '../types';
import { levenshteinRatio, tokenOverlapRatio } from './courseMatcher';

/**
 * Normalizes examination centre name and address for canonical matching:
 * - Lowercases and trims
 * - Normalizes ampersands ('&' -> 'and')
 * - Strips harmless punctuation (commas, periods, colons, semicolons, hyphens, slashes, brackets)
 * - Collapses spaces inside postal codes (e.g. 520 010 -> 520010)
 * - Normalizes British vs American spelling ('center' -> 'centre')
 * - Normalizes TCS iON variations ('tcs ion' -> 'ion', 'i dz' -> 'idz')
 * - Replaces common address/venue abbreviations (st, rd, ave, engg, coll, univ, nr, opp, mdl, dist, bldg, flr, apt)
 * - Collapses repeated whitespace
 */
export function normalizeCentreText(text: string): string {
  if (!text) return '';
  let norm = text
    .toLowerCase()
    .trim()
    // Replace ampersand with 'and'
    .replace(/&/g, ' and ')
    // Collapse dotted initials/acronyms (e.g. M.G. -> mg, N.H. -> nh, A.P. -> ap)
    .replace(/\b([a-z])\.(?=[a-z]|\s|$)/gi, '$1')
    // Harmless punctuation to space
    .replace(/[,./\\()\-#_:@;'"!?+*\[\]{}]/g, ' ')
    // Collapse spacing inside pincodes (e.g. 520 010 -> 520010)
    .replace(/\b(\d{3})\s+(\d{3})\b/g, '$1$2')
    // Standardize British / American spelling
    .replace(/\bcenters\b/g, 'centres')
    .replace(/\bcenter\b/g, 'centre')
    // TCS iON variations
    .replace(/\btcs\s+ion\b/g, 'ion')
    .replace(/\btcs\b/g, '')
    .replace(/\bi\s*dz\b/g, 'idz')
    // Common address/venue abbreviations
    .replace(/\bengg\b|\beng\b/g, 'engineering')
    .replace(/\bcoll\b|\bclg\b/g, 'college')
    .replace(/\buniv\b|\buni\b/g, 'university')
    .replace(/\btech\b|\btechnol\b/g, 'technology')
    .replace(/\binst\b|\binstitute\b/g, 'institute')
    .replace(/\brd\b/g, 'road')
    .replace(/\bst\b/g, 'street')
    .replace(/\bave\b|\bav\b/g, 'avenue')
    .replace(/\bnr\b/g, 'near')
    .replace(/\bopp\b|\bopposite\b|\boppo\b/g, 'opposite')
    .replace(/\bmdl\b|\bmandal\b/g, 'mandal')
    .replace(/\bdist\b|\bdistrict\b/g, 'district')
    .replace(/\bbldg\b|\bbuilding\b/g, 'building')
    .replace(/\bflr\b|\bfloor\b/g, 'floor')
    .replace(/\bapt\b|\bapartment\b/g, 'apartment')
    .replace(/\bngr\b/g, 'nagar')
    .replace(/\bvill\b/g, 'village')
    .replace(/\bpl\b|\bplot\b/g, 'plot')
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

const GENERIC_VENUE_TOKENS = new Set([
  'ion', 'digital', 'zone', 'idz', 'test', 'exam', 'examination', 'centre', 'centres', 'center', 'centers',
  'andhra', 'pradesh', 'telangana', 'india', 'near', 'opposite', 'road', 'street', 'college', 'university',
  'engineering', 'technology', 'institute', 'campus', 'building'
]);

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
  const queryTokens = normQueryName
    .split(' ')
    .filter(t => t.length > 3 && !GENERIC_VENUE_TOKENS.has(t));
  const candTokens = normCandName
    .split(' ')
    .filter(t => t.length > 3 && !GENERIC_VENUE_TOKENS.has(t));

  const hasSpecificLocalityDifference =
    queryTokens.length > 0 &&
    candTokens.length > 0 &&
    queryTokens.some(qt => !candTokens.includes(qt)) &&
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

  // Check if candidate name is completely contained in query name (or combined paste)
  const isCandidateNameContained =
    normCandName.length >= 8 && normQueryName.includes(normCandName);
  const isQueryNameContained =
    normQueryName.length >= 8 && normCandName.includes(normQueryName);

  // If address is also provided, incorporate address similarity
  let addrScore = 0.5;
  if (normQueryAddr && normCandAddr) {
    const addrLev = levenshteinRatio(normQueryAddr, normCandAddr);
    const addrTokens = tokenOverlapRatio(normQueryAddr, normCandAddr);
    addrScore = Math.max(addrLev, addrTokens);
  } else if (!normQueryAddr && (isCandidateNameContained || isQueryNameContained)) {
    // If query did not have address, but name contains candidate name
    addrScore = 0.8;
  }

  // Pincode validation: If both specify pincodes
  let pincodeBonus = 0;
  if (query.pincode && candidate.pincode) {
    const qPin = query.pincode.replace(/\D/g, '');
    const cPin = candidate.pincode.replace(/\D/g, '');
    if (qPin.length === 6 && cPin.length === 6) {
      if (qPin === cPin) {
        pincodeBonus = 0.1;
      } else {
        // Different pincodes in the same city means different physical postal zones!
        if (nameLev < 0.95) {
          return {
            centre: candidate,
            score: 0.4,
            confidence: 'MODERATE_FUZZY',
            isStrongMatch: false,
            matchReason: `Different postal zones: ${qPin} vs ${cPin}`,
          };
        }
      }
    }
  }

  // Check combined text match (e.g. student pasted full admit card venue into name or address)
  const combinedQuery = `${normQueryName} ${normQueryAddr}`.trim();
  const combinedCand = `${normCandName} ${normCandAddr}`.trim();
  const combinedOverlap = tokenOverlapRatio(combinedQuery, combinedCand);

  let finalScore = Math.round((nameComposite * 0.70 + addrScore * 0.30 + pincodeBonus) * 100) / 100;
  if (combinedOverlap >= 0.85 && !hasSpecificLocalityDifference) {
    finalScore = Math.max(finalScore, Math.round(combinedOverlap * 100) / 100);
  }

  if (isCandidateNameContained && !hasSpecificLocalityDifference) {
    finalScore = Math.max(finalScore, 0.92);
  }

  if (finalScore >= 0.88 || (finalScore >= 0.82 && addrScore >= 0.85 && !hasSpecificLocalityDifference)) {
    return {
      centre: candidate,
      score: Math.min(1.0, finalScore),
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
  query: string | { name: string; address?: string; city?: string; pincode?: string },
  centres: ExamCentre[],
  city?: string,
  options: { minScore?: number; limit?: number } = {}
): CentreMatchResult[] {
  const minScore = options.minScore ?? 0.35;
  const limit = options.limit ?? 6;

  const queryObj = typeof query === 'string'
    ? { name: query, city }
    : { name: query.name, address: query.address, city: query.city || city, pincode: query.pincode };

  const queryName = (queryObj.name || '').trim();

  if (!queryName) {
    let pool = centres;
    const targetCity = queryObj.city || city;
    if (targetCity) {
      const normCity = normalizeCity(targetCity);
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
    const match = calculateCentreMatch(queryObj, centre);
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
  const matches = searchAndRankCentres(query, centres, query.city, { minScore: 0.82, limit: 1 });
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
 * Never creates duplicate canonical centre records across punctuation or casing differences.
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

  const candidates = searchAndRankCentres(query, catalogue, query.city, { minScore: 0.35, limit: 6 });
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

  if (top.isStrongMatch) {
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

export interface ParsedVenueDetails {
  name: string;
  address: string;
  city: string;
  state: string;
  pincode: string;
}

/**
 * Parses raw copied venue text from an NPTEL hall ticket
 * Automatically extracts centre name, street address, city, state, and 6-digit PIN code.
 */
export function parsePastedVenueDetails(rawText: string, defaultCity = 'Vijayawada'): ParsedVenueDetails {
  const clean = (rawText || '').trim();
  if (!clean) {
    return { name: '', address: '', city: defaultCity, state: 'Andhra Pradesh', pincode: '' };
  }

  // 1. Extract 6-digit Indian PIN code if present
  let pincode = '';
  const pinMatch = clean.match(/\b([1-9]\d{5})\b/);
  if (pinMatch) {
    pincode = pinMatch[1];
  }

  // 2. State detection
  let state = 'Andhra Pradesh';
  if (/telangana/i.test(clean)) state = 'Telangana';
  else if (/tamil\s*nadu/i.test(clean)) state = 'Tamil Nadu';
  else if (/karnataka/i.test(clean)) state = 'Karnataka';

  // 3. City detection
  let city = defaultCity;
  const knownCities = [
    'Vijayawada', 'Guntur', 'Hyderabad', 'Tirupati', 'Visakhapatnam',
    'Nellore', 'Kakinada', 'Rajahmundry', 'Warangal', 'Chennai', 'Bengaluru'
  ];
  for (const c of knownCities) {
    const rx = new RegExp(`\\b${c}\\b`, 'i');
    if (rx.test(clean)) {
      city = c;
      break;
    }
  }

  // 4. Strip common admit card field headers
  const stripped = clean
    .replace(/(?:test\s+centre\s*(?:name)?|centre\s*name|venue\s*(?:name)?|test\s*centre|venue|address)\s*:\s*/gi, '')
    .trim();

  // 5. Separate name and address
  const lines = stripped.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
  let name = '';
  let address = '';

  if (lines.length >= 2) {
    name = lines[0];
    address = lines.slice(1).join(', ');
  } else {
    const parts = stripped.split(',').map(p => p.trim()).filter(Boolean);
    if (parts.length >= 3) {
      name = parts[0];
      address = parts.slice(1).join(', ');
    } else {
      name = stripped;
      address = stripped;
    }
  }

  return {
    name: name.trim(),
    address: address.trim(),
    city,
    state,
    pincode,
  };
}
