import { MultiItemResult } from '@/domain/types';
import { PalletVisualizer } from '@/components/PalletVisualizer';

interface MultiItemResultCardProps {
    result: MultiItemResult;
}

export function MultiItemResultCard({ result }: MultiItemResultCardProps) {
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

                    <div className="mb-4 flex justify-center bg-white rounded-lg py-4 border">
                        <PalletVisualizer allocation={alloc} className="max-w-xs" />
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
