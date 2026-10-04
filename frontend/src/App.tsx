import {
    useEffect,
    useLayoutEffect,
    useRef,
    useState,
    useCallback,
} from "react";
import "./App.css";

const GRID_WIDTH = 128;
const GRID_HEIGHT = 64;
const CELL_SIZE = 30;

const MIN_ZOOM = 0.5;
const MAX_ZOOM = 8;

function App() {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const viewportRef = useRef<HTMLDivElement>(null);
    const initialScrollSetRef = useRef(false);
    const zoomRef = useRef(1);
    const wheelZoomAnchorRef = useRef<{
        oldZoom: number;
        localX: number;
        localY: number;
        canvasX: number;
        canvasY: number;
    } | null>(null);

    const [zoom, setZoom] = useState(1);
    const zoomSpeed = 0.3;

    // 每一格 pixel 是否被塗黑
    const [pixels, setPixels] = useState<boolean[][]>(
        () =>
            Array.from(
                { length: GRID_HEIGHT },
                () => Array(GRID_WIDTH).fill(false)
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

        ctx.clearRect(
            0,
            0,
            canvas.width,
            canvas.height
        );

        // =================
        // 畫 Pixel
        // =================

        ctx.fillStyle = "black";

        for (let y = 0; y < GRID_HEIGHT; y++) {
            for (let x = 0; x < GRID_WIDTH; x++) {
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

        // =================
        // 畫 Grid
        // =================

        ctx.strokeStyle = "#cccccc";
        ctx.lineWidth = 1;

        for (let i = 0; i <= GRID_WIDTH; i++) {
            const pos = i * CELL_SIZE;

            // 垂直線
            ctx.beginPath();
            ctx.moveTo(pos, 0);
            ctx.lineTo(pos, canvas.height);
            ctx.stroke();
        }

        for (let i = 0; i <= GRID_HEIGHT; i++) {
            const pos = i * CELL_SIZE;

            // 水平線
            ctx.beginPath();
            ctx.moveTo(0, pos);
            ctx.lineTo(canvas.width, pos);
            ctx.stroke();
        }
    }, [pixels]);

    function paint(
        event: React.MouseEvent<HTMLCanvasElement>
    ) {
        const canvas = canvasRef.current;
        if (!canvas) {
            return;
        }

        const rect = canvas.getBoundingClientRect();

        // client 座標
        //      ↓
        // Canvas 座標
        const x =
            (event.clientX - rect.left)
            * canvas.width / rect.width;

        const y =
            (event.clientY - rect.top)
            * canvas.height / rect.height;

        // Canvas 座標
        //      ↓
        // Pixel 座標
        const pixelX = Math.floor(x / CELL_SIZE);
        const pixelY = Math.floor(y / CELL_SIZE);

        // 邊界檢查
        if (
            pixelX < 0 ||
            pixelX >= GRID_WIDTH ||
            pixelY < 0 ||
            pixelY >= GRID_HEIGHT
        ) {
            return;
        }

        setPixels(prev => {
            const next = prev.map(row => [...row]);

            next[pixelY][pixelX] = true;

            return next;
        });
    }

    useEffect(() => {
        drawCanvas();
    }, [drawCanvas]);

    useLayoutEffect(() => {
        const viewport = viewportRef.current;
        const canvas = canvasRef.current;
        const anchor = wheelZoomAnchorRef.current;
        if (!viewport || !canvas) {
            return;
        }

        if (!anchor) {
            if (!initialScrollSetRef.current) {
                viewport.scrollLeft = canvas.offsetLeft;
                viewport.scrollTop = canvas.offsetTop;
                initialScrollSetRef.current = true;
            }
            return;
        }

        const scale = zoom / anchor.oldZoom;
        viewport.scrollLeft = canvas.offsetLeft + anchor.canvasX * scale - anchor.localX;
        viewport.scrollTop = canvas.offsetTop + anchor.canvasY * scale - anchor.localY;
        wheelZoomAnchorRef.current = null;
    }, [zoom]);

    useEffect(() => {
        const canvas = canvasRef.current;
        const viewport = viewportRef.current;
        if (!canvas || !viewport) {
            return;
        }

        function handleWheel(event: WheelEvent) {
            if (event.shiftKey) {
                event.preventDefault();
                const currentViewport = viewportRef.current;
                if (!currentViewport) {
                    return;
                }
                const horizontalDelta = event.deltaX || event.deltaY;
                currentViewport.scrollLeft += horizontalDelta;
                return;
            }

            if (!event.ctrlKey) {
                return;
            }

            event.preventDefault();
            const oldZoom = zoomRef.current;
            const nextZoom = Math.min(
                MAX_ZOOM,
                Math.max(MIN_ZOOM, oldZoom + (event.deltaY < 0 ? zoomSpeed : -zoomSpeed))
            );
            if (nextZoom === oldZoom) {
                return;
            }

            const currentViewport = viewportRef.current;
            if (!currentViewport) {
                return;
            }
            const currentCanvas = canvasRef.current;
            if (!currentCanvas) {
                return;
            }

            const rect = currentViewport.getBoundingClientRect();
            const localX = event.clientX - rect.left - currentViewport.clientLeft;
            const localY = event.clientY - rect.top - currentViewport.clientTop;
            wheelZoomAnchorRef.current = {
                oldZoom,
                localX,
                localY,
                canvasX: localX + currentViewport.scrollLeft - currentCanvas.offsetLeft,
                canvasY: localY + currentViewport.scrollTop - currentCanvas.offsetTop,
            };
            zoomRef.current = nextZoom;
            setZoom(nextZoom);
        }

        viewport.addEventListener("wheel", handleWheel, { passive: false });
        return () => viewport.removeEventListener("wheel", handleWheel);
    }, []);

    function changeZoom(amount: number) {
        const nextZoom = Math.min(
            MAX_ZOOM,
            Math.max(MIN_ZOOM, zoomRef.current + amount)
        );
        wheelZoomAnchorRef.current = null;
        zoomRef.current = nextZoom;
        setZoom(nextZoom);
    }

    function resetZoom() {
        wheelZoomAnchorRef.current = null;
        zoomRef.current = 1;
        setZoom(1);
    }

    return (
        <>
            <h1>EmbedPixel Studio</h1>
            <div className="test"></div>

            <div className="canvas-controls" aria-label="Canvas zoom controls">
                <button type="button" onClick={() => changeZoom(-0.1)} aria-label="Zoom out">
                    -
                </button>
                <span>Zoom: {Math.round(zoom * 100)}%</span>
                <button type="button" onClick={() => changeZoom(0.1)} aria-label="Zoom in">
                    +
                </button>
                <button type="button" onClick={resetZoom}>
                    Reset
                </button>
            </div>

            <div className="drawing-viewport" ref={viewportRef}>
                <div className="drawing-stage">
                    <canvas
                        ref={canvasRef}
                        className="drawing-canvas"
                        width={GRID_WIDTH * CELL_SIZE}
                        height={GRID_HEIGHT * CELL_SIZE}
                        style={{
                            width: `${GRID_WIDTH * CELL_SIZE * zoom}px`,
                            height: `${GRID_HEIGHT * CELL_SIZE * zoom}px`,
                            imageRendering: "pixelated",
                        }}
                        onMouseDown={paint}
                    />
                </div>
            </div>
        </>
    );
}

export default App;