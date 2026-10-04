import { useEffect, useRef, useState, useCallback } from "react";

const GRID_SIZE = 16;
const CELL_SIZE = 30;

function App() {
    const canvasRef = useRef<HTMLCanvasElement>(null);

    // 每一格 pixel 是否被塗黑
    const [pixels, setPixels] = useState<boolean[][]>(
        () =>
            Array.from(
                { length: GRID_SIZE },
                () => Array(GRID_SIZE).fill(false)
            )
    );

    const drawCanvas = useCallback(() => {
        const canvas = canvasRef.current;
        if (!canvas) {
            return;
        }

        const ctx = canvas.getContext("2d");
        if (!ctx) {
            return;
        }

        // 清空 Canvas
        ctx.clearRect(
            0,
            0,
            canvas.width,
            canvas.height
        );

        // ----------------
        // 畫 Pixel
        // ----------------

        ctx.fillStyle = "black";

        for (let y = 0; y < GRID_SIZE; y++) {
            for (let x = 0; x < GRID_SIZE; x++) {
                if (pixels[y][x]) {
                    ctx.fillRect(
                        x * CELL_SIZE,
                        y * CELL_SIZE,
                        CELL_SIZE,
                        CELL_SIZE
                    );
                }
            }
        }

        // ----------------
        // 畫 Grid
        // ----------------

        ctx.strokeStyle = "#cccccc";
        ctx.lineWidth = 1;

        for (let i = 0; i <= GRID_SIZE; i++) {
            const pos = i * CELL_SIZE;

            // 垂直線
            ctx.beginPath();
            ctx.moveTo(pos, 0);
            ctx.lineTo(pos, canvas.height);
            ctx.stroke();

            // 水平線
            ctx.beginPath();
            ctx.moveTo(0, pos);
            ctx.lineTo(canvas.width, pos);
            ctx.stroke();
        }
    }, [pixels]);

    function paint(event: React.MouseEvent<HTMLCanvasElement>) {
        const canvas = canvasRef.current;
        if (!canvas) {
            return;
        }

        const rect = canvas.getBoundingClientRect();

        // client 座標 → Canvas 座標
        const x =
            (event.clientX - rect.left)
            * canvas.width / rect.width;

        const y =
            (event.clientY - rect.top)
            * canvas.height / rect.height;

        // Canvas 座標 → Pixel 座標
        const pixelX = Math.floor(x / CELL_SIZE);
        const pixelY = Math.floor(y / CELL_SIZE);

        console.log({
            canvasX: x,
            canvasY: y,
            pixelX,
            pixelY,
        });
        if (
            pixelX < 0 ||
            pixelX >= GRID_SIZE ||
            pixelY < 0 ||
            pixelY >= GRID_SIZE
        ) {
            return;
        }

        // 修改 pixel 資料
        setPixels(prev => {
            const next = prev.map(row => [...row]);

            next[pixelY][pixelX] = true;

            return next;
        });
    }

    // pixels 改變後重新繪製 Canvas
    useEffect(() => {
        drawCanvas();
    }, [drawCanvas]);

    return (
        <>
            <h1>EmbedPixel Studio</h1>

            <canvas
                ref={canvasRef}
                width={GRID_SIZE * CELL_SIZE}
                height={GRID_SIZE * CELL_SIZE}
                onMouseDown={paint}
            />
        </>
    );
}

export default App;