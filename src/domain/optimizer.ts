import Decimal from 'decimal.js';
import type {
    CalculationInput,
    OptimizerResult,
    MatchResult,
    RejectedResult,
    PalletType,
    RejectionReason,
    PalletTypesConfig,
    RateTableConfig,
    SurchargesConfig,
    ItemOrientation,
} from './types';
import {
    check3DFit,
    palletDimensionsToCm,
    getEffectiveLimits,
    isNearLimit,
} from './helpers';
import { findRate, calculatePrice } from './pricing';

// Helper to get human-readable orientation description
function getOrientationLabel(orientation: ItemOrientation): string | null {
    switch (orientation) {
        case 'normal':
            return null;
        case 'rotated':
            return 'Obrócony na palecie';
        case 'tiltedOnSide':
            return 'Położony na boku';
        case 'tiltedOnSideRotated':
            return 'Na boku + obrócony';
        case 'tiltedOnEnd':
            return 'Postawiony na końcu';
        case 'tiltedOnEndRotated':
            return 'Na końcu + obrócony';
    }
}

/**
 * Main optimizer function - finds the best pallet for given item dimensions
 * Now considers 3D rotation - item can be tilted/rotated to fit better
 */
export function optimize(
    input: CalculationInput,
    palletTypes: PalletTypesConfig,
    rateTable: RateTableConfig,
    surcharges: SurchargesConfig
): OptimizerResult {
    const candidates: MatchResult[] = [];
    const rejected: RejectedResult[] = [];

    // Calculate effective item dimensions with packaging margin
    const effectiveLengthCm = input.lengthCm + input.packagingMarginCm;
    const effectiveWidthCm = input.widthCm + input.packagingMarginCm;
    const effectiveHeightCm = input.heightCm; // Height doesn't get margin

    for (const pallet of palletTypes.pallets) {
        const rejectionReasons: RejectionReason[] = [];
        const warnings: string[] = [];

        // Convert pallet dimensions to cm for comparison
        const palletCm = palletDimensionsToCm(pallet);

        // Get effective limits based on transport options
        const limits = getEffectiveLimits(
            input.options,
            pallet.maxHeightCm,
            pallet.maxWeightKg
        );

        // Check if item fits on pallet using 3D rotation
        // This considers tilting the item on its side/end to fit smaller pallets
        // Subtract pallet base height from max height limit (item + pallet must fit)
        const availableHeightCm = limits.maxHeightCm - 15; // 15cm pallet base
        const fitResult = check3DFit(
            effectiveLengthCm,
            effectiveWidthCm,
            effectiveHeightCm,
            palletCm.lengthCm,
            palletCm.widthCm,
            availableHeightCm
        );

        if (!fitResult.fits) {
            rejectionReasons.push("OVERHANG");
        }

        // Check weight limit
        if (input.weightKg > limits.maxWeightKg) {
            rejectionReasons.push("WEIGHT_LIMIT");
        } else if (isNearLimit(input.weightKg, limits.maxWeightKg)) {
            warnings.push(`Waga na styk: ${input.weightKg}kg / ${limits.maxWeightKg}kg`);
        }

        // Find applicable rate
        const rate = findRate(
            rateTable,
            pallet.category,
            input.weightKg,
            input.distanceBand
        );

        if (rate === null) {
            rejectionReasons.push("NO_RATE_MATCH");
        }

        // If any rejection reasons, add to rejected list
        if (rejectionReasons.length > 0) {
            rejected.push({
                pallet,
                reasons: rejectionReasons,
            });
            continue;
        }

        // Calculate price breakdown
        const priceBreakdown = calculatePrice(rate!, surcharges);

        candidates.push({
            pallet,
            fitsRotated: fitResult.rotated,
            orientationLabel: getOrientationLabel(fitResult.orientation),
            priceBreakdown,
            warnings,
        });
    }

    // Sort candidates by gross price (ascending)
    candidates.sort((a, b) => {
        const priceA = new Decimal(a.priceBreakdown.grossTotal);
        const priceB = new Decimal(b.priceBreakdown.grossTotal);
        return priceA.minus(priceB).toNumber();
    });

    // Extract recommended (cheapest) and alternatives
    const recommended = candidates.length > 0 ? candidates[0] : null;
    const alternatives = candidates.slice(1, 4); // Next 2-3 options

    return {
        recommended,
        alternatives,
        rejected,
    };
}

/**
 * Re-export types for convenience
 */
export type {
    CalculationInput,
    OptimizerResult,
    MatchResult,
    RejectedResult,
    PalletType,
    DistanceBand,
    RejectionReason,
    PriceBreakdown,
    PalletTypesConfig,
    RateTableConfig,
    SurchargesConfig,
} from './types';
