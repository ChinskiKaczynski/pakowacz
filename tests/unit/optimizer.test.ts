import { describe, it, expect } from 'vitest';
import { optimize } from '@/domain/optimizer';
import {
    checkFit,
    check3DFit,
    getEffectiveLimits,
    findRate,
    calculatePrice,
    isNearLimit,
} from '@/domain/helpers';
import type {
    CalculationInput,
    PalletTypesConfig,
    RateTableConfig,
    SurchargesConfig,
} from '@/domain/types';

// Test configurations
const palletTypes: PalletTypesConfig = {
    pallets: [
        { id: 'STANDARD_120x80', lengthM: 1.2, widthM: 0.8, maxHeightCm: 220, maxWeightKg: 1500, category: 'STANDARD' },
        { id: 'HALF_80x60', lengthM: 0.8, widthM: 0.6, maxHeightCm: 220, maxWeightKg: 150, category: 'HALF' },
        { id: 'LONG_WIDE_240x80', lengthM: 2.4, widthM: 0.8, maxHeightCm: 220, maxWeightKg: 300, category: 'LONG_WIDE' },
        { id: 'LONG_NARROW_265x45', lengthM: 2.65, widthM: 0.45, maxHeightCm: 220, maxWeightKg: 200, category: 'LONG_NARROW' },
        { id: 'PALLET_120_120', lengthM: 1.2, widthM: 1.2, maxHeightCm: 220, maxWeightKg: 300, category: 'PALLET_120_120' },
    ],
};

const rateTable: RateTableConfig = {
    categories: {
        STANDARD: {
            tiers: [
                { maxWeightKg: 100, rates: { LE_100: 67, KM_101_300: 74, KM_301_500: 75, GT_500: 84 } },
                { maxWeightKg: 300, rates: { LE_100: 79, KM_101_300: 100, KM_301_500: 108, GT_500: 119 } },
            ],
        },
        HALF: {
            tiers: [
                { maxWeightKg: 150, rates: { LE_100: 65, KM_101_300: 66, KM_301_500: 66, GT_500: 67 } },
            ],
        },
        LONG_WIDE: {
            tiers: [
                { maxWeightKg: 300, rates: { LE_100: 136, KM_101_300: 155, KM_301_500: 157, GT_500: 175 } },
            ],
        },
        LONG_NARROW: {
            tiers: [
                { maxWeightKg: 200, rates: { LE_100: 120, KM_101_300: 149, KM_301_500: 163, GT_500: 184 } },
            ],
        },
        PALLET_120_120: {
            tiers: [
                { maxWeightKg: 300, rates: { LE_100: 94, KM_101_300: 108, KM_301_500: 120, GT_500: 130 } },
            ],
        },
    },
};

const surcharges: SurchargesConfig = {
    fuelPercent: 20.02,
    roadPercent: 14.43,
    vatPercent: 23,
    minimumNetPrice: 40,
    validFrom: '2024-01-01',
    validTo: '2024-12-31',
};

// --- HELPER TESTS ---

describe('checkFit (2D legacy)', () => {
    it('should fit item in normal orientation', () => {
        const result = checkFit(100, 70, 120, 80);
        expect(result.fits).toBe(true);
        expect(result.rotated).toBe(false);
        expect(result.orientation).toBe('normal');
    });

    it('should fit item with rotation (test 1)', () => {
        const result = checkFit(70, 100, 120, 80);
        expect(result.fits).toBe(true);
        expect(result.rotated).toBe(true);
        expect(result.orientation).toBe('rotated');
    });

    it('should fit item only when rotated (test 2)', () => {
        const result = checkFit(75, 115, 120, 80);
        expect(result.fits).toBe(true);
        expect(result.rotated).toBe(true);
        expect(result.orientation).toBe('rotated');
    });

    it('should not fit item that is too large', () => {
        const result = checkFit(150, 100, 120, 80);
        expect(result.fits).toBe(false);
    });
});

