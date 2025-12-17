'use client';

import { useState } from 'react';
import { Trash2, Pencil, Check } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import type { FurnitureItem } from '@/domain/types';

const MAX_ITEMS = 10;

interface FurnitureListProps {
    items: FurnitureItem[];
    onRemove: (id: string) => void;
    onRename: (id: string, newName: string) => void;
}

export function FurnitureList({ items, onRemove, onRename }: FurnitureListProps) {
    const [editingId, setEditingId] = useState<string | null>(null);
    const [editName, setEditName] = useState('');

    const handleStartEdit = (item: FurnitureItem) => {
        setEditingId(item.id);
        setEditName(item.name);
    };

    const handleSaveEdit = () => {
        if (editingId && editName.trim()) {
            onRename(editingId, editName.trim());
        }
        setEditingId(null);
        setEditName('');
    };

    if (items.length === 0) {
        return null;
    }

    return (
        <div className="space-y-2">
            <h3 className="text-sm font-medium text-muted-foreground">
                Dodane meble ({items.length}/{MAX_ITEMS})
            </h3>
            {items.length >= MAX_ITEMS && (
                <p className="text-xs text-amber-600">⚠️ Osiągnięto limit {MAX_ITEMS} mebli</p>
            )}
            <ul className="space-y-2">
                {items.map((item, index) => (
                    <li
                        key={item.id}
                        className="flex items-center justify-between rounded-md border bg-muted/50 p-2"
                    >
                        <div className="flex-1 min-w-0">
                            {editingId === item.id ? (
                                <div className="flex items-center gap-1">
                                    <Input
                                        value={editName}
                                        onChange={(e) => setEditName(e.target.value)}
                                        onKeyDown={(e) => e.key === 'Enter' && handleSaveEdit()}
                                        className="h-7 text-sm"
                                        autoFocus
                                    />
                                    <Button
                                        type="button"
                                        variant="ghost"
                                        size="sm"
                                        onClick={handleSaveEdit}
                                        className="text-green-600 hover:text-green-700"
                                    >
                                        <Check className="h-4 w-4" />
                                    </Button>
                                </div>
                            ) : (
                                <>
                                    <p className="text-sm font-medium truncate flex items-center gap-1">
                                        {index + 1}. {item.name}
                                        <Button
                                            type="button"
                                            variant="ghost"
                                            size="sm"
                                            onClick={() => handleStartEdit(item)}
                                            className="h-5 w-5 p-0 text-muted-foreground hover:text-foreground"
                                        >
                                            <Pencil className="h-3 w-3" />
                                        </Button>
                                    </p>
                                    <p className="text-xs text-muted-foreground">
                                        {item.lengthCm}×{item.widthCm}×{item.heightCm}cm, {item.weightKg}kg
                                    </p>
                                </>
                            )}
                        </div>
                        <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={() => onRemove(item.id)}
                            className="text-red-500 hover:text-red-700 hover:bg-red-100"
                        >
                            <Trash2 className="h-4 w-4" />
                        </Button>
                    </li>
                ))}
            </ul>
        </div>
    );
}

export { MAX_ITEMS };
