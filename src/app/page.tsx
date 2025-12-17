'use client';

import { useState, useCallback, useEffect } from 'react';
import { PalletForm } from '@/components/PalletForm';
import { FurnitureList, MAX_ITEMS } from '@/components/FurnitureList';
import { AlternativesSection } from '@/components/AlternativesSection';
import { RejectedSection } from '@/components/RejectedSection';
import { Button } from '@/components/ui/button';
import { optimize } from '@/domain/optimizer';
import { optimizeMultiItem } from '@/domain/binPacking';
import { APP_CONFIG } from '@/config/constants';
import type { CalculationInput, OptimizerResult, PriceBreakdown, FurnitureItem, MultiItemResult } from '@/domain/types';
import palletTypes from '@/config/pallet_types.json';
import rateTable from '@/config/rate_table.json';
import type { PalletTypesConfig, RateTableConfig, RateCategory, DistanceBand } from '@/domain/types';

interface SingleResult {
  type: 'single';
  optimizerResult: OptimizerResult;
  input: CalculationInput;
}

interface MultiResult {
  type: 'multi';
  multiResult: MultiItemResult;
  itemCount: number;
}

type Result = SingleResult | MultiResult;

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

let itemIdCounter = 0;
const STORAGE_KEY = 'pakowacz-items';

