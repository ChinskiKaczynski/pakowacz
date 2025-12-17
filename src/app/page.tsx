'use client';

import { useState, useCallback } from 'react';
import { PalletForm } from '@/components/PalletForm';
import { AlternativesSection } from '@/components/AlternativesSection';
import { RejectedSection } from '@/components/RejectedSection';
import { Button } from '@/components/ui/button';
import { optimize } from '@/domain/optimizer';
import { APP_CONFIG } from '@/config/constants';
import type { CalculationInput, OptimizerResult, PriceBreakdown } from '@/domain/types';
import palletTypes from '@/config/pallet_types.json';
import rateTable from '@/config/rate_table.json';
import type { PalletTypesConfig, RateTableConfig, RateCategory } from '@/domain/types';

interface FullResult {
  optimizerResult: OptimizerResult;
  input: CalculationInput;
}

const getCategoryName = (category: RateCategory): string => {
  const names: Record<RateCategory, string> = {
    STANDARD: 'Standard',
    HALF: 'Półpaleta',
    LONG_WIDE: 'Długa Szeroka',
    LONG_NARROW: 'Długa Wąska',
    PALLET_120_120: 'Paleta 120×120',
  };
  return names[category];
};

// Default surcharges for pricing
const DEFAULT_SURCHARGES = {
  fuelPercent: 20.02,
  roadPercent: 14.43,
  vatPercent: APP_CONFIG.VAT_PERCENT,
  minimumNetPrice: APP_CONFIG.MINIMUM_NET_PRICE,
  validFrom: APP_CONFIG.VALID_FROM,
  validTo: APP_CONFIG.VALID_TO,
};

export default function Home() {
  const [result, setResult] = useState<FullResult | null>(null);
  const [copied, setCopied] = useState(false);

  const handleSubmit = useCallback((input: CalculationInput) => {
    const optimizerResult = optimize(
      input,
      palletTypes as PalletTypesConfig,
      rateTable as unknown as RateTableConfig,
      DEFAULT_SURCHARGES
    );

    setResult({
      optimizerResult,
      input,
    });
  }, []);

  const handleReset = useCallback(() => {
    setResult(null);
    setCopied(false);
  }, []);

  const handleCopyResult = useCallback(async () => {
    if (!result?.optimizerResult.recommended) return;

    const rec = result.optimizerResult.recommended;
    const pricing = rec.priceBreakdown;

    const text = `
Paleta: ${rec.pallet.displayName || rec.pallet.id}
Wymiary: ${rec.pallet.lengthM}m x ${rec.pallet.widthM}m
---
Fracht netto: ${pricing.afterMinimum} PLN
Korekta paliwowa: ${pricing.fuelSurcharge} PLN
Opłata drogowa: ${pricing.roadSurcharge} PLN
---
Netto: ${pricing.netTotal} PLN
VAT ${APP_CONFIG.VAT_PERCENT}%: ${pricing.vat} PLN
Brutto: ${pricing.grossTotal} PLN
    `.trim();

    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy:', err);
    }
  }, [result]);

  return (
    <main className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <div className="mx-auto max-w-lg px-4 py-6">
        {/* Header */}
        <header className="mb-6 text-center">
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
            Optymalizator kosztów wysyłki mebli
          </h1>
          <p className="text-sm text-muted-foreground">
            Znajdź najtańszy sposób transportu
          </p>
          <p className="text-xs text-blue-600 mt-1">
            Cennik 2026 - Rohlig SUUS
          </p>
        </header>

        {/* Form */}
        <section className="mb-6 rounded-lg bg-white p-4 shadow dark:bg-gray-800">
          <PalletForm onSubmit={handleSubmit} onReset={handleReset} />
        </section>

        {/* Results */}
        {result && (
          <section className="space-y-4">
            {/* No match warning */}
            {!result.optimizerResult.recommended && (
              <div className="rounded-lg bg-red-100 p-4 text-center dark:bg-red-900">
                <p className="text-lg font-semibold text-red-700 dark:text-red-300">
                  ❌ Brak dopasowania
                </p>
                <p className="text-sm text-red-600 dark:text-red-400">
                  Żaden nośnik nie spełnia wymagań. Sprawdź wymiary i opcje transportu.
                </p>
              </div>
            )}

            {/* Recommendation */}
            {result.optimizerResult.recommended && (
              <>
                <SimplePriceCard
                  pricing={result.optimizerResult.recommended.priceBreakdown}
                  palletName={result.optimizerResult.recommended.pallet.displayName || result.optimizerResult.recommended.pallet.id}
                  palletDimensions={`${result.optimizerResult.recommended.pallet.lengthM}m × ${result.optimizerResult.recommended.pallet.widthM}m`}
                  category={getCategoryName(result.optimizerResult.recommended.pallet.category)}
                  orientationLabel={result.optimizerResult.recommended.orientationLabel}
                  warnings={result.optimizerResult.recommended.warnings}
                />

                {/* Copy button */}
                <Button
                  variant="outline"
                  className="w-full"
                  onClick={handleCopyResult}
                >
                  {copied ? '✓ Skopiowano!' : '📋 Kopiuj wynik'}
                </Button>
              </>
            )}

            {/* Alternatives */}
            <AlternativesSection alternatives={result.optimizerResult.alternatives} />

            {/* Rejected */}
            <RejectedSection rejected={result.optimizerResult.rejected} />
          </section>
        )}

        {/* Footer */}
        <footer className="mt-8 border-t pt-4 text-center text-xs text-muted-foreground">
          <p>
            Cennik: {APP_CONFIG.VALID_FROM} – {APP_CONFIG.VALID_TO}
          </p>
          <p className="mt-1">
            Dopłaty publikowane na{' '}
            <a
              href="https://www.suus.com"
              target="_blank"
              rel="noopener noreferrer"
              className="text-blue-600 underline"
            >
              suus.com
            </a>
          </p>
        </footer>
      </div>
    </main>
  );
}

