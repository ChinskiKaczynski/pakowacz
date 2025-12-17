import { FurnitureItem } from './types';

export interface Rect {
    x: number;
    y: number;
    w: number;
    h: number;
}

export interface PackedItem {
    id: string;
    x: number;
    y: number;
    width: number;
    height: number;
    rotated: boolean;
}

interface FreeRect {
    x: number;
    y: number;
    w: number;
    h: number;
}

/**
 * A simplified MaxRects-like bin packer for 2D placement.
 * It tries to fit items into free rectangles, keeping track of remaining space.
 */
export class Packer {
    private width: number;
    private height: number;
    private freeRects: FreeRect[];

    constructor(width: number, height: number) {
        this.width = width;
        this.height = height;
        this.freeRects = [{ x: 0, y: 0, w: width, h: height }];
    }

    public pack(
        items: { id: string; w: number; h: number }[]
    ): PackedItem[] | null {
        const packedItems: PackedItem[] = [];

        // Sort items by height (descending) as a heuristic
        const sortedItems = [...items].sort((a, b) => Math.max(b.w, b.h) - Math.max(a.w, a.h));

        for (const item of sortedItems) {
            const bestNode = this.findBestNode(item.w, item.h);

            if (bestNode) {
                // Place the item
                packedItems.push({
                    id: item.id,
                    x: bestNode.x,
                    y: bestNode.y,
                    width: bestNode.width,
                    height: bestNode.height,
                    rotated: bestNode.rotated,
                });

                this.splitFreeRects({
                    x: bestNode.x,
                    y: bestNode.y,
                    w: bestNode.width,
                    h: bestNode.height
                });
            } else {
                return null; // Could not fit all items
            }
        }

        return packedItems;
    }

    private findBestNode(w: number, h: number): { x: number; y: number; width: number; height: number; rotated: boolean } | null {
        let bestNode: { x: number; y: number; width: number; height: number; rotated: boolean; score: number } | null = null;
        let bestShortSideFit = Number.MAX_VALUE;
        let bestLongSideFit = Number.MAX_VALUE;

        for (const freeRect of this.freeRects) {
            // Try normal orientation
            if (freeRect.w >= w && freeRect.h >= h) {
                const leftoverHoriz = Math.abs(freeRect.w - w);
                const leftoverVert = Math.abs(freeRect.h - h);
                const shortSideFit = Math.min(leftoverHoriz, leftoverVert);
                const longSideFit = Math.max(leftoverHoriz, leftoverVert);

                if (shortSideFit < bestShortSideFit || (shortSideFit === bestShortSideFit && longSideFit < bestLongSideFit)) {
                    bestNode = { x: freeRect.x, y: freeRect.y, width: w, height: h, rotated: false, score: shortSideFit };
                    bestShortSideFit = shortSideFit;
                    bestLongSideFit = longSideFit;
                }
            }

            // Try rotated orientation
            if (freeRect.w >= h && freeRect.h >= w) {
                const leftoverHoriz = Math.abs(freeRect.w - h);
                const leftoverVert = Math.abs(freeRect.h - w);
                const shortSideFit = Math.min(leftoverHoriz, leftoverVert);
                const longSideFit = Math.max(leftoverHoriz, leftoverVert);

                if (shortSideFit < bestShortSideFit || (shortSideFit === bestShortSideFit && longSideFit < bestLongSideFit)) {
                    bestNode = { x: freeRect.x, y: freeRect.y, width: h, height: w, rotated: true, score: shortSideFit };
                    bestShortSideFit = shortSideFit;
                    bestLongSideFit = longSideFit;
                }
            }
        }

        if (!bestNode) return null;
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        const { score, ...result } = bestNode;
        return result;
    }

    private splitFreeRects(usedNode: FreeRect) {
        const newFreeRects: FreeRect[] = [];

        for (const freeRect of this.freeRects) {
            if (this.intersect(usedNode, freeRect)) {
                // Split the free rect
                if (usedNode.x < freeRect.x + freeRect.w && usedNode.x + usedNode.w > freeRect.x) {
                    // New rect above
                    if (usedNode.y > freeRect.y && usedNode.y < freeRect.y + freeRect.h) {
                        const newRect = {
                            x: freeRect.x,
                            y: freeRect.y,
                            w: freeRect.w,
                            h: usedNode.y - freeRect.y
                        };
                        newFreeRects.push(newRect);
                    }
                    // New rect below
                    if (usedNode.y + usedNode.h < freeRect.y + freeRect.h) {
                        const newRect = {
                            x: freeRect.x,
                            y: usedNode.y + usedNode.h,
                            w: freeRect.w,
                            h: freeRect.y + freeRect.h - (usedNode.y + usedNode.h)
                        };
                        newFreeRects.push(newRect);
                    }
                }

                if (usedNode.y < freeRect.y + freeRect.h && usedNode.y + usedNode.h > freeRect.y) {
                    // New rect left
                    if (usedNode.x > freeRect.x && usedNode.x < freeRect.x + freeRect.w) {
                        const newRect = {
                            x: freeRect.x,
                            y: freeRect.y,
                            w: usedNode.x - freeRect.x,
                            h: freeRect.h
                        };
                        newFreeRects.push(newRect);
                    }
                    // New rect right
                    if (usedNode.x + usedNode.w < freeRect.x + freeRect.w) {
                        const newRect = {
                            x: usedNode.x + usedNode.w,
                            y: freeRect.y,
                            w: freeRect.y + freeRect.w - (usedNode.x + usedNode.w), // wait, width calc error potential here
                            h: freeRect.h
                        };
                        // Fix width calc: freeRect.x + freeRect.w - (usedNode.x + usedNode.w)
                        newRect.w = (freeRect.x + freeRect.w) - (usedNode.x + usedNode.w);
                        newFreeRects.push(newRect);
                    }
                }

            } else {
                newFreeRects.push(freeRect);
            }
        }

        this.freeRects = newFreeRects.filter(r => r.w > 0 && r.h > 0);
        this.pruneFreeRects();
    }

    private intersect(n: FreeRect, r: FreeRect): boolean {
        return n.x < r.x + r.w && n.x + n.w > r.x &&
            n.y < r.y + r.h && n.y + n.h > r.y;
    }

    private pruneFreeRects() {
        // Go through and remove any rect strictly contained in another
        for (let i = 0; i < this.freeRects.length; i++) {
            for (let j = 0; j < this.freeRects.length; j++) {
                if (i === j) continue;
                if (this.isContained(this.freeRects[i], this.freeRects[j])) {
                    this.freeRects.splice(i, 1);
                    i--;
                    break;
                }
            }
        }
    }

    private isContained(a: FreeRect, b: FreeRect): boolean {
        return a.x >= b.x && a.y >= b.y &&
            a.x + a.w <= b.x + b.w && a.y + a.h <= b.y + b.h;
    }
}
