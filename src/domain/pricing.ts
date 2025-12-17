import Decimal from 'decimal.js';
import type {
    PriceBreakdown,
    SurchargesConfig,
    RateTableConfig,
    RateCategory,
    DistanceBand,
    RateTier
} from './types';

/**
 * Find the applicable rate for a given category, weight, and distance
 */
export function findRate(
    rateTable: RateTableConfig,
    category: RateCategory,
    weightKg: number,
    distanceBand: DistanceBand
): number | null {
    const categoryRates = rateTable.categories[category];
    if (!categoryRates) {
        return null;
    }

    // Find the first tier where weight is within limit
    const applicableTier = categoryRates.tiers.find(
        (tier: RateTier) => weightKg <= tier.maxWeightKg
    );

    if (!applicableTier) {
        return null;
    }

    return applicableTier.rates[distanceBand] ?? null;
}

/**
 * Calculate full price breakdown using decimal.js for precision
 */
export function calculatePrice(
    baseRate: number,
    surcharges: SurchargesConfig
): PriceBreakdown {
    const base = new Decimal(baseRate);
    const minimumNet = new Decimal(surcharges.minimumNetPrice);

    // Apply minimum price floor
    const afterMinimum = Decimal.max(base, minimumNet);

    // Calculate surcharges
    const fuelRate = new Decimal(surcharges.fuelPercent).div(100);
    const roadRate = new Decimal(surcharges.roadPercent).div(100);
    const vatRate = new Decimal(surcharges.vatPercent).div(100);

    const fuelSurcharge = afterMinimum.times(fuelRate);
    const roadSurcharge = afterMinimum.times(roadRate);

    const netTotal = afterMinimum.plus(fuelSurcharge).plus(roadSurcharge);
    const vat = netTotal.times(vatRate);
    const grossTotal = netTotal.plus(vat);

    return {
        baseRate: base.toFixed(2),
        afterMinimum: afterMinimum.toFixed(2),
        fuelSurcharge: fuelSurcharge.toFixed(2),
        roadSurcharge: roadSurcharge.toFixed(2),
        netTotal: netTotal.toFixed(2),
        vat: vat.toFixed(2),
        grossTotal: grossTotal.toFixed(2),
    };
}

/**
 * Format price for display in PLN
 */
export function formatPrice(price: string): string {
    return `${price} PLN`;
}
