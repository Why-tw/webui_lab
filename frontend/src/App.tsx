import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import type { PointerEvent as ReactPointerEvent } from "react";

import { CanvasWorkspace } from "./components/CanvasWorkspace";
import { LayersPanel } from "./components/LayersPanel";
import { SettingsDialog } from "./components/SettingsDialog";
import { ToolRail } from "./components/ToolRail";
import {
    CELL_SIZE,
    COLORS,
    GRID_HEIGHT,
    GRID_WIDTH,
    MAX_ZOOM,
    MIN_ZOOM,
    TOOLS,
} from "./constants/pixelEditor";
import type { Gesture, Layer, Pixel, Point, Preview, ShortcutMap, Symmetry, Tool } from "./types/pixelEditor";
import { circlePoints, linePoints, makeLayer, rectanglePoints } from "./utils/pixelEditor";
import "./App.css";

function createDefaultShortcuts(): ShortcutMap {
    return Object.fromEntries(TOOLS.map((tool) => [tool.id, tool.shortcut])) as ShortcutMap;
}

function App() {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const viewportRef = useRef<HTMLDivElement>(null);
    const zoomRef = useRef(1);
    const initialScrollSetRef = useRef(false);
    const gestureRef = useRef<Gesture | null>(null);
    const nextLayerIdRef = useRef(2);
    const wheelZoomAnchorRef = useRef<{ oldZoom: number; localX: number; localY: number; canvasX: number; canvasY: number } | null>(null);

    const [zoom, setZoom] = useState(1);
    const [layers, setLayers] = useState<Layer[]>(() => [makeLayer("layer-1", "圖層 1")]);
    const [activeLayerId, setActiveLayerId] = useState("layer-1");
    const [activeTool, setActiveTool] = useState<Tool>("pencil");
    const [color, setColor] = useState(COLORS[0]);
    const [gridVisible, setGridVisible] = useState(true);
    const [symmetryEnabled, setSymmetryEnabled] = useState(false);
    const [symmetry, setSymmetry] = useState<Symmetry>("vertical");
    const [symmetryPosition, setSymmetryPosition] = useState(GRID_WIDTH / 2);
    const [draggingAxis, setDraggingAxis] = useState(false);
    const [preview, setPreview] = useState<Preview | null>(null);
    const [settingsOpen, setSettingsOpen] = useState(false);
    const [listeningTool, setListeningTool] = useState<Tool | null>(null);
    const [shortcuts, setShortcuts] = useState<ShortcutMap>(() => {
        try {
            const saved = localStorage.getItem("embedpixel-shortcuts");
            return saved ? { ...createDefaultShortcuts(), ...JSON.parse(saved) } : createDefaultShortcuts();
        } catch {
            return createDefaultShortcuts();
        }
    });

    const zoomSpeed = 0.3;
    const activeToolConfig = TOOLS.find((tool) => tool.id === activeTool) ?? TOOLS[0];
    const activeLayer = layers.find((layer) => layer.id === activeLayerId);

    const drawCanvas = useCallback(() => {
        const canvas = canvasRef.current;
        const context = canvas?.getContext("2d");
        if (!canvas || !context) return;

        context.clearRect(0, 0, canvas.width, canvas.height);

        for (const layer of layers) {
            if (!layer.visible) continue;
            for (let y = 0; y < GRID_HEIGHT; y += 1) {
                for (let x = 0; x < GRID_WIDTH; x += 1) {
                    const pixel = layer.pixels[y][x];
                    if (pixel) {
                        context.fillStyle = pixel;
                        context.fillRect(x * CELL_SIZE, y * CELL_SIZE, CELL_SIZE, CELL_SIZE);
                    }
                }
            }
        }

        if (gridVisible) {
            context.strokeStyle = "rgba(63, 66, 61, .18)";
            context.lineWidth = 1;
            for (let x = 0; x <= GRID_WIDTH; x += 1) {
                context.beginPath();
                context.moveTo(x * CELL_SIZE + 0.5, 0);
                context.lineTo(x * CELL_SIZE + 0.5, canvas.height);
                context.stroke();
            }
            for (let y = 0; y <= GRID_HEIGHT; y += 1) {
                context.beginPath();
                context.moveTo(0, y * CELL_SIZE + 0.5);
                context.lineTo(canvas.width, y * CELL_SIZE + 0.5);
                context.stroke();
            }
        }

        if (symmetryEnabled) {
            context.save();
            context.strokeStyle = "#df654e";
            context.lineWidth = Math.max(1, 1.5 / zoom);
            context.setLineDash([6 / zoom, 5 / zoom]);
            context.beginPath();
            if (symmetry === "vertical") {
                context.moveTo(symmetryPosition * CELL_SIZE, 0);
                context.lineTo(symmetryPosition * CELL_SIZE, canvas.height);
            } else {
                context.moveTo(0, symmetryPosition * CELL_SIZE);
                context.lineTo(canvas.width, symmetryPosition * CELL_SIZE);
            }
            context.stroke();
            context.restore();
        }

        if (preview && (activeTool === "line" || activeTool === "circle" || activeTool === "rectangle")) {
            const points =
                activeTool === "line"
                    ? linePoints(preview.start, preview.end)
                    : activeTool === "circle"
                        ? circlePoints(preview.start, preview.end)
                        : rectanglePoints(preview.start, preview.end);

            context.fillStyle = `${color}99`;
            for (const point of points) {
                if (point.x >= 0 && point.x < GRID_WIDTH && point.y >= 0 && point.y < GRID_HEIGHT) {
                    context.fillRect(point.x * CELL_SIZE, point.y * CELL_SIZE, CELL_SIZE, CELL_SIZE);
                }
            }
        }
    }, [activeTool, color, gridVisible, layers, preview, symmetry, symmetryEnabled, symmetryPosition, zoom]);

    const getCanvasPosition = useCallback((clientX: number, clientY: number) => {
        const canvas = canvasRef.current;
        if (!canvas) return null;

        const rect = canvas.getBoundingClientRect();
        const x = ((clientX - rect.left) * canvas.width) / rect.width / CELL_SIZE;
        const y = ((clientY - rect.top) * canvas.height) / rect.height / CELL_SIZE;

        if (x < 0 || x >= GRID_WIDTH || y < 0 || y >= GRID_HEIGHT) return null;
        return { x, y, cell: { x: Math.floor(x), y: Math.floor(y) } };
    }, []);

    const paintPoints = useCallback(
        (points: Point[], erase = false) => {
            const layerId = activeLayerId;
            setLayers((current) =>
                current.map((layer) => {
                    if (layer.id !== layerId) return layer;

                    const pixels = [...layer.pixels];
                    const changedRows = new Map<number, Pixel[]>();

                    const setPixel = (x: number, y: number) => {
                        if (x < 0 || x >= GRID_WIDTH || y < 0 || y >= GRID_HEIGHT) return;

                        let row = changedRows.get(y);
                        if (!row) {
                            row = [...pixels[y]];
                            changedRows.set(y, row);
                            pixels[y] = row;
                        }
                        row[x] = erase ? null : color;
                    };

                    for (const point of points) {
                        setPixel(point.x, point.y);
                        if (symmetryEnabled) {
                            if (symmetry === "vertical") {
                                setPixel(Math.round(2 * symmetryPosition - point.x - 1), point.y);
                            } else {
                                setPixel(point.x, Math.round(2 * symmetryPosition - point.y - 1));
                            }
                        }
                    }

                    return { ...layer, pixels };
                }),
            );
        },
        [activeLayerId, color, symmetry, symmetryEnabled, symmetryPosition],
    );

    const floodFill = useCallback(
        (point: Point) => {
            const layerId = activeLayerId;
            setLayers((current) =>
                current.map((layer) => {
                    if (layer.id !== layerId) return layer;

                    const pixels = layer.pixels.map((row) => [...row]);
                    const mirror =
                        symmetry === "vertical"
                            ? { x: Math.round(2 * symmetryPosition - point.x - 1), y: point.y }
                            : { x: point.x, y: Math.round(2 * symmetryPosition - point.y - 1) };

                    const seeds = symmetryEnabled ? [point, mirror] : [point];

                    for (const seed of seeds) {
                        if (seed.x < 0 || seed.x >= GRID_WIDTH || seed.y < 0 || seed.y >= GRID_HEIGHT) continue;
                        const target = pixels[seed.y][seed.x];
                        if (target === color) continue;

                        const queue: Point[] = [seed];
                        let cursor = 0;

                        while (cursor < queue.length) {
                            const currentPoint = queue[cursor++];
                            if (currentPoint.x < 0 || currentPoint.x >= GRID_WIDTH || currentPoint.y < 0 || currentPoint.y >= GRID_HEIGHT) continue;
                            if (pixels[currentPoint.y][currentPoint.x] !== target) continue;

                            pixels[currentPoint.y][currentPoint.x] = color;
                            queue.push(
                                { x: currentPoint.x + 1, y: currentPoint.y },
                                { x: currentPoint.x - 1, y: currentPoint.y },
                                { x: currentPoint.x, y: currentPoint.y + 1 },
                                { x: currentPoint.x, y: currentPoint.y - 1 },
                            );
                        }
                    }

                    return { ...layer, pixels };
                }),
            );
        },
        [activeLayerId, color, symmetry, symmetryEnabled, symmetryPosition],
    );

    const finishGesture = useCallback(
        (event?: ReactPointerEvent<HTMLCanvasElement>) => {
            const gesture = gestureRef.current;
            gestureRef.current = null;
            setDraggingAxis(false);
            setPreview(null);

            if (gesture?.mode === "shape") {
                const end = gesture.last;
                const points =
                    activeTool === "line"
                        ? linePoints(gesture.start, end)
                        : activeTool === "circle"
                            ? circlePoints(gesture.start, end)
                            : rectanglePoints(gesture.start, end);
                paintPoints(points);
            }

            if (event?.currentTarget.hasPointerCapture(event.pointerId)) {
                event.currentTarget.releasePointerCapture(event.pointerId);
            }
        },
        [activeTool, paintPoints],
    );

    useEffect(() => {
        drawCanvas();
    }, [drawCanvas]);

    useLayoutEffect(() => {
        const viewport = viewportRef.current;
        const canvas = canvasRef.current;
        const anchor = wheelZoomAnchorRef.current;

        if (!viewport || !canvas) return;

        if (!anchor) {
            if (!initialScrollSetRef.current) {
                viewport.scrollLeft = Math.max(0, canvas.offsetLeft + (canvas.offsetWidth - viewport.clientWidth) / 2);
                viewport.scrollTop = Math.max(0, canvas.offsetTop + (canvas.offsetHeight - viewport.clientHeight) / 2);
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
        const viewport = viewportRef.current;
        if (!viewport) return;

        function handleWheel(event: WheelEvent) {
            if (event.shiftKey && viewportRef.current) {
                event.preventDefault();
                viewportRef.current.scrollLeft += event.deltaX || event.deltaY;
                return;
            }

            if (!event.ctrlKey) return;
            event.preventDefault();

            const oldZoom = zoomRef.current;
            const nextZoom = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, oldZoom + (event.deltaY < 0 ? zoomSpeed : -zoomSpeed)));

            if (nextZoom === oldZoom || !viewportRef.current || !canvasRef.current) return;

            const currentViewport = viewportRef.current;
            const canvas = canvasRef.current;
            const rect = currentViewport.getBoundingClientRect();
            const localX = event.clientX - rect.left - currentViewport.clientLeft;
            const localY = event.clientY - rect.top - currentViewport.clientTop;

            wheelZoomAnchorRef.current = {
                oldZoom,
                localX,
                localY,
                canvasX: localX + currentViewport.scrollLeft - canvas.offsetLeft,
                canvasY: localY + currentViewport.scrollTop - canvas.offsetTop,
            };

            zoomRef.current = nextZoom;
            setZoom(nextZoom);
        }

        viewport.addEventListener("wheel", handleWheel, { passive: false });
        return () => viewport.removeEventListener("wheel", handleWheel);
    }, []);

    useEffect(() => {
        function handleKeyDown(event: KeyboardEvent) {
            if (listeningTool) {
                event.preventDefault();
                const shortcut = event.key.length === 1 ? event.key.toUpperCase() : event.key;
                setShortcuts((current) => {
                    const next = { ...current, [listeningTool]: shortcut };
                    localStorage.setItem("embedpixel-shortcuts", JSON.stringify(next));
                    return next;
                });
                setListeningTool(null);
                return;
            }

            if (event.ctrlKey || event.metaKey || event.altKey || ["INPUT", "TEXTAREA"].includes((event.target as HTMLElement)?.tagName)) return;

            const match = TOOLS.find(
                (tool) => tool.id !== activeTool && shortcuts[tool.id].toUpperCase() === event.key.toUpperCase(),
            );

            if (match) {
                event.preventDefault();
                setActiveTool(match.id);
            }
        }

        window.addEventListener("keydown", handleKeyDown);
        return () => window.removeEventListener("keydown", handleKeyDown);
    }, [activeTool, listeningTool, shortcuts]);

    function changeZoom(amount: number) {
        const nextZoom = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, zoomRef.current + amount));
        wheelZoomAnchorRef.current = null;
        zoomRef.current = nextZoom;
        setZoom(nextZoom);
    }

    function handlePointerDown(event: ReactPointerEvent<HTMLCanvasElement>) {
        if (event.button !== 0) return;

        const position = getCanvasPosition(event.clientX, event.clientY);
        if (!position) return;

        event.currentTarget.setPointerCapture(event.pointerId);

        if (symmetryEnabled) {
            const axisDistance =
                symmetry === "vertical" ? Math.abs(position.x - symmetryPosition) : Math.abs(position.y - symmetryPosition);

            if (axisDistance <= 0.65) {
                gestureRef.current = { start: position.cell, last: position.cell, mode: "paint", axis: symmetry };
                setDraggingAxis(true);
                return;
            }
        }

        if (activeTool === "fill") {
            floodFill(position.cell);
            event.currentTarget.releasePointerCapture(event.pointerId);
            return;
        }

        if (activeTool === "pencil" || activeTool === "eraser") {
            gestureRef.current = { start: position.cell, last: position.cell, mode: "paint" };
            paintPoints([position.cell], activeTool === "eraser");
        } else {
            gestureRef.current = { start: position.cell, last: position.cell, mode: "shape" };
            setPreview({ start: position.cell, end: position.cell });
        }
    }

    function handlePointerMove(event: ReactPointerEvent<HTMLCanvasElement>) {
        const gesture = gestureRef.current;
        if (!gesture) return;

        const position = getCanvasPosition(event.clientX, event.clientY);
        if (!position) return;

        if (gesture.axis) {
            setSymmetryPosition(gesture.axis === "vertical" ? position.x : position.y);
            return;
        }

        if (gesture.mode === "shape") {
            gesture.last = position.cell;
            setPreview({ start: gesture.start, end: position.cell });
            return;
        }

        paintPoints(linePoints(gesture.last, position.cell), activeTool === "eraser");
        gesture.last = position.cell;
    }

    function addLayer() {
        const id = `layer-${nextLayerIdRef.current++}`;
        setLayers((current) => [...current, makeLayer(id, `圖層 ${current.length + 1}`)]);
        setActiveLayerId(id);
    }

    function deleteActiveLayer() {
        if (layers.length <= 1) return;

        const index = layers.findIndex((layer) => layer.id === activeLayerId);
        const remaining = layers.filter((layer) => layer.id !== activeLayerId);

        setLayers(remaining);
        setActiveLayerId(remaining[Math.max(0, index - 1)].id);
    }

    function moveActiveLayer(direction: -1 | 1) {
        setLayers((current) => {
            const index = current.findIndex((layer) => layer.id === activeLayerId);
            const target = index + direction;
            if (index < 0 || target < 0 || target >= current.length) return current;

            const reordered = [...current];
            [reordered[index], reordered[target]] = [reordered[target], reordered[index]];
            return reordered;
        });
    }

    function setSymmetryDirection(nextSymmetry: Symmetry) {
        setSymmetry(nextSymmetry);
        setSymmetryPosition(nextSymmetry === "vertical" ? GRID_WIDTH / 2 : GRID_HEIGHT / 2);
    }

    function resetZoom() {
        zoomRef.current = 1;
        wheelZoomAnchorRef.current = null;
        setZoom(1);
    }

    function handleResetShortcuts() {
        const defaults = createDefaultShortcuts();
        setShortcuts(defaults);
        localStorage.setItem("embedpixel-shortcuts", JSON.stringify(defaults));
    }

    return (
        <main className="editor-shell">
            <header className="topbar">
                <a className="brand" href="#canvas" aria-label="EmbedPixel Studio">
                    EP<span>.</span>
                </a>
                <div className="document-title">
                    <strong>未命名像素作品</strong>
                    <span>64 × 48 px</span>
                </div>
                <nav className="workspace-nav" aria-label="工作區導航">
                    <button className="nav-tab active" type="button">
                        畫布
                    </button>
                    <button className="nav-tab" type="button" disabled title="預留功能">
                        動畫
                    </button>
                    <button className="nav-tab" type="button" disabled title="預留功能">
                        匯出
                    </button>
                </nav>
                <button className="settings-trigger" type="button" onClick={() => setSettingsOpen(true)} aria-label="開啟設定">
                    ⚙ <span>設定</span>
                </button>
            </header>

            <div className="editor-body">
                <ToolRail
                    activeTool={activeTool}
                    color={color}
                    shortcuts={shortcuts}
                    onSelectColor={setColor}
                    onSelectTool={setActiveTool}
                />

                <CanvasWorkspace
                    canvasRef={canvasRef}
                    viewportRef={viewportRef}
                    activeTool={activeToolConfig.label}
                    activeLayerName={activeLayer?.name}
                    gridVisible={gridVisible}
                    zoom={zoom}
                    symmetryEnabled={symmetryEnabled}
                    symmetry={symmetry}
                    draggingAxis={draggingAxis}
                    onPointerDown={handlePointerDown}
                    onPointerMove={handlePointerMove}
                    onPointerUp={finishGesture}
                    onPointerCancel={finishGesture}
                    onToggleGrid={() => setGridVisible((value) => !value)}
                    onToggleSymmetry={() => setSymmetryEnabled((value) => !value)}
                    onSymmetryChange={setSymmetryDirection}
                    onZoomOut={() => changeZoom(-0.1)}
                    onZoomIn={() => changeZoom(0.1)}
                    onResetZoom={resetZoom}
                />

                <LayersPanel
                    layers={layers}
                    activeLayerId={activeLayerId}
                    onAddLayer={addLayer}
                    onDeleteActiveLayer={deleteActiveLayer}
                    onMoveActiveLayer={moveActiveLayer}
                    onSetActiveLayer={setActiveLayerId}
                    onToggleLayerVisibility={(layerId) =>
                        setLayers((current) => current.map((item) => (item.id === layerId ? { ...item, visible: !item.visible } : item)))
                    }
                    symmetryEnabled={symmetryEnabled}
                    symmetry={symmetry}
                    onSetSymmetry={(value) => setSymmetry(value)}
                    onSetSymmetryPosition={setSymmetryPosition}
                    onToggleSymmetry={() => setSymmetryEnabled((value) => !value)}
                />
            </div>

            {settingsOpen && (
                <SettingsDialog
                    gridVisible={gridVisible}
                    shortcuts={shortcuts}
                    listeningTool={listeningTool}
                    onClose={() => {
                        setSettingsOpen(false);
                        setListeningTool(null);
                    }}
                    onToggleGrid={setGridVisible}
                    onSetListeningTool={setListeningTool}
                    onResetShortcuts={handleResetShortcuts}
                />
            )}
        </main>
    );
}

export default App;