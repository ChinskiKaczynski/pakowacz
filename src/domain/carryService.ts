import Decimal from 'decimal.js';

/**
 * Carry-in/Carry-out (Wniesienie/Zniesienie) pricing according to TOD 2026 KR
 */

export interface CarryPriceResult {
    available: boolean;
    basePrice: string;      // Base price from weight tier
    surcharge: string;      // 60 zł surcharge if applicable
    totalNet: string;       // Total net price
    totalGross: string;     // Total gross price (with VAT)
    warnings: string[];
}

// Weight-based pricing tiers (netto)
const CARRY_TIERS = [
    { maxWeight: 45, price: 35 },
    { maxWeight: 60, price: 42 },
    { maxWeight: 75, price: 49 },
    { maxWeight: 90, price: 57 },
] as const;

// Per-kg rates for heavier items
const PER_KG_RATES = {
    tier1: { minWeight: 91, maxWeight: 240, ratePerKg: 0.60, minPrice: 57 },
    tier2: { minWeight: 241, maxWeight: 800, ratePerKg: 0.50, minPrice: 144 },
} as const;

// Maximum weight for service
const MAX_WEIGHT_KG = 800;

// Surcharge conditions
const SURCHARGE_AMOUNT = 60;
const SURCHARGE_WEIGHT_MIN = 100;
const SURCHARGE_WEIGHT_MAX = 168;
const MAX_DIMENSION_SUM_CM = 400;

// VAT rate
const VAT_RATE = 0.23;

/**
 * Calculate carry-in/carry-out price based on weight and dimensions
 */
export function calculateCarryPrice(
    weightKg: number,
    lengthCm: number,
    widthCm: number,
    heightCm: number
): CarryPriceResult {
    const warnings: string[] = [];

    // Check if service is available
    if (weightKg > MAX_WEIGHT_KG) {
        return {
            available: false,
            basePrice: '0.00',
            surcharge: '0.00',
            totalNet: '0.00',
            totalGross: '0.00',
            warnings: [`Waga ${weightKg} kg przekracza limit ${MAX_WEIGHT_KG} kg dla usługi wniesienia.`],
        };
    }

    // Calculate base price from tiers
    let basePrice = new Decimal(0);

    // Check fixed-price tiers first
    const fixedTier = CARRY_TIERS.find(tier => weightKg <= tier.maxWeight);
    if (fixedTier) {
        basePrice = new Decimal(fixedTier.price);
    } else if (weightKg <= PER_KG_RATES.tier1.maxWeight) {
        // 91-240 kg: 0.60 zł/kg, min 57 zł
        const calculated = new Decimal(weightKg).times(PER_KG_RATES.tier1.ratePerKg);
        basePrice = Decimal.max(calculated, new Decimal(PER_KG_RATES.tier1.minPrice));
    } else if (weightKg <= PER_KG_RATES.tier2.maxWeight) {
        // 241-800 kg: 0.50 zł/kg, min 144 zł
        const calculated = new Decimal(weightKg).times(PER_KG_RATES.tier2.ratePerKg);
        basePrice = Decimal.max(calculated, new Decimal(PER_KG_RATES.tier2.minPrice));
    }

    // Check surcharge conditions
    const dimensionSum = lengthCm + widthCm + heightCm;
    let surcharge = new Decimal(0);

    const needsSurchargeWeight = weightKg >= SURCHARGE_WEIGHT_MIN && weightKg <= SURCHARGE_WEIGHT_MAX;
    const needsSurchargeDimensions = dimensionSum > MAX_DIMENSION_SUM_CM;

    if (needsSurchargeWeight || needsSurchargeDimensions) {
        surcharge = new Decimal(SURCHARGE_AMOUNT);

        if (needsSurchargeWeight) {
            warnings.push(`Dopłata ${SURCHARGE_AMOUNT} zł: waga ${weightKg} kg (100-168 kg).`);
        }
        if (needsSurchargeDimensions) {
            warnings.push(`Dopłata ${SURCHARGE_AMOUNT} zł: suma wymiarów ${dimensionSum} cm > ${MAX_DIMENSION_SUM_CM} cm.`);
        }
    }

    const totalNet = basePrice.plus(surcharge);
    const vat = totalNet.times(VAT_RATE);
    const totalGross = totalNet.plus(vat);

    return {
        available: true,
        basePrice: basePrice.toFixed(2),
        surcharge: surcharge.toFixed(2),
        totalNet: totalNet.toFixed(2),
        totalGross: totalGross.toFixed(2),
        warnings,
    };
}
