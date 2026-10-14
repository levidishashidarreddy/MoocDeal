import { describe, it, expect, beforeEach } from 'vitest';
import {
  normalizeCentreText,
  calculateCentreMatch,
  searchAndRankCentres,
  parsePastedVenueDetails,
} from '../services/centreMatcher';
import { dataService, localStore } from '../services/dataService';
import { ExamCentre } from '../types';

// Mock localStorage for node test runner
const storageMap = new Map<string, string>();
const localStorageMock = {
  getItem: (key: string) => storageMap.get(key) || null,
  setItem: (key: string, value: string) => storageMap.set(key, value),
  removeItem: (key: string) => storageMap.delete(key),
  clear: () => storageMap.clear(),
};
// @ts-ignore
globalThis.localStorage = localStorageMock;

describe('Mobile UX & Centre Matching Fixes Verification', () => {
  beforeEach(() => {
    localStorageMock.clear();
    localStore.resetToDefaults();
  });

  describe('1. Robust Centre Matching and Text Normalization', () => {
    it('normalizes capitalization, punctuation, and extra whitespace', () => {
      const a = normalizeCentreText('  iON   Digital   Zone, IDZ - Patamata!  ');
      const b = normalizeCentreText('ION DIGITAL ZONE IDZ PATAMATA');
      expect(a).toEqual(b);
    });

    it('normalizes spelling variations: "center" vs "centre", abbreviations like "st", "rd", "nr", "coll"', () => {
      const variant1 = normalizeCentreText('TCS Examination Center, M.G. Road, Nr Benz Circle');
      const variant2 = normalizeCentreText('TCS Examination Centre, MG Rd, Near Benz Circle');
      expect(variant1).toEqual(variant2);
    });

    it('matches the same physical centre across punctuation and formatting variations with high confidence', () => {
      const canonicalCentre: ExamCentre = {
        id: 'centre-patamata',
        name: 'iON Digital Zone iDZ Patamata',
        normalized_name: normalizeCentreText('iON Digital Zone iDZ Patamata'),
        address: 'Plot No 40-1-68, MG Road, Patamata',
        city: 'Vijayawada',
        state: 'Andhra Pradesh',
        pincode: '520010',
        is_verified: true,
        created_at: new Date().toISOString(),
      };

      // Case variation with different punctuation
      const query1 = {
        name: 'ION DIGITAL ZONE IDZ PATAMATA',
        address: 'Plot No. 40-1-68, M.G. Rd, Patamata',
        city: 'Vijayawada',
        pincode: '520010',
      };

      const match1 = calculateCentreMatch(query1, canonicalCentre);
      expect(match1.isStrongMatch).toBe(true);
      expect(match1.score).toBeGreaterThanOrEqual(0.75);

      // Search and rank returns it as top recommendation
      const ranked = searchAndRankCentres(query1, [canonicalCentre], 'Vijayawada');
      expect(ranked.length).toBe(1);
      expect(ranked[0].centre.id).toBe('centre-patamata');
      expect(ranked[0].isStrongMatch).toBe(true);
    });

    it('protects distinct physical centres from being falsely merged (e.g. Patamata vs Kanuru)', () => {
      const patamataCentre: ExamCentre = {
        id: 'centre-patamata',
        name: 'iON Digital Zone iDZ Patamata',
        normalized_name: normalizeCentreText('iON Digital Zone iDZ Patamata'),
        address: 'MG Road, Patamata',
        city: 'Vijayawada',
        pincode: '520010',
        is_verified: true,
        created_at: new Date().toISOString(),
      };

      const kanuruCentre: ExamCentre = {
        id: 'centre-kanuru',
        name: 'iON Digital Zone iDZ Kanuru Village',
        normalized_name: normalizeCentreText('iON Digital Zone iDZ Kanuru Village'),
        address: 'Near Dhanekula College, Kanuru Village',
        city: 'Vijayawada',
        pincode: '520007',
        is_verified: true,
        created_at: new Date().toISOString(),
      };

      const match = calculateCentreMatch(
        { name: kanuruCentre.name, address: kanuruCentre.address, city: 'Vijayawada', pincode: '520007' },
        patamataCentre
      );

      // Distinct localities must NOT be evaluated as a strong match
      expect(match.isStrongMatch).toBe(false);
      expect(match.matchReason).toContain('Different physical locality');
      expect(match.score).toBeLessThan(0.70);
    });
  });

  describe('2. Smart Hall Ticket Venue Parsing from Pasted Text', () => {
    it('parses combined venue name, address, city, state, and pincode from pasted hall ticket details', () => {
      const pasted = `iON Digital Zone iDZ Patamata
Plot No: 40-1-68, Beside Eenadu Office,
MG Road, Patamata, Vijayawada, Andhra Pradesh - 520010`;

      const parsed = parsePastedVenueDetails(pasted);
      expect(parsed.name).toContain('iON Digital Zone');
      expect(parsed.pincode).toBe('520010');
      expect(parsed.city).toBe('Vijayawada');
      expect(parsed.state).toBe('Andhra Pradesh');
      expect(parsed.address).toBeDefined();
    });

    it('parses single-line combined text with comma separation', () => {
      const pasted = 'KL University Exam Centre, Green Fields, Vaddeswaram, Guntur, Andhra Pradesh, 522502';
      const parsed = parsePastedVenueDetails(pasted);
      expect(parsed.name).toBe('KL University Exam Centre');
      expect(parsed.city).toBe('Guntur');
      expect(parsed.pincode).toBe('522502');
      expect(parsed.state).toBe('Andhra Pradesh');
    });
  });

  describe('3. Backend/DataService Duplicate Prevention (findOrCreateCentre)', () => {
    it('does not create duplicate centre records when called with casing or punctuation variations', async () => {
      const initialCentres = await dataService.getCentres();
      const initialCount = initialCentres.length;

      // Existing centre: "iON Digital Zone iDZ Patamata"
      const result1 = await dataService.findOrCreateCentre({
        name: 'ion digital zone idz patamata',
        address: 'Plot No 40-1-68, MG Road, Patamata',
        city: 'Vijayawada',
        state: 'Andhra Pradesh',
        pincode: '520010',
      });

      // Call again with uppercase and different punctuation
      const result2 = await dataService.findOrCreateCentre({
        name: 'ION DIGITAL ZONE - IDZ PATAMATA!',
        address: 'Plot No. 40-1-68, M.G. Rd, Patamata.',
        city: 'Vijayawada',
        state: 'Andhra Pradesh',
        pincode: '520010',
      });

      // Both should resolve to the exact same canonical centre ID
      expect(result1.id).toBe(result2.id);

      // And no additional centre was duplicated in the store
      const afterCentres = await dataService.getCentres();
      expect(afterCentres.length).toBe(initialCount);
    });

    it('creates a new centre only when the venue is genuinely distinct', async () => {
      const initialCentres = await dataService.getCentres();
      const initialCount = initialCentres.length;

      const newCentre = await dataService.findOrCreateCentre({
        name: 'SRM University AP Exam Lab A',
        address: 'Neerukonda, Mangalagiri Mandal',
        city: 'Amaravati',
        state: 'Andhra Pradesh',
        pincode: '522240',
      });

      expect(newCentre.id).toBeDefined();
      expect(newCentre.name).toBe('SRM University AP Exam Lab A');

      const updatedCentres = await dataService.getCentres();
      expect(updatedCentres.length).toBe(initialCount + 1);

      // Re-querying with slight variation resolves to the newly created centre without a second creation
      const duplicateAttempt = await dataService.findOrCreateCentre({
        name: 'srm university ap exam lab a',
        address: 'Neerukonda, Mangalagiri Mandal',
        city: 'Amaravati',
        state: 'Andhra Pradesh',
        pincode: '522240',
      });
      expect(duplicateAttempt.id).toBe(newCentre.id);
      const finalCentres = await dataService.getCentres();
      expect(finalCentres.length).toBe(initialCount + 1);
    });
  });

  describe('4. Mobile Dropdown Dismissal & Form UX in OnboardingModal', () => {
    const fs = require('fs');
    const path = require('path');
    const modalContent = fs.readFileSync(path.resolve(__dirname, '../components/OnboardingModal.tsx'), 'utf-8');

    it('implements global touchstart, mousedown, and Escape key dismissal for centre dropdown', () => {
      expect(modalContent).toContain("document.addEventListener('touchstart', handlePointerDown");
      expect(modalContent).toContain("document.addEventListener('mousedown', handlePointerDown");
      expect(modalContent).toContain("document.addEventListener('keydown', handleKeyDown");
      expect(modalContent).toContain("e.key === 'Escape'");
      expect(modalContent).toContain('centreDropdownRef.current');
    });

    it('prevents auto-reopen infinite loop using centreSelectedRef when user taps an existing centre', () => {
      expect(modalContent).toContain('centreSelectedRef.current = true');
      expect(modalContent).toContain('if (centreSelectedRef.current) {');
      expect(modalContent).toContain('setIsManualCentreDropdownOpen(false)');
    });

    it('contains clear hall-ticket address guidance and helper copy', () => {
      expect(modalContent).toContain(
        'Paste the exam centre name and full address exactly as printed on your hall ticket.'
      );
      expect(modalContent).toContain(
        'Copying the printed centre name and address helps find the correct existing centre and prevents duplicate entries.'
      );
    });

    it('supports smart combined venue pasting on centre name and address inputs', () => {
      expect(modalContent).toContain('onPaste={handleVenuePaste}');
      expect(modalContent).toContain('parsePastedVenueDetails(pasted)');
    });

    it('ensures comfortable mobile touch targets (h-11, min-h-[44px]) and responsive sections', () => {
      expect(modalContent).toContain('1. MOOC Course Details');
      expect(modalContent).toContain('2. Exam Schedule');
      expect(modalContent).toContain('3. Test Centre Logistics');
      expect(modalContent).toContain('min-h-[44px]');
      expect(modalContent).toContain('h-11');
    });

    it('provides prominent Continue with Manual Entry button when AI extraction fails', () => {
      expect(modalContent).toContain('Hall Ticket Extraction Notice');
      expect(modalContent).toContain('Continue with Manual Entry →');
      expect(modalContent).toContain('handleOpenManualEntry');
    });
  });
});
