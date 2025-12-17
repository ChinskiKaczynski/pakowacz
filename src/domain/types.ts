// Domain types for Pallet Optimizer

export type DistanceBand = "LE_100" | "KM_101_300" | "KM_301_500" | "GT_500";

export type RejectionReason =
  | "OVERHANG"
  | "HEIGHT_LIMIT"
  | "WEIGHT_LIMIT"
  | "NO_RATE_MATCH";

export type RateCategory =
  | "STANDARD"
  | "HALF"
  | "LONG_WIDE"
  | "LONG_NARROW"
  | "PALLET_120_120";

export interface PalletType {
  id: string;
  displayName?: string;
  lengthM: number;
  widthM: number;
  maxHeightCm: number;
  maxWeightKg: number;
  category: RateCategory;
}

export interface PalletTypesConfig {
  pallets: PalletType[];
}

export interface RateTier {
  maxWeightKg: number;
  rates: Record<DistanceBand, number>;
}

export interface CategoryRates {
  tiers: RateTier[];
}

export interface RateTableConfig {
  categories: Record<RateCategory, CategoryRates>;
}

export interface SurchargesConfig {
  fuelPercent: number;
  roadPercent: number;
  vatPercent: number;
  minimumNetPrice: number;
  validFrom: string;
  validTo: string;
  notes?: {
    seasonal?: string;
    tod?: string;
  };
}

export interface CalculationInput {
  lengthCm: number;
  widthCm: number;
  heightCm: number;
  weightKg: number;
  distanceBand: DistanceBand;
  options: {
    lift: boolean;
    van35: boolean;
  };
  packagingMarginCm: number;
}

export interface PriceBreakdown {
  baseRate: string;
  afterMinimum: string;
  fuelSurcharge: string;
  roadSurcharge: string;
  netTotal: string;
  vat: string;
  grossTotal: string;
}

export interface MatchResult {
  pallet: PalletType;
  fitsRotated: boolean;
  orientationLabel: string | null; // Human-readable orientation (e.g., "Położony na boku")
  priceBreakdown: PriceBreakdown;
  warnings: string[];
}

export interface RejectedResult {
  pallet: PalletType;
  reasons: RejectionReason[];
}

export interface OptimizerResult {
  recommended: MatchResult | null;
  alternatives: MatchResult[];
  rejected: RejectedResult[];
}

export interface EffectiveLimits {
  maxHeightCm: number;
  maxWeightKg: number;
}

export type ItemOrientation =
  | 'normal'
  | 'rotated'
  | 'tiltedOnSide'
  | 'tiltedOnSideRotated'
  | 'tiltedOnEnd'
  | 'tiltedOnEndRotated';

export interface FitResult {
  fits: boolean;
  rotated: boolean;
  orientation: ItemOrientation;
}
