'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import type { MatchResult } from '@/domain/types';
import { formatPalletDimensions } from '@/domain/helpers';

interface AlternativesSectionProps {
    alternatives: MatchResult[];
}

export function AlternativesSection({ alternatives }: AlternativesSectionProps) {
    if (alternatives.length === 0) return null;

    return (
        <div className="space-y-3">
            <h3 className="text-lg font-semibold">Alternatywy</h3>
            <div className="grid gap-3">
                {alternatives.map((alt, idx) => (
                    <Card key={idx} className="border border-gray-200 dark:border-gray-700">
                        <CardHeader className="pb-2 pt-3">
                            <CardTitle className="text-base">
                                {alt.pallet.displayName || alt.pallet.id}
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="pt-0">
                            <div className="flex items-center justify-between">
                                <div className="space-y-1">
                                    <p className="text-sm text-muted-foreground">
                                        {formatPalletDimensions(alt.pallet)}
                                        {alt.fitsRotated && (
                                            <span className="ml-1 text-amber-600">(90°)</span>
                                        )}
                                    </p>
                                    <p className="text-xs text-muted-foreground">
                                        {alt.pallet.category}
                                    </p>
                                </div>
                                <div className="text-right">
                                    <p className="text-lg font-bold">
                                        {alt.priceBreakdown.grossTotal} PLN
                                    </p>
                                    <p className="text-xs text-muted-foreground">brutto</p>
                                </div>
                            </div>
                            {alt.warnings.length > 0 && (
                                <p className="mt-2 text-xs text-amber-600">
                                    ⚠️ {alt.warnings.join(', ')}
                                </p>
                            )}
                        </CardContent>
                    </Card>
                ))}
            </div>
        </div>
    );
}
