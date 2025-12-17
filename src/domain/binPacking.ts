/**
 * Bin Packing Algorithm for Multi-Item Pallet Optimization
 * Uses First Fit Decreasing (FFD) approach
 */

import Decimal from 'decimal.js';
import type {
    FurnitureItem,
    MultiItemInput,
    MultiItemResult,
    PalletAllocation,
    ItemPlacement,
    PalletType,
    PalletTypesConfig,
    RateTableConfig,
    SurchargesConfig,
    ItemOrientation,
    UnallocatedItem,
} from './types';
import { check3DFit, palletDimensionsToCm, getEffectiveLimits } from './helpers';
import { findRate, calculatePrice } from './pricing';
import { Packer } from './packer';

const PALLET_BASE_HEIGHT_CM = 15;

/** Get effective dimensions after applying margin */
function getEffectiveDimensions(item: FurnitureItem, marginCm: number) {
    return {
        lengthCm: item.lengthCm + marginCm,
        widthCm: item.widthCm + marginCm,
        heightCm: item.heightCm,
        weightKg: item.weightKg,
    };
}

/** Check if a single item fits on a pallet */
function itemFitsOnPallet(
    item: FurnitureItem,
    pallet: PalletType,
    marginCm: number,
    options: { lift: boolean; van35: boolean }
): { fits: boolean; orientation: ItemOrientation } {
    const palletCm = palletDimensionsToCm(pallet);
    const limits = getEffectiveLimits(options, pallet.maxHeightCm, pallet.maxWeightKg);
    const availableHeight = limits.maxHeightCm - PALLET_BASE_HEIGHT_CM;

    // Check weight first
    if (item.weightKg > limits.maxWeightKg) {
        return { fits: false, orientation: 'normal' };
    }

    // Check 3D fit - pass original dimensions with margin for footprint only
    const fitResult = check3DFit(
        item.lengthCm,
        item.widthCm,
        item.heightCm,
        palletCm.lengthCm,
        palletCm.widthCm,
        availableHeight,
        marginCm // Margin applied only to footprint, not height
    );

    return { fits: fitResult.fits, orientation: fitResult.orientation };
}

/**
 * Simple check: can all items fit on one pallet together?
 * Uses naive "sum of footprints" approach as approximation
 */
/**
 * Check: can all items fit on one pallet together?
 * Uses the 2D Packer to verify geometric fit and calculate positions.
 */
