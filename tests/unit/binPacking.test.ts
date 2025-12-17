
import { describe, it, expect } from 'vitest';
import { optimizeMultiItem } from '../../src/domain/binPacking';
import type { MultiItemInput, PalletTypesConfig, RateTableConfig } from '../../src/domain/types';

// Define explicit mocks to be independent of production config
const mockPalletTypes: PalletTypesConfig = {
    pallets: [
        {
            id: 'STANDARD',
            displayName: 'Standard',
            lengthM: 1.2,
            widthM: 0.8,
            maxHeightCm: 200,
            maxWeightKg: 1000,
            category: 'STANDARD',
        }
    ]
};

// Use as unknown as RateTableConfig because we don't want to mock every single category if we only test STANDARD
const mockRateTable = {
    categories: {
        STANDARD: {
            tiers: [
                {
                    maxWeightKg: 100,
                    rates: { LE_100: 50, KM_101_300: 60, KM_301_500: 70, GT_500: 80 }
                },
                {
                    maxWeightKg: 500,
                    rates: { LE_100: 100, KM_101_300: 120, KM_301_500: 140, GT_500: 160 }
                },
                {
                    maxWeightKg: 1500,
                    rates: { LE_100: 200, KM_101_300: 240, KM_301_500: 280, GT_500: 320 }
                }
            ]
        }
    }
} as unknown as RateTableConfig;

const mockSurcharges = {
    fuelPercent: 0,
    roadPercent: 0,
    vatPercent: 23,
    minimumNetPrice: 10,
    validFrom: '2025-01-01',
    validTo: '2025-12-31',
};

describe('Multi-Item Bin Packing', () => {
    const baseInput: MultiItemInput = {
        items: [],
        distanceBand: 'LE_100',
        options: { lift: false, van35: false },
        packagingMarginCm: 5,
    };

    const itemStandard = {
        id: '1',
        name: 'StandardItem',
        lengthCm: 100,
        widthCm: 80,
        heightCm: 100,
        weightKg: 50,
    };

    it('should fit single small item on standard pallet', () => {
        const input: MultiItemInput = {
            ...baseInput,
            items: [
                { ...itemStandard, lengthCm: 60, widthCm: 40, weightKg: 20 },
            ],
        };

        const result = optimizeMultiItem(input, mockPalletTypes, mockRateTable, mockSurcharges);

        expect(result.palletCount).toBe(1);
        expect(result.allocations[0].pallet.id).toBe('STANDARD');
        expect(result.unallocated.length).toBe(0);
    });

    it('should group 2 small items on one standard pallet', () => {
        const input: MultiItemInput = {
            ...baseInput,
            items: [
                { ...itemStandard, id: '1', lengthCm: 40, widthCm: 40, weightKg: 20 },
                { ...itemStandard, id: '2', lengthCm: 40, widthCm: 40, weightKg: 20 },
            ],
        };

        const result = optimizeMultiItem(input, mockPalletTypes, mockRateTable, mockSurcharges);

        expect(result.palletCount).toBe(1);
        expect(result.allocations[0].items.length).toBe(2);
    });

    it('should check weight limit for grouped items', () => {
        const heavyInput: MultiItemInput = {
            ...baseInput,
            items: [
                { ...itemStandard, id: '1', widthCm: 60, lengthCm: 40, weightKg: 600 },
                { ...itemStandard, id: '2', widthCm: 60, lengthCm: 40, weightKg: 600 },
            ],
        };

        const result = optimizeMultiItem(heavyInput, mockPalletTypes, mockRateTable, mockSurcharges);

        expect(result.palletCount).toBe(2);
        expect(result.allocations[0].items.length).toBe(1);
        expect(result.allocations[1].items.length).toBe(1);
    });

    it('should split large items onto separate pallets if they dont fit together', () => {
        // Items are 110x70. Margin 5cm -> 115x75.
        // Pallet 120x80.
        // One fits (115x75 < 120x80).
        // Two need ~17000 cm2. Pallet is 9600 cm2.
        // Should NOT fit together.
        const input: MultiItemInput = {
            ...baseInput,
            items: [
                { ...itemStandard, id: '1', lengthCm: 110, widthCm: 70 },
                { ...itemStandard, id: '2', lengthCm: 110, widthCm: 70 },
            ],
        };

        const result = optimizeMultiItem(input, mockPalletTypes, mockRateTable, mockSurcharges);

        if (result.palletCount !== 2) {
            console.log('Split Test Failure:', JSON.stringify(result, null, 2));
        }

        expect(result.palletCount, JSON.stringify(result, null, 2)).toBe(2);
    });
});
