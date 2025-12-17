import { PalletAllocation } from '../domain/types';
import { palletDimensionsToCm } from '../domain/helpers';

interface PalletVisualizerProps {
    allocation: PalletAllocation;
    className?: string;
}

export function PalletVisualizer({ allocation, className = '' }: PalletVisualizerProps) {
    const palletCm = palletDimensionsToCm(allocation.pallet);
    const palletWidth = palletCm.widthCm;
    const palletLength = palletCm.lengthCm;

    // SVG viewBox settings
    const viewBoxPadding = 20;
    const viewBoxWidth = palletWidth + viewBoxPadding * 2;
    const viewBoxHeight = palletLength + viewBoxPadding * 2;

    // Generates a consistent HSL color based on string
    const stringToColor = (str: string) => {
        let hash = 0;
        for (let i = 0; i < str.length; i++) {
            hash = str.charCodeAt(i) + ((hash << 5) - hash);
        }
        const hue = Math.abs(hash % 360);
        return `hsl(${hue}, 70%, 80%)`;
    };

    return (
        <div className={`w-full flex flex-col items-center ${className}`}>
            <div className="relative w-full max-w-[300px] aspect-square border-2 border-slate-200 rounded-lg p-2 bg-slate-50">
                <svg
                    viewBox={`-${viewBoxPadding} -${viewBoxPadding} ${viewBoxWidth} ${viewBoxHeight}`}
                    className="w-full h-full drop-shadow-sm"
                    preserveAspectRatio="xMidYMid meet"
                >
                    {/* Pallet Base */}
                    <rect
                        x="0"
                        y="0"
                        width={palletWidth}
                        height={palletLength}
                        fill="#e2e8f0"
                        stroke="#94a3b8"
                        strokeWidth="2"
                    />

                    {/* Dimensions Labels */}
                    <text
                        x={palletWidth / 2}
                        y={-5}
                        textAnchor="middle"
                        className="text-[10px] fill-slate-500"
                        fontSize="10"
                    >
                        {palletWidth}cm (Szer)
                    </text>

                    <text
                        x={-5}
                        y={palletLength / 2}
                        textAnchor="end"
                        className="text-[10px] fill-slate-500"
                        fontSize="10"
                        transform={`rotate(-90 -5 ${palletLength / 2})`}
                    >
                        {palletLength}cm (Dł)
                    </text>

                    {/* Items */}
                    {allocation.items.map((placement, idx) => {
                        const hasPosition = placement.positionX !== undefined && placement.positionY !== undefined;
                        if (!hasPosition) return null;

                        const color = stringToColor(placement.item.name + placement.item.id);

                        return (
                            <g key={placement.item.id + idx} transform={`translate(${placement.positionX}, ${placement.positionY})`}>
                                <rect
                                    width={placement.footprintWidthCm}
                                    height={placement.footprintLengthCm}
                                    fill={color}
                                    stroke="#475569"
                                    strokeWidth="1"
                                    className="transition-colors hover:fill-opacity-90 cursor-help"
                                >
                                    <title>{`${placement.item.name}\n${placement.footprintWidthCm}x${placement.footprintLengthCm}cm\n${placement.orientationLabel}\nWaga: ${placement.item.weightKg}kg`}</title>
                                </rect>
                                {/* Item Label (if it fits) */}
                                {placement.footprintWidthCm > 20 && placement.footprintLengthCm > 20 && (
                                    <text
                                        x={placement.footprintWidthCm / 2}
                                        y={placement.footprintLengthCm / 2}
                                        dominantBaseline="middle"
                                        textAnchor="middle"
                                        fontSize={Math.min(12, placement.footprintWidthCm / 3)}
                                        className="fill-slate-800 pointer-events-none"
                                        style={{ fontWeight: 600 }}
                                    >
                                        {idx + 1}
                                    </text>
                                )}
                            </g>
                        );
                    })}
                </svg>
            </div>
            <div className="mt-2 text-xs text-slate-500 text-center">
                Widok z góry • Rozmiar palety: {palletWidth}x{palletLength} cm
            </div>
        </div>
    );
}
