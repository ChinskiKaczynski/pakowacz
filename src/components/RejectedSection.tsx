'use client';

import {
    Accordion,
    AccordionContent,
    AccordionItem,
    AccordionTrigger,
} from '@/components/ui/accordion';
import type { RejectedResult, RejectionReason } from '@/domain/types';
import { formatPalletDimensions } from '@/domain/helpers';

interface RejectedSectionProps {
    rejected: RejectedResult[];
}

const reasonLabels: Record<RejectionReason, string> = {
    OVERHANG: 'Wystaje poza obrys',
    HEIGHT_LIMIT: 'Przekroczona wysokość',
    WEIGHT_LIMIT: 'Przekroczona waga',
    NO_RATE_MATCH: 'Brak stawki dla tej wagi',
};

export function RejectedSection({ rejected }: RejectedSectionProps) {
    if (rejected.length === 0) return null;

    return (
        <Accordion type="single" collapsible className="w-full">
            <AccordionItem value="rejected">
                <AccordionTrigger className="text-sm text-muted-foreground">
                    Odrzucone nośniki ({rejected.length})
                </AccordionTrigger>
                <AccordionContent>
                    <ul className="space-y-2">
                        {rejected.map((item, idx) => (
                            <li
                                key={idx}
                                className="flex items-start justify-between rounded-md bg-red-50 p-2 dark:bg-red-950"
                            >
                                <div>
                                    <p className="text-sm font-medium">
                                        {item.pallet.displayName || item.pallet.id}
                                    </p>
                                    <p className="text-xs text-muted-foreground">
                                        {formatPalletDimensions(item.pallet)}
                                    </p>
                                </div>
                                <div className="text-right">
                                    {item.reasons.map((reason, ridx) => (
                                        <p
                                            key={ridx}
                                            className="text-xs text-red-600 dark:text-red-400"
                                        >
                                            {reasonLabels[reason]}
                                        </p>
                                    ))}
                                </div>
                            </li>
                        ))}
                    </ul>
                </AccordionContent>
            </AccordionItem>
        </Accordion>
    );
}