function canAllFitOnOnePallet(
    items: FurnitureItem[],
    pallet: PalletType,
    marginCm: number,
    options: { lift: boolean; van35: boolean }
): { fits: boolean; placements: ItemPlacement[]; layoutNotes: string[] } {
    const palletCm = palletDimensionsToCm(pallet);
    const limits = getEffectiveLimits(options, pallet.maxHeightCm, pallet.maxWeightKg);
    const availableHeight = limits.maxHeightCm - PALLET_BASE_HEIGHT_CM;

    // Check total weight
    const totalWeight = items.reduce((sum, item) => sum + item.weightKg, 0);
    if (totalWeight > limits.maxWeightKg) {
        return { fits: false, placements: [], layoutNotes: ['Przekroczony limit wagi'] };
    }

    // Prepare items for usage in checking individual fit (height check) and then packing
    const preparedItems: { id: string; w: number; h: number; originalItem: FurnitureItem; orientation: ItemOrientation; orientationLabel: string; footprint: { length: number; width: number; height: number }; warnings: string[] }[] = [];
    const layoutNotes: string[] = [];

    // First pass: Check if each item fits individually in some orientation
    for (const item of items) {
        // Pass original dimensions with margin for footprint only
        const fitResult = check3DFit(
            item.lengthCm,
            item.widthCm,
            item.heightCm,
            palletCm.lengthCm,
            palletCm.widthCm,
            availableHeight,
            marginCm // Margin applied only to footprint, not height
        );

        if (!fitResult.fits) {
            return { fits: false, placements: [], layoutNotes: [`${item.name} nie mieści się`] };
        }

        // Get dims with margin for footprint calculation (margin on all non-height dims)
        const dims = getEffectiveDimensions(item, marginCm);
        const footprint = getFootprintForOrientation(dims, fitResult.orientation);
        const orientationLabel = getOrientationLabel(fitResult.orientation);
        const itemWarnings: string[] = [];

        if (footprint.height >= availableHeight - 10) {
            itemWarnings.push(`Na styk z limitem wysokości (${footprint.height}cm / ${availableHeight}cm)`);
        }
        if (fitResult.orientation.includes('tilted')) {
            itemWarnings.push(`Musi być ${orientationLabel.toLowerCase()}`);
        }

        preparedItems.push({
            id: item.id,
            w: Math.round(footprint.width),
            h: Math.round(footprint.length), // Packer expects w/h, we map footprint width/length
            originalItem: item,
            orientation: fitResult.orientation,
            orientationLabel,
            footprint,
            warnings: itemWarnings
        });
    }

    // Second pass: Use Packer to check if they all fit on the 2D surface
    // Note: Packer coordinates are w=x-axis, h=y-axis. We map pallet Width -> Packer W, pallet Length -> Packer H
    // However, usually "Length" is the longer side. Let's stick to X=Width, Y=Length for visualization consistency if that matches SVG.
    // SVG coordinate system: 0,0 top-left.
    const packer = new Packer(Math.round(palletCm.widthCm), Math.round(palletCm.lengthCm));

    // We map item footprint width -> w, length -> h.
    // Packer will try to rotate them if needed.
    const packerInput = preparedItems.map(p => ({
        id: p.id,
        w: p.w,
        h: p.h
    }));

    const packedResult = packer.pack(packerInput);

    if (!packedResult) {
        return { fits: false, placements: [], layoutNotes: ['Meble nie mieszczą się na powierzchni palety'] };
    }

    // Construct final placements
    // Calculate bounding box of packed items
    let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
    packedResult.forEach(p => {
        minX = Math.min(minX, p.x);
        maxX = Math.max(maxX, p.x + p.width);
        minY = Math.min(minY, p.y);
        maxY = Math.max(maxY, p.y + p.height);
    });

    const boundingWidth = maxX - minX;
    const boundingHeight = maxY - minY;

    // Calculate offests to center the bounding box on the pallet
    // Pallet dimensions: palletCm.widthCm x palletCm.lengthCm
    // Note: Packer was initialized with (width, length)
    // Center items per "row" (group of items overlapping in Y)
    const remainingForGrouping = [...packedResult];
    const groups: (typeof packedResult)[] = [];

    while (remainingForGrouping.length > 0) {
        remainingForGrouping.sort((a, b) => a.y - b.y);
        const seed = remainingForGrouping.shift()!;
        const group = [seed];
        const queue = [seed];

        while (queue.length > 0) {
            const current = queue.pop()!;

            for (let i = remainingForGrouping.length - 1; i >= 0; i--) {
                const other = remainingForGrouping[i];
                const overlap = (current.y < other.y + other.height) && (current.y + current.height > other.y);

                if (overlap) {
                    const removed = remainingForGrouping.splice(i, 1)[0];
                    group.push(removed);
                    queue.push(removed);
                }
            }
        }
        groups.push(group);
    }

    const finalPositions = new Map<string, { x: number, y: number }>();

    groups.forEach(group => {
        let minX = Infinity, maxX = -Infinity;
        group.forEach(p => {
            minX = Math.min(minX, p.x);
            maxX = Math.max(maxX, p.x + p.width);
        });

        const groupWidth = maxX - minX;
        const groupOffsetX = (Math.round(palletCm.widthCm) - groupWidth) / 2 - minX;

        group.forEach(p => {
            finalPositions.set(p.id, { x: p.x + groupOffsetX, y: p.y });
        });
    });

    let minGlobalY = Infinity, maxGlobalY = -Infinity;
    packedResult.forEach(p => {
        minGlobalY = Math.min(minGlobalY, p.y);
        maxGlobalY = Math.max(maxGlobalY, p.y + p.height);
    });
    const finalBoundingHeight = maxGlobalY - minGlobalY;
    const globalOffsetY = (Math.round(palletCm.lengthCm) - finalBoundingHeight) / 2 - minGlobalY;

    const placements: ItemPlacement[] = packedResult.map(packed => {
        const original = preparedItems.find(p => p.id === packed.id)!;

        return {
            item: original.originalItem,
            orientation: original.orientation,
            orientationLabel: original.orientationLabel,
            warnings: original.warnings,
            footprintWidthCm: packed.width, // X dimension
            footprintLengthCm: packed.height, // Y dimension
            heightCm: Math.round(original.footprint.height),
            positionX: finalPositions.get(packed.id)!.x,
            positionY: finalPositions.get(packed.id)!.y + globalOffsetY
        };
    });

    if (placements.length > 1) {
        // layoutNotes.push('⚠️ Rozmieszczenie wg schematu poniżej');
    }

    return { fits: true, placements, layoutNotes };
}

