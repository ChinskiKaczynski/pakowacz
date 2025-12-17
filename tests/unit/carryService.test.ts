import { describe, it, expect } from 'vitest';
import { calculateCarryPrice } from '@/domain/carryService';

describe('carryService', () => {
    describe('calculateCarryPrice', () => {
        // Fixed price tiers
        it('returns 35 zł for weight ≤45 kg', () => {
            const result = calculateCarryPrice(45, 50, 40, 30);
            expect(result.available).toBe(true);
            expect(result.basePrice).toBe('35.00');
            expect(result.surcharge).toBe('0.00');
            expect(result.totalNet).toBe('35.00');
        });

        it('returns 42 zł for weight ≤60 kg', () => {
            const result = calculateCarryPrice(60, 50, 40, 30);
            expect(result.available).toBe(true);
            expect(result.basePrice).toBe('42.00');
        });

        it('returns 49 zł for weight ≤75 kg', () => {
            const result = calculateCarryPrice(75, 50, 40, 30);
            expect(result.available).toBe(true);
            expect(result.basePrice).toBe('49.00');
        });

        it('returns 57 zł for weight ≤90 kg', () => {
            const result = calculateCarryPrice(90, 50, 40, 30);
            expect(result.available).toBe(true);
            expect(result.basePrice).toBe('57.00');
        });

        // Per-kg tiers
        it('calculates 0.60 zł/kg for 91-240 kg (min 57 zł)', () => {
            // 100 kg × 0.60 = 60 zł
            const result = calculateCarryPrice(100, 50, 40, 30);
            expect(result.available).toBe(true);
            expect(result.basePrice).toBe('60.00');
        });

        it('applies minimum 57 zł for 91-240 kg tier', () => {
            // 91 kg × 0.60 = 54.60 zł, but min is 57 zł
            const result = calculateCarryPrice(91, 50, 40, 30);
            expect(result.available).toBe(true);
            expect(result.basePrice).toBe('57.00');
        });

        it('calculates 0.50 zł/kg for 241-800 kg (min 144 zł)', () => {
            // 300 kg × 0.50 = 150 zł
            const result = calculateCarryPrice(300, 50, 40, 30);
            expect(result.available).toBe(true);
            expect(result.basePrice).toBe('150.00');
        });

        it('applies minimum 144 zł for 241-800 kg tier', () => {
            // 250 kg × 0.50 = 125 zł, but min is 144 zł
            const result = calculateCarryPrice(250, 50, 40, 30);
            expect(result.available).toBe(true);
            expect(result.basePrice).toBe('144.00');
        });

        // Service not available
        it('returns not available for weight > 800 kg', () => {
            const result = calculateCarryPrice(850, 100, 100, 100);
            expect(result.available).toBe(false);
            expect(result.warnings).toHaveLength(1);
            expect(result.warnings[0]).toContain('800 kg');
        });

        // Surcharge conditions
        it('adds 60 zł surcharge for weight 100-168 kg', () => {
            const result = calculateCarryPrice(150, 50, 40, 30);
            expect(result.available).toBe(true);
            expect(result.surcharge).toBe('60.00');
            expect(result.warnings.some(w => w.includes('100-168 kg'))).toBe(true);
        });

        it('adds 60 zł surcharge when L+W+H > 400 cm', () => {
            // 150 + 150 + 150 = 450 cm > 400 cm
            const result = calculateCarryPrice(50, 150, 150, 150);
            expect(result.available).toBe(true);
            expect(result.surcharge).toBe('60.00');
            expect(result.warnings.some(w => w.includes('400 cm'))).toBe(true);
        });

        it('does NOT add surcharge for weight 99 kg', () => {
            const result = calculateCarryPrice(99, 50, 40, 30);
            expect(result.surcharge).toBe('0.00');
        });

        it('does NOT add surcharge for weight 169 kg', () => {
            const result = calculateCarryPrice(169, 50, 40, 30);
            expect(result.surcharge).toBe('0.00');
        });

        it('does NOT add surcharge when L+W+H = 400 cm exactly', () => {
            const result = calculateCarryPrice(50, 150, 150, 100);
            expect(result.surcharge).toBe('0.00');
        });

        // VAT calculation
        it('calculates VAT correctly (23%)', () => {
            const result = calculateCarryPrice(45, 50, 40, 30);
            // 35 zł × 1.23 = 43.05 zł
            expect(result.totalNet).toBe('35.00');
            expect(result.totalGross).toBe('43.05');
        });

        // Combined scenario
        it('handles surcharge + per-kg rate correctly', () => {
            // 120 kg → 0.60 × 120 = 72 zł
            // Weight surcharge: +60 zł (weight is 100-168 kg)
            // Total net: 72 + 60 = 132 zł
            // Gross: 132 × 1.23 = 162.36 zł
            const result = calculateCarryPrice(120, 50, 40, 30);
            expect(result.basePrice).toBe('72.00');
            expect(result.surcharge).toBe('60.00');
            expect(result.totalNet).toBe('132.00');
            expect(result.totalGross).toBe('162.36');
        });
    });
});
