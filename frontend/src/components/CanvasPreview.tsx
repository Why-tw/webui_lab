import { useLayoutEffect, useRef } from "react";

import type { Layer } from "../types/pixelEditor";

type CanvasPreviewProps = {
    layers: Layer[];
    width: number;
    height: number;
    className: string;
    visibleLayersOnly?: boolean;
};

export function CanvasPreview({
    layers,
    width,
    height,
    className,
    visibleLayersOnly = true,
}: CanvasPreviewProps) {
    const canvasRef = useRef<HTMLCanvasElement>(null);

    useLayoutEffect(() => {
        const canvas = canvasRef.current;
        const context = canvas?.getContext("2d");
        if (!canvas || !context) return;

        context.clearRect(0, 0, canvas.width, canvas.height);
        for (const layer of layers) {
            if (visibleLayersOnly && !layer.visible) continue;
            for (let y = 0; y < height; y += 1) {
                for (let x = 0; x < width; x += 1) {
                    const pixel = layer.pixels[y]?.[x];
                    if (pixel) {
                        context.fillStyle = pixel;
                        context.fillRect(x, y, 1, 1);
                    }
                }
            }
        }
    }, [height, layers, visibleLayersOnly, width]);

    return <canvas ref={canvasRef} className={className} width={width} height={height} />;
}