/** Get human-readable orientation label */
function getOrientationLabel(orientation: ItemOrientation): string {
    switch (orientation) {
        case 'normal':
            return 'Normalnie';
        case 'rotated':
            return 'Obrócony na palecie';
        case 'tiltedOnSide':
            return 'Położony na boku';
        case 'tiltedOnSideRotated':
            return 'Na boku + obrócony';
        case 'tiltedOnEnd':
            return 'Postawiony na sztorc';
        case 'tiltedOnEndRotated':
            return 'Na sztorc + obrócony';
    }
}

/** Get footprint dimensions for a given orientation */
function getFootprintForOrientation(
    dims: { lengthCm: number; widthCm: number; heightCm: number },
    orientation: ItemOrientation
): { length: number; width: number; height: number } {
    switch (orientation) {
        case 'normal':
            return { length: dims.lengthCm, width: dims.widthCm, height: dims.heightCm };
        case 'rotated':
            return { length: dims.widthCm, width: dims.lengthCm, height: dims.heightCm };
        case 'tiltedOnSide':
            return { length: dims.lengthCm, width: dims.heightCm, height: dims.widthCm };
        case 'tiltedOnSideRotated':
            return { length: dims.heightCm, width: dims.lengthCm, height: dims.widthCm };
        case 'tiltedOnEnd':
            return { length: dims.widthCm, width: dims.heightCm, height: dims.lengthCm };
        case 'tiltedOnEndRotated':
            return { length: dims.heightCm, width: dims.widthCm, height: dims.lengthCm };
    }
}

/**
 * Main multi-item optimizer
 * Strategy: Try fitting all on smallest pallets first, then try larger ones
 */
