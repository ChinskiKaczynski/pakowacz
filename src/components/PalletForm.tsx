'use client';

import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Slider } from '@/components/ui/slider';
import { Checkbox } from '@/components/ui/checkbox';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import type { CalculationInput, DistanceBand } from '@/domain/types';

const formSchema = z.object({
    lengthCm: z.coerce
        .number()
        .min(1, 'Długość musi być > 0')
        .max(1000, 'Długość max 1000 cm'),
    widthCm: z.coerce
        .number()
        .min(1, 'Szerokość musi być > 0')
        .max(1000, 'Szerokość max 1000 cm'),
    heightCm: z.coerce
        .number()
        .min(1, 'Wysokość musi być > 0')
        .max(300, 'Wysokość max 300 cm'),
    weightKg: z.coerce
        .number()
        .min(0.1, 'Waga musi być > 0')
        .max(2000, 'Waga max 2000 kg'),
    distanceBand: z.enum(['LE_100', 'KM_101_300', 'KM_301_500', 'GT_500']),
    packagingMarginCm: z.coerce.number().min(0).max(50),
    lift: z.boolean(),
    van35: z.boolean(),
    carryIn: z.boolean(),
});

type FormData = z.infer<typeof formSchema>;

interface PalletFormProps {
    onSubmit: (data: CalculationInput) => void;
    onReset: () => void;
    onAddItem?: (data: CalculationInput) => void;
}

const distanceBandLabels: Record<DistanceBand, string> = {
    LE_100: 'do 100 km',
    KM_101_300: '101-300 km',
    KM_301_500: '301-500 km',
    GT_500: 'powyżej 500 km',
};

export function PalletForm({ onSubmit, onReset, onAddItem }: PalletFormProps) {
    const {
        register,
        handleSubmit,
        setValue,
        watch,
        reset,
        formState: { errors },
    } = useForm({
        resolver: zodResolver(formSchema),
        defaultValues: {
            lengthCm: '' as unknown as number,
            widthCm: '' as unknown as number,
            heightCm: '' as unknown as number,
            weightKg: '' as unknown as number,
            distanceBand: 'LE_100' as const,
            packagingMarginCm: 5,
            lift: false,
            van35: false,
            carryIn: false,
        },
    });

    const packagingMargin = watch('packagingMarginCm') as number;

    const handleFormSubmit = (data: Record<string, unknown>) => {
        const formData = data as FormData;
        onSubmit({
            lengthCm: formData.lengthCm,
            widthCm: formData.widthCm,
            heightCm: formData.heightCm,
            weightKg: formData.weightKg,
            distanceBand: formData.distanceBand,
            options: {
                lift: false,
                van35: false,
                carryIn: formData.carryIn,
            },
            packagingMarginCm: formData.packagingMarginCm,
        });
    };

    const handleReset = () => {
        reset();
        onReset();
    };

    return (
        <form onSubmit={handleSubmit(handleFormSubmit)} className="space-y-6">
            {/* Dimensions */}
            <div className="grid grid-cols-3 gap-3">
                <div className="space-y-2">
                    <Label htmlFor="lengthCm">Długość (cm)</Label>
                    <Input
                        id="lengthCm"
                        type="number"
                        inputMode="decimal"
                        placeholder="L"
                        {...register('lengthCm')}
                        className={errors.lengthCm ? 'border-red-500' : ''}
                    />
                    {errors.lengthCm && (
                        <p className="text-xs text-red-500">{errors.lengthCm.message}</p>
                    )}
                </div>

                <div className="space-y-2">
                    <Label htmlFor="widthCm">Szerokość (cm)</Label>
                    <Input
                        id="widthCm"
                        type="number"
                        inputMode="decimal"
                        placeholder="W"
                        {...register('widthCm')}
                        className={errors.widthCm ? 'border-red-500' : ''}
                    />
                    {errors.widthCm && (
                        <p className="text-xs text-red-500">{errors.widthCm.message}</p>
                    )}
                </div>

                <div className="space-y-2">
                    <Label htmlFor="heightCm">Wysokość (cm)</Label>
                    <Input
                        id="heightCm"
                        type="number"
                        inputMode="decimal"
                        placeholder="H"
                        {...register('heightCm')}
                        className={errors.heightCm ? 'border-red-500' : ''}
                    />
                    {errors.heightCm && (
                        <p className="text-xs text-red-500">{errors.heightCm.message}</p>
                    )}
                </div>
            </div>

            {/* Weight */}
            <div className="space-y-2">
                <Label htmlFor="weightKg">Waga (kg)</Label>
                <Input
                    id="weightKg"
                    type="number"
                    inputMode="decimal"
                    placeholder="Waga w kg"
                    {...register('weightKg')}
                    className={errors.weightKg ? 'border-red-500' : ''}
                />
                {errors.weightKg && (
                    <p className="text-xs text-red-500">{errors.weightKg.message}</p>
                )}
            </div>

            {/* Distance */}
            <div className="space-y-2">
                <Label htmlFor="distanceBand">Dystans</Label>
                <Select
                    defaultValue="LE_100"
                    onValueChange={(value) => setValue('distanceBand', value as DistanceBand)}
                >
                    <SelectTrigger id="distanceBand">
                        <SelectValue placeholder="Wybierz dystans" />
                    </SelectTrigger>
                    <SelectContent>
                        {Object.entries(distanceBandLabels).map(([value, label]) => (
                            <SelectItem key={value} value={value}>
                                {label}
                            </SelectItem>
                        ))}
                    </SelectContent>
                </Select>
            </div>

            {/* Packaging margin slider */}
            <div className="space-y-3">
                <div className="flex items-center justify-between">
                    <Label>Zapas pakowania</Label>
                    <span className="text-sm font-medium">{packagingMargin} cm</span>
                </div>
                <Slider
                    value={[packagingMargin]}
                    onValueChange={(value) => setValue('packagingMarginCm', value[0])}
                    min={0}
                    max={50}
                    step={1}
                    className="w-full"
                />
            </div>

            {/* Carry-in service */}
            <div className="flex items-center space-x-2">
                <Checkbox
                    id="carryIn"
                    checked={watch('carryIn')}
                    onCheckedChange={(checked) => setValue('carryIn', !!checked)}
                />
                <Label htmlFor="carryIn" className="text-sm font-medium cursor-pointer">
                    Wniesienie/Zniesienie
                </Label>
            </div>

            {/* Buttons */}
            <div className="flex flex-col gap-2">
                <div className="flex gap-3">
                    <Button type="submit" className="flex-1">
                        Oblicz
                    </Button>
                    <Button type="button" variant="outline" onClick={handleReset}>
                        Reset
                    </Button>
                </div>
                {onAddItem && (
                    <Button
                        type="button"
                        variant="secondary"
                        className="w-full"
                        onClick={handleSubmit((data) => {
                            const formData = data as FormData;
                            onAddItem({
                                lengthCm: formData.lengthCm,
                                widthCm: formData.widthCm,
                                heightCm: formData.heightCm,
                                weightKg: formData.weightKg,
                                distanceBand: formData.distanceBand,
                                options: { lift: false, van35: false, carryIn: formData.carryIn },
                                packagingMarginCm: formData.packagingMarginCm,
                            });
                        })}
                    >
                        ➕ Dodaj mebel do listy
                    </Button>
                )}
            </div>
        </form>
    );
}