export default function Home() {
  const [result, setResult] = useState<Result | null>(null);
  const [copied, setCopied] = useState(false);
  const [items, setItems] = useState<FurnitureItem[]>([]);
  const [lastInput, setLastInput] = useState<Partial<CalculationInput>>({
    distanceBand: 'LE_100',
    packagingMarginCm: 5,
  });

  // Load items from localStorage on mount
  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved) as FurnitureItem[];
        setItems(parsed);
        itemIdCounter = parsed.length;
      }
    } catch (e) {
      console.error('Failed to load from localStorage:', e);
    }
  }, []);

  // Save items to localStorage on change
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
    } catch (e) {
      console.error('Failed to save to localStorage:', e);
    }
  }, [items]);

  // Add item to list (with max limit check)
  const handleAddItem = useCallback((input: CalculationInput) => {
    if (items.length >= MAX_ITEMS) {
      return; // Limit reached
    }
    const newItem: FurnitureItem = {
      id: `item-${++itemIdCounter}`,
      name: `Mebel ${items.length + 1}`,
      lengthCm: input.lengthCm,
      widthCm: input.widthCm,
      heightCm: input.heightCm,
      weightKg: input.weightKg,
    };
    setItems(prev => [...prev, newItem]);
    setLastInput({
      distanceBand: input.distanceBand,
      packagingMarginCm: input.packagingMarginCm,
      options: input.options,
    });
    setResult(null);
  }, [items.length]);

  // Remove item from list
  const handleRemoveItem = useCallback((id: string) => {
    setItems(prev => prev.filter(item => item.id !== id));
    setResult(null);
  }, []);

  // Rename item
  const handleRenameItem = useCallback((id: string, newName: string) => {
    setItems(prev => prev.map(item =>
      item.id === id ? { ...item, name: newName } : item
    ));
  }, []);

  // Calculate single item (immediate)
  const handleCalculateSingle = useCallback((input: CalculationInput) => {
    const optimizerResult = optimize(
      input,
      palletTypes as PalletTypesConfig,
      rateTable as unknown as RateTableConfig,
      DEFAULT_SURCHARGES
    );

    setResult({
      type: 'single',
      optimizerResult,
      input,
    });
  }, []);

  // Calculate all items together
  const handleCalculateAll = useCallback(() => {
    if (items.length === 0) return;

    const multiResult = optimizeMultiItem(
      {
        items,
        distanceBand: (lastInput.distanceBand || 'LE_100') as DistanceBand,
        options: lastInput.options || { lift: false, van35: false },
        packagingMarginCm: lastInput.packagingMarginCm || 5,
      },
      palletTypes as PalletTypesConfig,
      rateTable as unknown as RateTableConfig,
      DEFAULT_SURCHARGES
    );

    setResult({
      type: 'multi',
      multiResult,
      itemCount: items.length,
    });
  }, [items, lastInput]);

  const handleReset = useCallback(() => {
    setResult(null);
    setItems([]);
    setCopied(false);
  }, []);

  const handleCopyResult = useCallback(async () => {
    if (!result) return;

    let text = '';
    if (result.type === 'single' && result.optimizerResult.recommended) {
      const rec = result.optimizerResult.recommended;
      const pricing = rec.priceBreakdown;
      text = `
Paleta: ${rec.pallet.displayName || rec.pallet.id}
Wymiary: ${rec.pallet.lengthM}m x ${rec.pallet.widthM}m
---
Brutto: ${pricing.grossTotal} PLN
      `.trim();
    } else if (result.type === 'multi') {
      text = `
Meble: ${result.itemCount}
Palety: ${result.multiResult.palletCount}
---
Razem brutto: ${result.multiResult.totalGross} PLN
      `.trim();
    }

    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy:', err);
    }
  }, [result]);

  // Export to PDF (print-based)
  const handleExportPDF = useCallback(() => {
    if (!result || result.type !== 'multi') return;

    const mr = result.multiResult;
    const date = new Date().toLocaleDateString('pl-PL');

    const content = `
      <!DOCTYPE html>
      <html>
      <head>
        <title>Wycena transportu mebli - ${date}</title>
        <style>
          body { font-family: Arial, sans-serif; padding: 20px; max-width: 600px; margin: 0 auto; }
          h1 { font-size: 18px; color: #333; border-bottom: 2px solid #333; padding-bottom: 10px; }
          h2 { font-size: 14px; color: #666; margin-top: 20px; }
          .summary { background: #f0f9ff; padding: 15px; border-radius: 8px; margin: 15px 0; }
          .summary-price { font-size: 24px; font-weight: bold; color: #1d4ed8; }
          .pallet { background: #f0fdf4; padding: 12px; border-radius: 8px; margin: 10px 0; border-left: 4px solid #22c55e; }
          .pallet-header { display: flex; justify-content: space-between; align-items: center; }
          .pallet-price { font-weight: bold; color: #166534; }
          .item { padding: 5px 0; border-bottom: 1px solid #e5e7eb; font-size: 14px; }
          .warning { color: #d97706; font-size: 12px; }
          .footer { margin-top: 30px; padding-top: 10px; border-top: 1px solid #ccc; font-size: 11px; color: #666; }
        </style>
      </head>
      <body>
        <h1>📦 Wycena transportu mebli</h1>
        <p>Data: ${date}</p>
        
        <div class="summary">
          <p>Liczba mebli: <strong>${result.itemCount}</strong></p>
          <p>Liczba palet: <strong>${mr.palletCount}</strong></p>
          <p class="summary-price">Razem brutto: ${mr.totalGross} PLN</p>
        </div>

        ${mr.allocations.map((alloc, i) => `
          <div class="pallet">
            <div class="pallet-header">
              <h2>Paleta ${i + 1}: ${alloc.pallet.displayName || alloc.pallet.id}</h2>
              <span class="pallet-price">${alloc.priceBreakdown.grossTotal} PLN</span>
            </div>
            ${alloc.items.map(p => `
              <div class="item">
                <strong>${p.item.name}</strong> (${p.item.lengthCm}×${p.item.widthCm}×${p.item.heightCm}cm, ${p.item.weightKg}kg)
                ${p.orientationLabel !== 'Normalnie' ? `<br><span class="warning">↪ ${p.orientationLabel}</span>` : ''}
              </div>
            `).join('')}
            <p style="font-size:12px;color:#666;margin-top:10px;">Waga: ${alloc.totalWeightKg}kg</p>
          </div>
        `).join('')}

        ${mr.warnings.length > 0 ? `
          <div style="background:#fef3c7;padding:10px;border-radius:8px;margin-top:15px;">
            <p style="font-weight:bold;color:#92400e;">Uwagi:</p>
            ${mr.warnings.map(w => `<p class="warning">⚠️ ${w}</p>`).join('')}
          </div>
        ` : ''}

        <div class="footer">
          <p>Wycena wygenerowana przez Pakowacz - Optymalizator kosztów wysyłki mebli</p>
          <p>Cennik: ${APP_CONFIG.VALID_FROM} – ${APP_CONFIG.VALID_TO} | Dopłata paliwowa: ${DEFAULT_SURCHARGES.fuelPercent}% | Opłata drogowa: ${DEFAULT_SURCHARGES.roadPercent}%</p>
        </div>
      </body>
      </html>
    `;

    const printWindow = window.open('', '_blank');
    if (printWindow) {
      printWindow.document.write(content);
      printWindow.document.close();
      printWindow.print();
    }
  }, [result]);

  const isMultiMode = items.length > 0;

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

        {/* Multi-item list */}
        {items.length > 0 && (
          <section className="mb-4 rounded-lg bg-blue-50 p-4 shadow dark:bg-blue-900/20">
            <FurnitureList items={items} onRemove={handleRemoveItem} onRename={handleRenameItem} />
            <div className="mt-3 flex gap-2">
              <Button onClick={handleCalculateAll} className="flex-1">
                Oblicz {items.length} {items.length === 1 ? 'mebel' : 'meble'}
              </Button>
              <Button variant="outline" onClick={handleReset}>
                Wyczyść
              </Button>
            </div>
          </section>
        )}

        {/* Form */}
        <section className="mb-6 rounded-lg bg-white p-4 shadow dark:bg-gray-800">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-sm font-medium">
              Wymiary mebla
            </h2>
          </div>
          <PalletForm
            onSubmit={handleCalculateSingle}
            onReset={handleReset}
            onAddItem={handleAddItem}
          />
        </section>

        {/* Results */}
        {result && (
          <section className="space-y-4">
            {result.type === 'single' ? (
              <>
                {/* Single item result */}
                {!result.optimizerResult.recommended && (
                  <div className="rounded-lg bg-red-100 p-4 text-center dark:bg-red-900">
                    <p className="text-lg font-semibold text-red-700 dark:text-red-300">
                      ❌ Brak dopasowania
                    </p>
                    <p className="text-sm text-red-600 dark:text-red-400">
                      Żaden nośnik nie spełnia wymagań.
                    </p>
                  </div>
                )}

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

                    {/* Add more items button */}
                    <Button
                      variant="secondary"
                      className="w-full"
                      onClick={() => {
                        handleAddItem(result.input);
                        setResult(null);
                      }}
                    >
                      ➕ Dodaj kolejny mebel do wysyłki
                    </Button>

                    <Button
                      variant="outline"
                      className="w-full"
                      onClick={handleCopyResult}
                    >
                      {copied ? '✓ Skopiowano!' : '📋 Kopiuj wynik'}
                    </Button>
                  </>
                )}

                <AlternativesSection alternatives={result.optimizerResult.alternatives} />
                <RejectedSection rejected={result.optimizerResult.rejected} />
              </>
            ) : (
              <>
                {/* Multi-item result */}
                <MultiItemResultCard result={result.multiResult} />

                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    className="flex-1"
                    onClick={handleCopyResult}
                  >
                    {copied ? '✓ Skopiowano!' : '📋 Kopiuj'}
                  </Button>
                  <Button
                    variant="outline"
                    className="flex-1"
                    onClick={handleExportPDF}
                  >
                    🖨️ Drukuj/PDF
                  </Button>
                </div>
              </>
            )}
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