export function optimizeMultiItem(
    input: MultiItemInput,
    palletTypes: PalletTypesConfig,
    rateTable: RateTableConfig,
    surcharges: SurchargesConfig
): MultiItemResult {
    const warnings: string[] = [];
    const allocations: PalletAllocation[] = [];
    const unallocated: UnallocatedItem[] = [];
    let remainingItems = [...input.items];

    // Sort pallets by price (cheapest first based on minimum weight tier)
    const sortedPallets = [...palletTypes.pallets].sort((a, b) => {
        const rateA = findRate(rateTable, a.category, 50, input.distanceBand) || 999;
        const rateB = findRate(rateTable, b.category, 50, input.distanceBand) || 999;
        return rateA - rateB;
    });

    // Sort items by footprint area (largest first - FFD approach)
    remainingItems.sort((a, b) => {
        const areaA = (a.lengthCm + input.packagingMarginCm) * (a.widthCm + input.packagingMarginCm);
        const areaB = (b.lengthCm + input.packagingMarginCm) * (b.widthCm + input.packagingMarginCm);
        return areaB - areaA;
    });

    // Try to fit all items on a single pallet first
    for (const pallet of sortedPallets) {
        const result = canAllFitOnOnePallet(
            remainingItems,
            pallet,
            input.packagingMarginCm,
            input.options
        );

        if (result.fits) {
            const totalWeight = remainingItems.reduce((sum, item) => sum + item.weightKg, 0);
            const rate = findRate(rateTable, pallet.category, totalWeight, input.distanceBand);

            if (rate !== null) {
                allocations.push({
                    pallet,
                    items: result.placements,
                    totalWeightKg: totalWeight,
                    priceBreakdown: calculatePrice(rate, surcharges),
                    layoutNotes: result.layoutNotes,
                });
                remainingItems = [];
                break;
            }
        }
    }

    // If items remain, use greedy grouping approach
    // Try to fit as many items as possible on each pallet before moving to next
    if (remainingItems.length > 0) {
        warnings.push('Wszystkie meble nie mieszczą się na jednej palecie');

        while (remainingItems.length > 0) {
            let bestAllocation: PalletAllocation | null = null;
            let bestItemsAllocated: FurnitureItem[] = [];
            let bestCostPerItem = Infinity;

            // Try each pallet type
            for (const pallet of sortedPallets) {
                // Try to fit multiple items on this pallet, starting with all and reducing
                for (let count = Math.min(remainingItems.length, 4); count >= 1; count--) {
                    // Try fitting the first 'count' items
                    const itemsToTry = remainingItems.slice(0, count);
                    const result = canAllFitOnOnePallet(
                        itemsToTry,
                        pallet,
                        input.packagingMarginCm,
                        input.options
                    );

                    if (result.fits) {
                        const totalWeight = itemsToTry.reduce(
                            (sum, item) => sum.plus(new Decimal(item.weightKg)),
                            new Decimal(0)
                        ).toNumber();

                        const rate = findRate(rateTable, pallet.category, totalWeight, input.distanceBand);

                        if (rate !== null) {
                            const price = calculatePrice(rate, surcharges);
                            const costPerItem = parseFloat(price.grossTotal) / count;

                            // Prefer solutions with more items per pallet (lower cost per item)
                            if (costPerItem < bestCostPerItem) {
                                bestCostPerItem = costPerItem;
                                bestItemsAllocated = itemsToTry;
                                bestAllocation = {
                                    pallet,
                                    items: result.placements,
                                    totalWeightKg: totalWeight,
                                    priceBreakdown: price,
                                    layoutNotes: result.layoutNotes,
                                };
                            }
                            break; // Found a valid fit and rate, stop trying fewer items
                        }
                    }
                }
            }

            if (bestAllocation) {
                allocations.push(bestAllocation);
                // Remove allocated items from remaining
                const allocatedIds = new Set(bestItemsAllocated.map(i => i.id));
                remainingItems = remainingItems.filter(item => !allocatedIds.has(item.id));
            } else {
                // Can't fit any item - move first item to unallocated
                const unallocatedItem = remainingItems.shift()!;
                unallocated.push({
                    item: unallocatedItem,
                    reason: 'NO_FIT',
                    details: 'Nie znaleziono pasującej palety (lub zbyt duża waga)',
                });
                warnings.push(`Mebel "${unallocatedItem.name}" nie mieści się na żadnej palecie`);
            }
        }
    }

    // Calculate totals
    const totalGross = allocations.reduce(
        (sum, alloc) => sum.plus(new Decimal(alloc.priceBreakdown.grossTotal)),
        new Decimal(0)
    );

    return {
        allocations,
        palletCount: allocations.length,
        totalGross: totalGross.toFixed(2),
        unallocated,
        warnings,
    };
}
