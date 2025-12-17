import Decimal from 'decimal.js';
import type {
    PalletType,
    DistanceBand,
    RateCategory,
    EffectiveLimits,
    FitResult,
} from './types';

/**
 * Orientation describes how the item is placed
 * - normal: standing upright as measured (L x W footprint, H height)
 * - rotated: rotated 90° on pallet (W x L footprint, H height)
 * - tiltedOnSide: laid on its side (L x H footprint, W height)
 * - tiltedOnSideRotated: laid on side + rotated on pallet
 * - tiltedOnEnd: standing on end (W x H footprint, L height)
 * - tiltedOnEndRotated: standing on end + rotated on pallet
 */
export type ItemOrientation =
    | 'normal'
    | 'rotated'
    | 'tiltedOnSide'
    | 'tiltedOnSideRotated'
    | 'tiltedOnEnd'
    | 'tiltedOnEndRotated';

/**
 * Check if an item fits on a pallet considering 3D rotation
 * Tries all 6 possible orientations and returns the best fit
 */
export function check3DFit(
    itemLengthCm: number,
    itemWidthCm: number,
    itemHeightCm: number,
    palletLengthCm: number,
    palletWidthCm: number,
    maxHeightCm: number,
    packagingMarginCm: number = 0 // Optional margin for footprint dimensions
): FitResult {
    // All possible orientations: [footprintL, footprintW, resultingHeight, orientation]
    // Packaging margin is applied only to footprint dimensions, NOT to height
    const orientations: [number, number, number, ItemOrientation][] = [
        // Normal standing position - L×W is footprint, H is height
        [itemLengthCm + packagingMarginCm, itemWidthCm + packagingMarginCm, itemHeightCm, 'normal'],
        [itemWidthCm + packagingMarginCm, itemLengthCm + packagingMarginCm, itemHeightCm, 'rotated'],
        // Tilted on side (laying on the L×H face) - L×H is footprint, W is height
        [itemLengthCm + packagingMarginCm, itemHeightCm + packagingMarginCm, itemWidthCm, 'tiltedOnSide'],
        [itemHeightCm + packagingMarginCm, itemLengthCm + packagingMarginCm, itemWidthCm, 'tiltedOnSideRotated'],
        // Tilted on end (standing on W×H face) - W×H is footprint, L is height
        [itemWidthCm + packagingMarginCm, itemHeightCm + packagingMarginCm, itemLengthCm, 'tiltedOnEnd'],
        [itemHeightCm + packagingMarginCm, itemWidthCm + packagingMarginCm, itemLengthCm, 'tiltedOnEndRotated'],
    ];

    for (const [footL, footW, height, orientation] of orientations) {
        if (footL <= palletLengthCm && footW <= palletWidthCm && height <= maxHeightCm) {
            return {
                fits: true,
                rotated: orientation !== 'normal',
                orientation,
            };
        }
    }

    return { fits: false, rotated: false, orientation: 'normal' };
}

/**
 * Legacy check if an item fits on a pallet, considering only 90° rotation (2D)
 * @deprecated Use check3DFit for full orientation support
 */
export function checkFit(
    itemLengthCm: number,
    itemWidthCm: number,
    palletLengthCm: number,
    palletWidthCm: number
): FitResult {
    // Check normal orientation
    if (itemLengthCm <= palletLengthCm && itemWidthCm <= palletWidthCm) {
        return { fits: true, rotated: false, orientation: 'normal' };
    }

    // Check rotated orientation (swap item L/W)
    if (itemWidthCm <= palletLengthCm && itemLengthCm <= palletWidthCm) {
        return { fits: true, rotated: true, orientation: 'rotated' };
    }

    return { fits: false, rotated: false, orientation: 'normal' };
}

/**
 * Convert pallet dimensions from meters to centimeters
 */
export function palletDimensionsToCm(pallet: PalletType): { lengthCm: number; widthCm: number } {
    return {
        lengthCm: new Decimal(pallet.lengthM).times(100).toNumber(),
        widthCm: new Decimal(pallet.widthM).times(100).toNumber(),
    };
}

/**
 * Get effective height and weight limits based on transport options
 */
export function getEffectiveLimits(
    options: { lift: boolean; van35: boolean },
    palletMaxHeightCm: number,
    palletMaxWeightKg: number
): EffectiveLimits {
    let maxHeightCm = Math.min(220, palletMaxHeightCm);
    let maxWeightKg = Math.min(1500, palletMaxWeightKg);

    // Van 3.5t takes precedence (stricter limits)
    if (options.van35) {
        maxHeightCm = Math.min(180, maxHeightCm);
        maxWeightKg = Math.min(400, maxWeightKg);
    } else if (options.lift) {
        // Lift only affects weight
        maxWeightKg = Math.min(750, maxWeightKg);
    }

    return { maxHeightCm, maxWeightKg };
}



/**
 * Check if a value is close to a limit (within 5%)
 */
export function isNearLimit(value: number, limit: number, thresholdPercent: number = 5): boolean {
    const threshold = limit * (thresholdPercent / 100);
    return value >= limit - threshold && value <= limit;
}

/**
 * Format pallet dimensions for display
 */
export function formatPalletDimensions(pallet: PalletType): string {
    return `${pallet.lengthM}m × ${pallet.widthM}m`;
}