// Simplified price card without TOD services
function SimplePriceCard({
  pricing,
  palletName,
  palletDimensions,
  category,
  orientationLabel,
  warnings,
}: {
  pricing: PriceBreakdown;
  palletName: string;
  palletDimensions: string;
  category: string;
  orientationLabel: string | null;
  warnings: string[];
}) {
  return (
    <div className="rounded-lg bg-green-50 p-4 shadow dark:bg-green-900/20">
      <div className="mb-3 flex items-center justify-between">
        <div>
          <h2 className="text-lg font-bold text-green-800 dark:text-green-300">
            ✓ Rekomendacja
          </h2>
          <p className="text-sm text-green-700 dark:text-green-400">
            {palletName} ({palletDimensions})
          </p>
          <p className="text-xs text-muted-foreground">
            Kategoria: {category}
            {orientationLabel && ` • ${orientationLabel}`}
          </p>
        </div>
        <div className="text-right">
          <p className="text-2xl font-bold text-green-800 dark:text-green-300">
            {pricing.grossTotal} PLN
          </p>
          <p className="text-xs text-muted-foreground">brutto</p>
        </div>
      </div>

      {/* Warnings */}
      {warnings.length > 0 && (
        <div className="mb-3 rounded bg-amber-100 p-2 dark:bg-amber-900/30">
          {warnings.map((w, i) => (
            <p key={i} className="text-xs text-amber-700 dark:text-amber-400">
              ⚠️ {w}
            </p>
          ))}
        </div>
      )}

      {/* Price breakdown */}
      <div className="space-y-1 border-t pt-3 text-sm">
        <div className="flex justify-between">
          <span className="text-muted-foreground">Fracht netto:</span>
          <span>{pricing.afterMinimum} PLN</span>
        </div>
        <div className="flex justify-between">
          <span className="text-muted-foreground">Korekta paliwowa ({DEFAULT_SURCHARGES.fuelPercent}%):</span>
          <span>{pricing.fuelSurcharge} PLN</span>
        </div>
        <div className="flex justify-between">
          <span className="text-muted-foreground">Opłata drogowa ({DEFAULT_SURCHARGES.roadPercent}%):</span>
          <span>{pricing.roadSurcharge} PLN</span>
        </div>
        <div className="flex justify-between border-t pt-1 font-medium">
          <span>Netto:</span>
          <span>{pricing.netTotal} PLN</span>
        </div>
        <div className="flex justify-between text-muted-foreground">
          <span>VAT {APP_CONFIG.VAT_PERCENT}%:</span>
          <span>{pricing.vat} PLN</span>
        </div>
        <div className="flex justify-between border-t pt-1 text-lg font-bold">
          <span>Brutto:</span>
          <span>{pricing.grossTotal} PLN</span>
        </div>
      </div>
    </div>
  );
}
