import { describe, it, expect } from 'vitest';
import { Packer } from '../../src/domain/packer';

describe('Packer', () => {
    it('should pack a single item that fits', () => {
        const packer = new Packer(100, 100);
        const result = packer.pack([{ id: '1', w: 50, h: 50 }]);

        expect(result).not.toBeNull();
        expect(result).toHaveLength(1);
        expect(result![0]).toMatchObject({ x: 0, y: 0, width: 50, height: 50 });
    });

    it('should pack two items side by side', () => {
        const packer = new Packer(100, 100);
        const result = packer.pack([
            { id: '1', w: 50, h: 100 },
            { id: '2', w: 50, h: 100 }
        ]);

        expect(result).not.toBeNull();
        expect(result).toHaveLength(2);
        // First item usually at 0,0
        expect(result![0]).toMatchObject({ width: 50, height: 100 });
        // Second item should be at 50,0
        expect(result![1]).toMatchObject({ x: 50, y: 0, width: 50, height: 100 });
    });

    it('should fail if items do not fit', () => {
        const packer = new Packer(50, 50);
        const result = packer.pack([{ id: '1', w: 60, h: 60 }]);
        expect(result).toBeNull();
    });

    it('should rotate items to fit', () => {
        const packer = new Packer(100, 50);
        // Item is 50x100, but container is 100x50. Must rotate.
        const result = packer.pack([{ id: '1', w: 50, h: 100 }]);

        expect(result).not.toBeNull();
        expect(result![0].rotated).toBe(true);
        expect(result![0].width).toBe(100); // Swapped
        expect(result![0].height).toBe(50);
    });

    it('should pack complex layout', () => {
        // 100x100 container
        // Items: 50x50, 50x50, 100x50
        const packer = new Packer(100, 100);
        const input = [
            { id: '1', w: 50, h: 50 },
            { id: '2', w: 50, h: 50 },
            { id: '3', w: 100, h: 50 }
        ];
        const result = packer.pack(input);

        expect(result).not.toBeNull();
        expect(result).toHaveLength(3);

        // Calculate total area
        const totalArea = result!.reduce((sum, item) => sum + item.width * item.height, 0);
        expect(totalArea).toBe(50 * 50 + 50 * 50 + 100 * 50);

        // Verify no overlaps (naive check)
        for (let i = 0; i < result!.length; i++) {
            for (let j = i + 1; j < result!.length; j++) {
                const r1 = result![i];
                const r2 = result![j];
                const overlap = !(r1.x + r1.width <= r2.x || r2.x + r2.width <= r1.x ||
                    r1.y + r1.height <= r2.y || r2.y + r2.height <= r1.y);
                expect(overlap).toBe(false);
            }
        }
    });
});