// Simplified price card
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

      {warnings.length > 0 && (
        <div className="mb-3 rounded bg-amber-100 p-2 dark:bg-amber-900/30">
          {warnings.map((w, i) => (
            <p key={i} className="text-xs text-amber-700 dark:text-amber-400">
              ⚠️ {w}
            </p>
          ))}
        </div>
      )}

      <div className="space-y-1 border-t pt-3 text-sm">
        <div className="flex justify-between">
          <span className="text-muted-foreground">Fracht netto:</span>
          <span>{pricing.afterMinimum} PLN</span>
        </div>
        <div className="flex justify-between">
          <span className="text-muted-foreground">Korekta paliwowa:</span>
          <span>{pricing.fuelSurcharge} PLN</span>
        </div>
        <div className="flex justify-between">
          <span className="text-muted-foreground">Opłata drogowa:</span>
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

// Multi-item result card
function MultiItemResultCard({ result }: { result: MultiItemResult }) {
  return (
    <div className="space-y-4">
      {/* Summary */}
      <div className="rounded-lg bg-blue-50 p-4 shadow dark:bg-blue-900/20">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-bold text-blue-800 dark:text-blue-300">
              📦 Podsumowanie
            </h2>
            <p className="text-sm text-blue-700 dark:text-blue-400">
              {result.palletCount} {result.palletCount === 1 ? 'paleta' : 'palet'}
            </p>
          </div>
          <div className="text-right">
            <p className="text-2xl font-bold text-blue-800 dark:text-blue-300">
              {result.totalGross} PLN
            </p>
            <p className="text-xs text-muted-foreground">razem brutto</p>
          </div>
        </div>
      </div>

      {/* Warnings */}
      {result.warnings.length > 0 && (
        <div className="rounded-lg bg-amber-100 p-3 dark:bg-amber-900/30">
          {result.warnings.map((w, i) => (
            <p key={i} className="text-sm text-amber-700 dark:text-amber-400">
              ⚠️ {w}
            </p>
          ))}
        </div>
      )}

      {/* Allocations */}
      {result.allocations.map((alloc, i) => (
        <div key={i} className="rounded-lg bg-green-50 p-4 shadow dark:bg-green-900/20">
          <div className="flex items-center justify-between mb-2">
            <h3 className="font-medium text-green-800 dark:text-green-300">
              Paleta {i + 1}: {alloc.pallet.displayName || alloc.pallet.id}
            </h3>
            <span className="text-lg font-bold text-green-800 dark:text-green-300">
              {alloc.priceBreakdown.grossTotal} PLN
            </span>
          </div>

          {/* Layout notes */}
          {alloc.layoutNotes.length > 0 && (
            <div className="mb-2 rounded bg-amber-100 p-2 dark:bg-amber-900/30">
              {alloc.layoutNotes.map((note, j) => (
                <p key={j} className="text-xs text-amber-700 dark:text-amber-400">{note}</p>
              ))}
            </div>
          )}

          {/* Items with orientation and warnings */}
          <div className="space-y-2">
            {alloc.items.map((placement, j) => (
              <div key={j} className="border-l-2 border-green-300 pl-2">
                <p className="text-sm font-medium">
                  {placement.item.name}
                  <span className="text-muted-foreground ml-1">
                    ({placement.item.lengthCm}×{placement.item.widthCm}×{placement.item.heightCm}cm)
                  </span>
                </p>
                <p className="text-xs text-muted-foreground">
                  📐 Podstawa: {placement.footprintLengthCm}×{placement.footprintWidthCm}cm,
                  wysokość: {placement.heightCm}cm
                  {placement.orientationLabel !== 'Normalnie' && (
                    <span className="ml-1 text-blue-600"> • {placement.orientationLabel}</span>
                  )}
                </p>
                {placement.warnings.length > 0 && (
                  <div className="mt-1">
                    {placement.warnings.map((w, k) => (
                      <p key={k} className="text-xs text-amber-600">⚠️ {w}</p>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>

          <p className="text-xs text-muted-foreground mt-2 pt-2 border-t">
            Łączna waga: {alloc.totalWeightKg}kg
          </p>
        </div>
      ))}

      {/* Unallocated */}
      {result.unallocated.length > 0 && (
        <div className="rounded-lg bg-red-100 p-4 dark:bg-red-900">
          <h3 className="font-medium text-red-700 dark:text-red-300 mb-2">
            ❌ Nie zmieszczone:
          </h3>
          {result.unallocated.map((entry, i) => (
            <div key={i} className="text-sm text-red-600 dark:text-red-400 mb-2">
              <p className="font-medium">• {entry.item.name} ({entry.item.lengthCm}×{entry.item.widthCm}×{entry.item.heightCm}cm)</p>
              <p className="text-xs ml-3 text-red-500">{entry.details || entry.reason}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