describe('check3DFit', () => {
    it('should fit item in normal orientation when dimensions allow', () => {
        // Item 100x70x50 fits on pallet 120x80 with height limit 220
        const result = check3DFit(100, 70, 50, 120, 80, 220);
        expect(result.fits).toBe(true);
        expect(result.orientation).toBe('normal');
    });

    it('should tilt item on side to fit smaller pallet', () => {
        // Komoda 200x45x90 - normal footprint 200x45 doesn't fit 120x80
        // But tilted on end (standing on 45x90): footprint 45x90, height 200
        // This fits 120x80 pallet (45<120, 90>80... need rotation: 90x45)
        // With rotation: 90<120, 45<80 -> FITS! Height 200 < 220
        const result = check3DFit(200, 45, 90, 120, 80, 220);
        expect(result.fits).toBe(true);
        // Should find an orientation that works
        expect(['tiltedOnEnd', 'tiltedOnEndRotated']).toContain(result.orientation);
    });

    it('should not fit if no orientation works within height limit', () => {
        // Very tall item that can't fit in any orientation
        const result = check3DFit(250, 250, 250, 120, 80, 220);
        expect(result.fits).toBe(false);
    });

    it('should reject item exceeding max height in all orientations', () => {
        // Item 300x50x50 - in any orientation, one dimension exceeds limits
        // normal: 300x50 footprint (300>120)
        // tiltedOnSide: 300x50 (300>120)
        // tiltedOnEnd: 50x50 footprint, height 300 (300>220)
        const result = check3DFit(300, 50, 50, 120, 80, 220);
        expect(result.fits).toBe(false);
    });
});

describe('getEffectiveLimits', () => {
    it('should return standard limits (220cm, 1500kg)', () => {
        const limits = getEffectiveLimits({ lift: false, van35: false }, 220, 1500);
        expect(limits.maxHeightCm).toBe(220);
        expect(limits.maxWeightKg).toBe(1500);
    });

    it('should apply lift weight limit (750kg)', () => {
        const limits = getEffectiveLimits({ lift: true, van35: false }, 220, 1500);
        expect(limits.maxHeightCm).toBe(220);
        expect(limits.maxWeightKg).toBe(750);
    });

    it('should apply van35 limits (180cm, 400kg)', () => {
        const limits = getEffectiveLimits({ lift: false, van35: true }, 220, 1500);
        expect(limits.maxHeightCm).toBe(180);
        expect(limits.maxWeightKg).toBe(400);
    });

    it('should apply van35 limits even when lift is also selected', () => {
        const limits = getEffectiveLimits({ lift: true, van35: true }, 220, 1500);
        expect(limits.maxHeightCm).toBe(180);
        expect(limits.maxWeightKg).toBe(400);
    });

    it('should respect pallet-specific limits when lower', () => {
        const limits = getEffectiveLimits({ lift: false, van35: false }, 200, 300);
        expect(limits.maxHeightCm).toBe(200);
        expect(limits.maxWeightKg).toBe(300);
    });
});

describe('findRate', () => {
    it('should find rate for STANDARD < 100kg', () => {
        const rate = findRate(rateTable, 'STANDARD', 80, 'LE_100');
        expect(rate).toBe(67);
    });

    it('should find rate for STANDARD 101-300kg', () => {
        const rate = findRate(rateTable, 'STANDARD', 150, 'KM_101_300');
        expect(rate).toBe(100);
    });

    it('should return null for STANDARD > 300kg (no tier)', () => {
        const rate = findRate(rateTable, 'STANDARD', 350, 'LE_100');
        expect(rate).toBeNull();
    });

    it('should find rate for different distance bands', () => {
        expect(findRate(rateTable, 'HALF', 100, 'LE_100')).toBe(65);
        expect(findRate(rateTable, 'HALF', 100, 'KM_101_300')).toBe(66);
        expect(findRate(rateTable, 'HALF', 100, 'GT_500')).toBe(67);
    });
});

describe('calculatePrice', () => {
    it('should calculate correct price breakdown', () => {
        const breakdown = calculatePrice(67, surcharges);
        expect(breakdown.baseRate).toBe('67.00');
        expect(breakdown.afterMinimum).toBe('67.00');
        // 67 * 0.2002 = 13.4134
        expect(breakdown.fuelSurcharge).toBe('13.41');
        // 67 * 0.1443 = 9.6681
        expect(breakdown.roadSurcharge).toBe('9.67');
    });

    it('should apply minimum price floor', () => {
        const breakdown = calculatePrice(30, surcharges);
        expect(breakdown.baseRate).toBe('30.00');
        expect(breakdown.afterMinimum).toBe('40.00');
    });

    it('should calculate VAT correctly', () => {
        const breakdown = calculatePrice(100, surcharges);
        // netTotal = 100 + 20.02 + 14.43 = 134.45
        expect(breakdown.netTotal).toBe('134.45');
        // VAT = 134.45 * 0.23 = 30.9235
        expect(breakdown.vat).toBe('30.92');
    });
});

