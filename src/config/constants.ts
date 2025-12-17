/**
 * Centralized application constants
 * All business-critical values should be defined here to avoid duplication
 */

export const APP_CONFIG = {
    /** VAT rate in percent */
    VAT_PERCENT: 23,
    /** Minimum net price floor in PLN */
    MINIMUM_NET_PRICE: 40,
    /** Rate table validity period */
    VALID_FROM: '2026-01-01',
    VALID_TO: '2026-12-31',
    /** Pallet base height in cm - added to item height for total height calculation */
    PALLET_BASE_HEIGHT_CM: 15,
} as const;

export type AppConfig = typeof APP_CONFIG;
