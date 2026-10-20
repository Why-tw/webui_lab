import { GRID_HEIGHT, GRID_WIDTH } from "../constants/pixelEditor";
import type { Layer, Pixel, Point } from "../types/pixelEditor";

export function blankPixels(width = GRID_WIDTH, height = GRID_HEIGHT): Pixel[][] {
    return Array.from({ length: height }, () => Array<Pixel>(width).fill(null));
}

export function makeLayer(id: string, name: string, width = GRID_WIDTH, height = GRID_HEIGHT): Layer {
    return { id, name, visible: true, pixels: blankPixels(width, height) };
}

export function linePoints(from: Point, to: Point): Point[] {
    const points: Point[] = [];
    let x = from.x;
    let y = from.y;
    const dx = Math.abs(to.x - from.x);
    const sx = from.x < to.x ? 1 : -1;
    const dy = -Math.abs(to.y - from.y);
    const sy = from.y < to.y ? 1 : -1;
    let error = dx + dy;

    while (true) {
        points.push({ x, y });
        if (x === to.x && y === to.y) break;
        const doubledError = 2 * error;
        if (doubledError >= dy) {
            error += dy;
            x += sx;
        }
        if (doubledError <= dx) {
            error += dx;
            y += sy;
        }
    }

    return points;
}

export function circlePoints(center: Point, edge: Point): Point[] {
    const points: Point[] = [];
    const radius = Math.max(1, Math.round(Math.hypot(edge.x - center.x, edge.y - center.y)));
    let x = radius;
    let y = 0;
    let error = 1 - radius;

    while (x >= y) {
        points.push(
            { x: center.x + x, y: center.y + y },
            { x: center.x + y, y: center.y + x },
            { x: center.x - y, y: center.y + x },
            { x: center.x - x, y: center.y + y },
            { x: center.x - x, y: center.y - y },
            { x: center.x - y, y: center.y - x },
            { x: center.x + y, y: center.y - x },
            { x: center.x + x, y: center.y - y },
        );

        y += 1;
        if (error < 0) {
            error += 2 * y + 1;
        } else {
            x -= 1;
            error += 2 * (y - x) + 1;
        }
    }

    return points;
}

export function circularBrushOffsets(size: number): Point[] {
    const stampSize = Math.max(1, Math.round(size));
    const stampOffset = Math.floor((stampSize - 1) / 2);
    const center = { x: stampSize - 1, y: stampSize - 1 };
    const boundary = circlePoints(center, { x: center.x + Math.max(1, stampSize), y: center.y });
    const boundaryRadius = Math.max(...boundary.map((point) => Math.hypot(point.x - center.x, point.y - center.y)));
    const radius = Math.min(boundaryRadius, stampSize - 0.5);
    const offsets: Point[] = [];

    for (let y = 0; y < stampSize; y += 1) {
        for (let x = 0; x < stampSize; x += 1) {
            const pixelCenterX = x * 2;
            const pixelCenterY = y * 2;
            if (Math.hypot(pixelCenterX - center.x, pixelCenterY - center.y) <= radius) {
                offsets.push({ x: x - stampOffset, y: y - stampOffset });
            }
        }
    }

    return offsets;
}

export function rectanglePoints(from: Point, to: Point): Point[] {
    const left = Math.min(from.x, to.x);
    const right = Math.max(from.x, to.x);
    const top = Math.min(from.y, to.y);
    const bottom = Math.max(from.y, to.y);
    const points: Point[] = [];

    for (let x = left; x <= right; x += 1) {
        points.push({ x, y: top }, { x, y: bottom });
    }
    for (let y = top; y <= bottom; y += 1) {
        points.push({ x: left, y }, { x: right, y });
    }

    return points;
}