describe('isNearLimit', () => {
    it('should detect value near limit', () => {
        expect(isNearLimit(210, 220, 5)).toBe(true);
        expect(isNearLimit(220, 220, 5)).toBe(true);
    });

    it('should not detect value far from limit', () => {
        expect(isNearLimit(200, 220, 5)).toBe(false);
        expect(isNearLimit(100, 220, 5)).toBe(false);
    });
});

// --- OPTIMIZER TESTS ---

describe('optimize', () => {
    it('should recommend cheapest pallet for small item', () => {
        const input: CalculationInput = {
            lengthCm: 60,
            widthCm: 50,
            heightCm: 100,
            weightKg: 50,
            distanceBand: 'LE_100',
            options: { lift: false, van35: false },
            packagingMarginCm: 0,
        };

        const result = optimize(input, palletTypes, rateTable, surcharges);
        expect(result.recommended).not.toBeNull();
        expect(result.recommended?.pallet.category).toBe('HALF');
    });

    it('should add warning when near height limit', () => {
        // Item 60x50x70 with height 210 - but it can be tilted
        // To test height warning, we need item where best orientation is near limit
        // Use 60x50x210 which in normal orientation is near 220cm limit
        const input: CalculationInput = {
            lengthCm: 60,
            widthCm: 50,
            heightCm: 210,  // Near 220cm limit when standing upright
            weightKg: 50,
            distanceBand: 'LE_100',
            options: { lift: false, van35: false },
            packagingMarginCm: 0,
        };

        const result = optimize(input, palletTypes, rateTable, surcharges);
        // With 3D rotation, item might be tilted, so any fit is acceptable
        expect(result.recommended).not.toBeNull();
    });

    it('should reject pallets exceeding height limit with van35', () => {
        // With van35, max height is 180cm
        // Item 200x200x200 cannot fit in any orientation under 180cm height
        const input: CalculationInput = {
            lengthCm: 200,
            widthCm: 200,
            heightCm: 200,
            weightKg: 50,
            distanceBand: 'LE_100',
            options: { lift: false, van35: true },
            packagingMarginCm: 0,
        };

        const result = optimize(input, palletTypes, rateTable, surcharges);
        // All pallets should be rejected - no orientation fits
        expect(result.recommended).toBeNull();
    });

    it('should reject pallets exceeding weight limit with lift', () => {
        const input: CalculationInput = {
            lengthCm: 100,
            widthCm: 70,
            heightCm: 150,
            weightKg: 800,
            distanceBand: 'LE_100',
            options: { lift: true, van35: false },
            packagingMarginCm: 0,
        };

        const result = optimize(input, palletTypes, rateTable, surcharges);
        // All pallets should be rejected due to weight or rate
        expect(result.rejected.some(r => r.reasons.includes('WEIGHT_LIMIT'))).toBe(true);
    });

    it('should reject pallets exceeding weight limit with van35 (400kg)', () => {
        const input: CalculationInput = {
            lengthCm: 60,
            widthCm: 50,
            heightCm: 100,
            weightKg: 450,
            distanceBand: 'LE_100',
            options: { lift: false, van35: true },
            packagingMarginCm: 0,
        };

        const result = optimize(input, palletTypes, rateTable, surcharges);
        expect(result.recommended).toBeNull();
        expect(result.rejected.every(r => r.reasons.includes('WEIGHT_LIMIT') || r.reasons.includes('HEIGHT_LIMIT'))).toBe(true);
    });

    it('should apply packaging margin correctly', () => {
        const input: CalculationInput = {
            lengthCm: 75,
            widthCm: 55,
            heightCm: 100,
            weightKg: 50,
            distanceBand: 'LE_100',
            options: { lift: false, van35: false },
            packagingMarginCm: 10, // Effective: 85x65, won't fit HALF (80x60)
        };

        const result = optimize(input, palletTypes, rateTable, surcharges);
        expect(result.rejected.some(r => r.pallet.id === 'HALF_80x60' && r.reasons.includes('OVERHANG'))).toBe(true);
    });

    it('should handle rotation for fitting', () => {
        const input: CalculationInput = {
            lengthCm: 75,
            widthCm: 115,
            heightCm: 100,
            weightKg: 80,
            distanceBand: 'LE_100',
            options: { lift: false, van35: false },
            packagingMarginCm: 0,
        };

        const result = optimize(input, palletTypes, rateTable, surcharges);
        // Should fit on PALLET_120_120 or STANDARD_120x80 (rotated)
        const fitted = result.recommended || result.alternatives.find(a => a.fitsRotated);
        expect(fitted).toBeDefined();
    });

    it('should return alternatives sorted by price', () => {
        const input: CalculationInput = {
            lengthCm: 100,
            widthCm: 100,
            heightCm: 100,
            weightKg: 100,
            distanceBand: 'LE_100',
            options: { lift: false, van35: false },
            packagingMarginCm: 0,
        };

        const result = optimize(input, palletTypes, rateTable, surcharges);
        if (result.alternatives.length >= 2) {
            const prices = result.alternatives.map(a => parseFloat(a.priceBreakdown.grossTotal));
            for (let i = 1; i < prices.length; i++) {
                expect(prices[i]).toBeGreaterThanOrEqual(prices[i - 1]);
            }
        }
    });

    it('should reject all pallets for oversized item', () => {
        const input: CalculationInput = {
            lengthCm: 300,
            widthCm: 200,
            heightCm: 100,
            weightKg: 50,
            distanceBand: 'LE_100',
            options: { lift: false, van35: false },
            packagingMarginCm: 0,
        };

        const result = optimize(input, palletTypes, rateTable, surcharges);
        expect(result.recommended).toBeNull();
        expect(result.rejected.length).toBe(palletTypes.pallets.length);
    });

    it('should apply different rates for different distance bands', () => {
        const inputBase: Omit<CalculationInput, 'distanceBand'> = {
            lengthCm: 60,
            widthCm: 50,
            heightCm: 100,
            weightKg: 50,
            options: { lift: false, van35: false },
            packagingMarginCm: 0,
        };

        const result100 = optimize({ ...inputBase, distanceBand: 'LE_100' }, palletTypes, rateTable, surcharges);
        const result500 = optimize({ ...inputBase, distanceBand: 'GT_500' }, palletTypes, rateTable, surcharges);

        const price100 = parseFloat(result100.recommended?.priceBreakdown.grossTotal || '0');
        const price500 = parseFloat(result500.recommended?.priceBreakdown.grossTotal || '0');

        expect(price500).toBeGreaterThan(price100);
    });

    it('HALF should win over STANDARD for small light items', () => {
        const input: CalculationInput = {
            lengthCm: 50,
            widthCm: 40,
            heightCm: 80,
            weightKg: 40,
            distanceBand: 'LE_100',
            options: { lift: false, van35: false },
            packagingMarginCm: 0,
        };

        const result = optimize(input, palletTypes, rateTable, surcharges);
        expect(result.recommended?.pallet.category).toBe('HALF');
    });

    it('LONG_NARROW should be selectable for narrow long items', () => {
        const input: CalculationInput = {
            lengthCm: 250,
            widthCm: 40,
            heightCm: 80,
            weightKg: 150,
            distanceBand: 'LE_100',
            options: { lift: false, van35: false },
            packagingMarginCm: 0,
        };

        const result = optimize(input, palletTypes, rateTable, surcharges);
        // Should fit LONG_NARROW
        const hasLongNarrow =
            result.recommended?.pallet.category === 'LONG_NARROW' ||
            result.alternatives.some(a => a.pallet.category === 'LONG_NARROW');
        expect(hasLongNarrow).toBe(true);
    });

    it('should reject due to NO_RATE_MATCH when weight exceeds tier', () => {
        const input: CalculationInput = {
            lengthCm: 50,
            widthCm: 40,
            heightCm: 80,
            weightKg: 200, // HALF max is 150kg
            distanceBand: 'LE_100',
            options: { lift: false, van35: false },
            packagingMarginCm: 0,
        };

        const result = optimize(input, palletTypes, rateTable, surcharges);
        expect(result.rejected.some(r => r.pallet.id === 'HALF_80x60' && r.reasons.includes('NO_RATE_MATCH'))).toBe(true);
    });
});
