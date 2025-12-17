'use client';

import { useState, useCallback, useEffect } from 'react';
import { PalletForm } from '@/components/PalletForm';
import { FurnitureList, MAX_ITEMS } from '@/components/FurnitureList';
import { AlternativesSection } from '@/components/AlternativesSection';
import { RejectedSection } from '@/components/RejectedSection';
import { Button } from '@/components/ui/button';
import { SimplePriceCard } from '@/components/SimplePriceCard';
import { MultiItemResultCard } from '@/components/MultiItemResultCard';
import { optimize } from '@/domain/optimizer';
import { optimizeMultiItem } from '@/domain/binPacking';
import { APP_CONFIG } from '@/config/constants';
import { calculateCarryPrice, type CarryPriceResult } from '@/domain/carryService';
import type { CalculationInput, OptimizerResult, FurnitureItem, MultiItemResult, DistanceBand, RateTableConfig, PalletTypesConfig } from '@/domain/types';
import palletTypes from '@/config/pallet_types.json';
import rateTable from '@/config/rate_table.json';
import todConfig from '@/config/tod_config.json';

interface SingleResult {
  type: 'single';
  optimizerResult: OptimizerResult;
  input: CalculationInput;
  carryPrice?: CarryPriceResult;
}

interface MultiResult {
  type: 'multi';
  multiResult: MultiItemResult;
  itemCount: number;
  carryIn: boolean;
}

type Result = SingleResult | MultiResult;

const getCategoryName = (category: string): string => {
  const names: Record<string, string> = {
    STANDARD: 'Standard',
    HALF: 'Półpaleta',
    LONG_WIDE: 'Długa Szeroka',
    LONG_NARROW: 'Długa Wąska',
    PALLET_120_120: 'Paleta 120×120',
  };
  return names[category] || category;
};

// Default surcharges from config
const DEFAULT_SURCHARGES = {
  fuelPercent: todConfig.fuelPercent,
  roadPercent: todConfig.roadPercent,
  vatPercent: todConfig.vatPercent,
  minimumNetPrice: todConfig.minimumNetPrice,
  validFrom: todConfig.validFrom,
  validTo: todConfig.validTo,
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
      carryPrice: input.options.carryIn
        ? calculateCarryPrice(input.weightKg, input.lengthCm, input.widthCm, input.heightCm)
        : undefined,
    });
  }, []);

  // Calculate all items together
  const handleCalculateAll = useCallback(() => {
    if (items.length === 0) return;

    const multiResult = optimizeMultiItem(
      {
        items,
        distanceBand: (lastInput.distanceBand || 'LE_100') as DistanceBand,
        options: lastInput.options || { lift: false, van35: false, carryIn: false },
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
      carryIn: lastInput.options?.carryIn || false,
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
                      carryPrice={result.carryPrice}
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
                <MultiItemResultCard result={result.multiResult} carryIn={result.carryIn} />

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
