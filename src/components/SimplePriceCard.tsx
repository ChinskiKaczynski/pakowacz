import { PriceBreakdown } from '@/domain/types';
import { APP_CONFIG } from '@/config/constants';

interface SimplePriceCardProps {
    pricing: PriceBreakdown;
    palletName: string;
    palletDimensions: string;
    category: string;
    orientationLabel: string | null;
    warnings: string[];
}

export function SimplePriceCard({
    pricing,
    palletName,
    palletDimensions,
    category,
    orientationLabel,
    warnings,
}: SimplePriceCardProps) {
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
                    <span>VAT {pricing.vat ? (parseFloat(pricing.vat) > 0 ? APP_CONFIG.VAT_PERCENT : 'ZW') : APP_CONFIG.VAT_PERCENT}%:</span>
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
