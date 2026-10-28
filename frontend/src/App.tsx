import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import type { PointerEvent as ReactPointerEvent } from "react";

import { CanvasWorkspace } from "./components/CanvasWorkspace";
import { ExportDialog, type ExportFormat } from "./components/ExportDialog";
import { LayersPanel } from "./components/LayersPanel";
import { SettingsDialog } from "./components/SettingsDialog";
import { ToolRail } from "./components/ToolRail";
import {
    CELL_SIZE,
    COLORS,
    DISPLAY_PROFILE_PRESETS,
    GRID_HEIGHT,
    GRID_WIDTH,
    MAX_CUSTOM_DIMENSION,
    MAX_ZOOM,
    MIN_ZOOM,
    TOOLS,
    colorsForProfile,
    type DisplayProfile,
} from "./constants/pixelEditor";
import { formatMessage, isLanguage, locales, type Language } from "./resources/locales";
import { IMAGE_ASSETS } from "./resources/images";
import type { Gesture, Layer, Pixel, Point, Preview, Selection, ShortcutMap, Symmetry, Tool } from "./types/pixelEditor";
import { circlePoints, circularBrushOffsets, linePoints, makeLayer, rectanglePoints } from "./utils/pixelEditor";
import "./App.css";

function createDefaultShortcuts(): ShortcutMap {
    return Object.fromEntries(TOOLS.map((tool) => [tool.id, tool.shortcut])) as ShortcutMap;
}

type HistorySnapshot = {
    layers: Layer[];
    activeLayerId: string;
    selection: Selection | null;
};

type SelectionMovePreview = {
    source: Selection;
    pixels: Pixel[][];
    offset: Point;
};

const MAX_HISTORY_STEPS = 100;

function convertLayerSize(layer: Layer, width: number, height: number, palette?: string[]): Layer {
    return {
        ...layer,
        pixels: Array.from({ length: height }, (_, y) =>
            Array.from({ length: width }, (_, x) => {
                const pixel = layer.pixels[y]?.[x] ?? null;
                if (!pixel || !palette) return pixel;

                const channels = pixel.match(/[\da-f]{2}/gi)?.slice(0, 3).map((channel) => parseInt(channel, 16));
                if (!channels || channels.length !== 3) return palette[0];

                const luminance = channels[0] * 0.2126 + channels[1] * 0.7152 + channels[2] * 0.0722;
                const index = palette.length === 2 ? (luminance >= 128 ? 1 : 0) : Math.round((luminance / 255) * (palette.length - 1));
                return palette[index];
            }),
        ),
    };
}

function App() {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const viewportRef = useRef<HTMLDivElement>(null);
    const zoomRef = useRef(1);
    const initialScrollSetRef = useRef(false);
    const gestureRef = useRef<Gesture | null>(null);
    const nextLayerIdRef = useRef(2);
    const wheelZoomAnchorRef = useRef<{ oldZoom: number; localX: number; localY: number; canvasX: number; canvasY: number } | null>(null);

    const [language, setLanguage] = useState<Language>(() => {
        try {
            const saved = localStorage.getItem("embedpixel-language");
            return isLanguage(saved) ? saved : "zh-Hant";
        } catch {
            return "zh-Hant";
        }
    });
    const messages = locales[language];
    const [zoom, setZoom] = useState(1);
    const [displayProfile, setDisplayProfile] = useState<DisplayProfile>("custom");
    const [canvasSize, setCanvasSize] = useState({ width: GRID_WIDTH, height: GRID_HEIGHT });
    const [layers, setLayers] = useState<Layer[]>(() => [
        makeLayer("layer-1", formatMessage(messages.layers.defaultName, { number: 1 }), canvasSize.width, canvasSize.height),
    ]);
    const [activeLayerId, setActiveLayerId] = useState("layer-1");
    const historyRef = useRef<{ past: HistorySnapshot[]; future: HistorySnapshot[] }>({ past: [], future: [] });
    const [historyState, setHistoryState] = useState({ canUndo: false, canRedo: false });
    const [activeTool, setActiveTool] = useState<Tool>("pencil");
    const [brushSize, setBrushSize] = useState(1);
    const [color, setColor] = useState(COLORS[0]);
    const [gridVisible, setGridVisible] = useState(true);
    const [symmetryEnabled, setSymmetryEnabled] = useState(false);
    const [symmetry, setSymmetry] = useState<Symmetry>("vertical");
    const [symmetryPosition, setSymmetryPosition] = useState(canvasSize.width / 2);
    const [draggingAxis, setDraggingAxis] = useState(false);
    const [preview, setPreview] = useState<Preview | null>(null);
    const [selection, setSelection] = useState<Selection | null>(null);
    const [selectionMovePreview, setSelectionMovePreview] = useState<SelectionMovePreview | null>(null);
    const [settingsOpen, setSettingsOpen] = useState(false);
    const [exportDialogOpen, setExportDialogOpen] = useState(false);
    const [listeningTool, setListeningTool] = useState<Tool | null>(null);
    const [exportStatus, setExportStatus] = useState<"idle" | "sending" | "success" | "error">("idle");
    const [shortcuts, setShortcuts] = useState<ShortcutMap>(() => {
        try {
            const saved = localStorage.getItem("embedpixel-shortcuts");
            return saved ? { ...createDefaultShortcuts(), ...JSON.parse(saved) } : createDefaultShortcuts();
        } catch {
            return createDefaultShortcuts();
        }
    });

    const zoomSpeed = 0.3;
    const activeLayer = layers.find((layer) => layer.id === activeLayerId);

    function changeActiveTool(nextTool: Tool) {
        if (nextTool !== "select") {
            if (gestureRef.current?.mode === "select" || gestureRef.current?.mode === "move") gestureRef.current = null;
            setSelection(null);
            setSelectionMovePreview(null);
        }
        setActiveTool(nextTool);
    }

    const updateHistoryState = useCallback(() => {
        setHistoryState({
            canUndo: historyRef.current.past.length > 0,
            canRedo: historyRef.current.future.length > 0,
        });
    }, []);

    const recordHistory = useCallback(() => {
        historyRef.current.past.push({ layers, activeLayerId, selection });
        if (historyRef.current.past.length > MAX_HISTORY_STEPS) historyRef.current.past.shift();
        historyRef.current.future = [];
        updateHistoryState();
    }, [activeLayerId, layers, selection, updateHistoryState]);

    const undo = useCallback(() => {
        const previous = historyRef.current.past.pop();
        if (!previous) return;

        historyRef.current.future.push({ layers, activeLayerId, selection });
        setLayers(previous.layers);
        setActiveLayerId(previous.activeLayerId);
        setSelection(previous.selection);
        updateHistoryState();
    }, [activeLayerId, layers, selection, updateHistoryState]);

    const redo = useCallback(() => {
        const next = historyRef.current.future.pop();
        if (!next) return;

        historyRef.current.past.push({ layers, activeLayerId, selection });
        if (historyRef.current.past.length > MAX_HISTORY_STEPS) historyRef.current.past.shift();
        setLayers(next.layers);
        setActiveLayerId(next.activeLayerId);
        setSelection(next.selection);
        updateHistoryState();
    }, [activeLayerId, layers, selection, updateHistoryState]);

    function clearHistory() {
        historyRef.current = { past: [], future: [] };
        updateHistoryState();
    }

    function changeDisplayProfile(nextProfile: DisplayProfile) {
        if (nextProfile === displayProfile) return;

        const preset = nextProfile === "custom" ? null : DISPLAY_PROFILE_PRESETS[nextProfile];
        const nextSize = preset ?? canvasSize;
        const palette = colorsForProfile(nextProfile);

        setLayers((current) => current.map((layer) => convertLayerSize(
            layer,
            nextSize.width,
            nextSize.height,
            nextProfile === "custom" ? undefined : palette,
        )));
        setCanvasSize(nextSize);
        setDisplayProfile(nextProfile);
        setColor(palette[0]);
        setSymmetryPosition(symmetry === "vertical" ? nextSize.width / 2 : nextSize.height / 2);
        gestureRef.current = null;
        setPreview(null);
        setSelection(null);
        setSelectionMovePreview(null);
        clearHistory();
    }

    function changeCustomSize(width: number, height: number) {
        if (displayProfile !== "custom" || !Number.isFinite(width) || !Number.isFinite(height)) return;

        const nextSize = {
            width: Math.min(MAX_CUSTOM_DIMENSION, Math.max(1, Math.round(width))),
            height: Math.min(MAX_CUSTOM_DIMENSION, Math.max(1, Math.round(height))),
        };
        if (nextSize.width === canvasSize.width && nextSize.height === canvasSize.height) return;

        setLayers((current) => current.map((layer) => convertLayerSize(layer, nextSize.width, nextSize.height)));
        setCanvasSize(nextSize);
        setSymmetryPosition(symmetry === "vertical" ? nextSize.width / 2 : nextSize.height / 2);
        gestureRef.current = null;
        setPreview(null);
        setSelection(null);
        setSelectionMovePreview(null);
        clearHistory();
    }

    useEffect(() => {
        document.documentElement.lang = language;
        document.title = messages.appName;
    }, [language, messages.appName]);

    useEffect(() => {
        const favicon = document.querySelector<HTMLLinkElement>('link[rel="icon"]');
        if (favicon) favicon.href = IMAGE_ASSETS.appIcon;
    }, []);

    const drawCanvas = useCallback(() => {
        const canvas = canvasRef.current;
        const context = canvas?.getContext("2d");
        if (!canvas || !context) return;

        context.clearRect(0, 0, canvas.width, canvas.height);

        for (const layer of layers) {
            if (!layer.visible) continue;
            for (let y = 0; y < canvasSize.height; y += 1) {
                for (let x = 0; x < canvasSize.width; x += 1) {
                    if (selectionMovePreview && layer.id === activeLayerId
                        && x >= selectionMovePreview.source.x && x < selectionMovePreview.source.x + selectionMovePreview.source.width
                        && y >= selectionMovePreview.source.y && y < selectionMovePreview.source.y + selectionMovePreview.source.height) continue;
                    const pixel = layer.pixels[y][x];
                    if (pixel) {
                        context.fillStyle = pixel;
                        context.fillRect(x * CELL_SIZE, y * CELL_SIZE, CELL_SIZE, CELL_SIZE);
                    }
                }
            }

            if (selectionMovePreview && layer.id === activeLayerId) {
                const { source, pixels, offset } = selectionMovePreview;
                for (let y = 0; y < pixels.length; y += 1) {
                    for (let x = 0; x < (pixels[y]?.length ?? 0); x += 1) {
                        const pixel = pixels[y][x];
                        if (pixel) {
                            context.fillStyle = pixel;
                            context.fillRect((source.x + offset.x + x) * CELL_SIZE, (source.y + offset.y + y) * CELL_SIZE, CELL_SIZE, CELL_SIZE);
                        }
                    }
                }
            }
        }

        if (gridVisible) {
            context.strokeStyle = "rgba(63, 66, 61, .18)";
            context.lineWidth = 1;
            for (let x = 0; x <= canvasSize.width; x += 1) {
                context.beginPath();
                context.moveTo(x * CELL_SIZE + 0.5, 0);
                context.lineTo(x * CELL_SIZE + 0.5, canvas.height);
                context.stroke();
            }
            for (let y = 0; y <= canvasSize.height; y += 1) {
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
                if (point.x >= 0 && point.x < canvasSize.width && point.y >= 0 && point.y < canvasSize.height) {
                    context.fillRect(point.x * CELL_SIZE, point.y * CELL_SIZE, CELL_SIZE, CELL_SIZE);
                }
            }
        }

        if (selection) {
            const selected = selectionMovePreview
                ? { ...selectionMovePreview.source, x: selectionMovePreview.source.x + selectionMovePreview.offset.x, y: selectionMovePreview.source.y + selectionMovePreview.offset.y }
                : selection;
            context.save();
            context.lineWidth = Math.max(1, 1 / zoom);
            context.setLineDash([4 / zoom, 3 / zoom]);
            context.strokeStyle = "#fffefa";
            context.strokeRect(selected.x * CELL_SIZE + 0.5, selected.y * CELL_SIZE + 0.5, selected.width * CELL_SIZE - 1, selected.height * CELL_SIZE - 1);
            context.lineDashOffset = 3 / zoom;
            context.strokeStyle = "#30322e";
            context.strokeRect(selected.x * CELL_SIZE + 0.5, selected.y * CELL_SIZE + 0.5, selected.width * CELL_SIZE - 1, selected.height * CELL_SIZE - 1);
            context.restore();
        }

    }, [activeLayerId, activeTool, canvasSize.height, canvasSize.width, color, gridVisible, layers, preview, selection, selectionMovePreview, symmetry, symmetryEnabled, symmetryPosition, zoom]);

    const getCanvasPosition = useCallback((clientX: number, clientY: number, allowOutside = false) => {
        const canvas = canvasRef.current;
        if (!canvas) return null;

        const rect = canvas.getBoundingClientRect();
        const x = ((clientX - rect.left) * canvas.width) / rect.width / CELL_SIZE;
        const y = ((clientY - rect.top) * canvas.height) / rect.height / CELL_SIZE;

        if (!allowOutside && (x < 0 || x >= canvasSize.width || y < 0 || y >= canvasSize.height)) return null;
        return { x, y, cell: { x: Math.floor(x), y: Math.floor(y) } };
    }, [canvasSize.height, canvasSize.width]);

    const paintPoints = useCallback(
        (points: Point[], erase = false, useBrush = false) => {
            const layerId = activeLayerId;
            const stampSize = useBrush ? brushSize : 1;
            const stampOffsets = useBrush ? circularBrushOffsets(stampSize) : [{ x: 0, y: 0 }];
            setLayers((current) =>
                current.map((layer) => {
                    if (layer.id !== layerId) return layer;

                    const pixels = [...layer.pixels];
                    const changedRows = new Map<number, Pixel[]>();

                    const setPixel = (x: number, y: number) => {
                        if (x < 0 || x >= canvasSize.width || y < 0 || y >= canvasSize.height) return;

                        let row = changedRows.get(y);
                        if (!row) {
                            row = [...pixels[y]];
                            changedRows.set(y, row);
                            pixels[y] = row;
                        }
                        row[x] = erase ? null : color;
                    };

                    for (const point of points) {
                        for (const offset of stampOffsets) {
                            const pixelX = point.x + offset.x;
                            const pixelY = point.y + offset.y;
                            setPixel(pixelX, pixelY);
                            if (symmetryEnabled) {
                                if (symmetry === "vertical") {
                                    setPixel(Math.round(2 * symmetryPosition - pixelX - 1), pixelY);
                                } else {
                                    setPixel(pixelX, Math.round(2 * symmetryPosition - pixelY - 1));
                                }
                            }
                        }
                    }

                    return { ...layer, pixels };
                }),
            );
        },
        [activeLayerId, brushSize, canvasSize.height, canvasSize.width, color, symmetry, symmetryEnabled, symmetryPosition],
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
                        if (seed.x < 0 || seed.x >= canvasSize.width || seed.y < 0 || seed.y >= canvasSize.height) continue;
                        const target = pixels[seed.y][seed.x];
                        if (target === color) continue;

                        const queue: Point[] = [seed];
                        let cursor = 0;

                        while (cursor < queue.length) {
                            const currentPoint = queue[cursor++];
                            if (currentPoint.x < 0 || currentPoint.x >= canvasSize.width || currentPoint.y < 0 || currentPoint.y >= canvasSize.height) continue;
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
        [activeLayerId, canvasSize.height, canvasSize.width, color, symmetry, symmetryEnabled, symmetryPosition],
    );

    const finishGesture = useCallback(
        (event?: ReactPointerEvent<HTMLCanvasElement>) => {
            const gesture = gestureRef.current;
            gestureRef.current = null;
            setDraggingAxis(false);
            setPreview(null);
            setSelectionMovePreview(null);

            if (gesture?.mode === "shape") {
                const end = gesture.last;
                const points =
                    activeTool === "line"
                        ? linePoints(gesture.start, end)
                        : activeTool === "circle"
                            ? circlePoints(gesture.start, end)
                            : rectanglePoints(gesture.start, end);
                recordHistory();
                paintPoints(points);
            }

            if (gesture?.mode === "move" && gesture.selection && gesture.pixels) {
                const offset = selectionMovePreview?.offset ?? { x: 0, y: 0 };
                if (offset.x !== 0 || offset.y !== 0) {
                    const source = gesture.selection;
                    recordHistory();
                    setLayers((current) => current.map((layer) => {
                        if (layer.id !== activeLayerId) return layer;
                        const pixels = layer.pixels.map((row) => [...row]);
                        for (let y = Math.max(0, source.y); y < Math.min(canvasSize.height, source.y + source.height); y += 1) {
                            for (let x = Math.max(0, source.x); x < Math.min(canvasSize.width, source.x + source.width); x += 1) {
                                pixels[y][x] = null;
                            }
                        }
                        const destinationX = source.x + offset.x;
                        const destinationY = source.y + offset.y;
                        for (let y = 0; y < gesture.pixels!.length; y += 1) {
                            for (let x = 0; x < (gesture.pixels![y]?.length ?? 0); x += 1) {
                                const pixel = gesture.pixels![y][x];
                                const targetX = destinationX + x;
                                const targetY = destinationY + y;
                                if (pixel !== null && targetX >= 0 && targetX < canvasSize.width && targetY >= 0 && targetY < canvasSize.height) {
                                    pixels[targetY][targetX] = pixel;
                                }
                            }
                        }
                        return { ...layer, pixels };
                    }));
                    setSelection({ ...source, x: source.x + offset.x, y: source.y + offset.y });
                }
            }

            if (event?.currentTarget.hasPointerCapture(event.pointerId)) {
                event.currentTarget.releasePointerCapture(event.pointerId);
            }
        },
        [activeLayerId, activeTool, canvasSize.height, canvasSize.width, paintPoints, recordHistory, selectionMovePreview],
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

    useLayoutEffect(() => {
        const viewport = viewportRef.current;
        const canvas = canvasRef.current;
        if (!viewport || !canvas) return;

        viewport.scrollLeft = Math.max(0, canvas.offsetLeft + (canvas.offsetWidth - viewport.clientWidth) / 2);
        viewport.scrollTop = Math.max(0, canvas.offsetTop + (canvas.offsetHeight - viewport.clientHeight) / 2);
    }, [canvasSize.height, canvasSize.width]);

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
                if (event.key === "Escape") {
                    event.preventDefault();
                    setListeningTool(null);
                    return;
                }
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

            if (event.key === "Escape" && (selection || gestureRef.current?.mode === "select" || gestureRef.current?.mode === "move")) {
                event.preventDefault();
                if (gestureRef.current?.mode === "select" || gestureRef.current?.mode === "move") gestureRef.current = null;
                setSelection(null);
                setSelectionMovePreview(null);
                return;
            }

            const target = event.target as HTMLElement;
            const isEditableTarget = ["INPUT", "TEXTAREA", "SELECT"].includes(target?.tagName) || target?.isContentEditable;
            if (!isEditableTarget && event.key === "Backspace" && selection) {
                event.preventDefault();
                const selectedLayer = layers.find((layer) => layer.id === activeLayerId);
                const hasPixels = selectedLayer?.pixels.some((row, y) =>
                    y >= Math.max(0, selection.y) && y < Math.min(canvasSize.height, selection.y + selection.height)
                    && row.slice(Math.max(0, selection.x), Math.min(canvasSize.width, selection.x + selection.width)).some((pixel) => pixel !== null),
                );
                if (hasPixels) {
                    recordHistory();
                    setLayers((current) => current.map((layer) => {
                        if (layer.id !== activeLayerId) return layer;
                        const pixels = [...layer.pixels];
                        for (let y = Math.max(0, selection.y); y < Math.min(canvasSize.height, selection.y + selection.height); y += 1) {
                            pixels[y] = [...pixels[y]];
                            for (let x = Math.max(0, selection.x); x < Math.min(canvasSize.width, selection.x + selection.width); x += 1) pixels[y][x] = null;
                        }
                        return { ...layer, pixels };
                    }));
                }
                return;
            }
            if (!isEditableTarget && (event.ctrlKey || event.metaKey) && !event.altKey) {
                const key = event.key.toLowerCase();
                if (key === "z") {
                    event.preventDefault();
                    undo();
                    return;
                }
                if (key === "x") {
                    event.preventDefault();
                    redo();
                    return;
                }
            }

            if (event.ctrlKey || event.metaKey || event.altKey || isEditableTarget) return;

            const match = TOOLS.find(
                (tool) => tool.id !== activeTool && shortcuts[tool.id].toUpperCase() === event.key.toUpperCase(),
            );

            if (match) {
                event.preventDefault();
                changeActiveTool(match.id);
            }
        }

        window.addEventListener("keydown", handleKeyDown);
        return () => window.removeEventListener("keydown", handleKeyDown);
    }, [activeLayerId, activeTool, canvasSize.height, canvasSize.width, layers, listeningTool, recordHistory, redo, selection, shortcuts, undo]);

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

        if (symmetryEnabled && activeTool !== "select") {
            const axisDistance =
                symmetry === "vertical" ? Math.abs(position.x - symmetryPosition) : Math.abs(position.y - symmetryPosition);

            if (axisDistance <= 0.65) {
                gestureRef.current = { start: position.cell, last: position.cell, mode: "paint", axis: symmetry };
                setDraggingAxis(true);
                return;
            }
        }

        if (activeTool === "select") {
            const selected = selection && position.cell.x >= selection.x && position.cell.x < selection.x + selection.width
                && position.cell.y >= selection.y && position.cell.y < selection.y + selection.height;
            if (selected) {
                const layer = layers.find((item) => item.id === activeLayerId);
                const pixels = Array.from({ length: selection.height }, (_, y) =>
                    Array.from({ length: selection.width }, (_, x) => layer?.pixels[selection.y + y]?.[selection.x + x] ?? null),
                );
                gestureRef.current = { start: position.cell, last: position.cell, mode: "move", selection, pixels };
                setSelectionMovePreview({ source: selection, pixels, offset: { x: 0, y: 0 } });
            } else {
                const nextSelection = { x: position.cell.x, y: position.cell.y, width: 1, height: 1 };
                gestureRef.current = { start: position.cell, last: position.cell, mode: "select" };
                setSelection(nextSelection);
                setSelectionMovePreview(null);
            }
            return;
        }

        if (activeTool === "fill") {
            recordHistory();
            floodFill(position.cell);
            event.currentTarget.releasePointerCapture(event.pointerId);
            return;
        }

        if (activeTool === "pencil" || activeTool === "eraser") {
            recordHistory();
            gestureRef.current = { start: position.cell, last: position.cell, mode: "paint" };
            paintPoints([position.cell], activeTool === "eraser", true);
        } else {
            gestureRef.current = { start: position.cell, last: position.cell, mode: "shape" };
            setPreview({ start: position.cell, end: position.cell });
        }
    }

    function handlePointerMove(event: ReactPointerEvent<HTMLCanvasElement>) {
        const gesture = gestureRef.current;
        const position = getCanvasPosition(event.clientX, event.clientY, gesture?.mode === "move");
        if (!position) return;
        if (!gesture) return;

        if (gesture.axis) {
            setSymmetryPosition(gesture.axis === "vertical" ? position.x : position.y);
            return;
        }

        if (gesture.mode === "select") {
            const x = Math.min(gesture.start.x, position.cell.x);
            const y = Math.min(gesture.start.y, position.cell.y);
            setSelection({
                x,
                y,
                width: Math.abs(position.cell.x - gesture.start.x) + 1,
                height: Math.abs(position.cell.y - gesture.start.y) + 1,
            });
            gesture.last = position.cell;
            return;
        }

        if (gesture.mode === "move" && gesture.selection && gesture.pixels) {
            const offset = {
                x: position.cell.x - gesture.start.x,
                y: position.cell.y - gesture.start.y,
            };
            setSelectionMovePreview({ source: gesture.selection, pixels: gesture.pixels, offset });
            return;
        }

        if (gesture.mode === "shape") {
            gesture.last = position.cell;
            setPreview({ start: gesture.start, end: position.cell });
            return;
        }

        paintPoints(linePoints(gesture.last, position.cell), activeTool === "eraser", true);
        gesture.last = position.cell;
    }

    function addLayer() {
        const id = `layer-${nextLayerIdRef.current++}`;
        recordHistory();
        setLayers((current) => [
            ...current,
            makeLayer(id, formatMessage(messages.layers.defaultName, { number: current.length + 1 }), canvasSize.width, canvasSize.height),
        ]);
        setActiveLayerId(id);
    }

    function changeLanguage(nextLanguage: Language) {
        setLanguage(nextLanguage);
        try {
            localStorage.setItem("embedpixel-language", nextLanguage);
        } catch {
            // The current session still switches language when storage is unavailable.
        }
    }

    function deleteActiveLayer() {
        if (layers.length <= 1) return;

        const index = layers.findIndex((layer) => layer.id === activeLayerId);
        const remaining = layers.filter((layer) => layer.id !== activeLayerId);

        recordHistory();
        setLayers(remaining);
        setActiveLayerId(remaining[Math.max(0, index - 1)].id);
    }

    function moveActiveLayer(direction: -1 | 1) {
        const index = layers.findIndex((layer) => layer.id === activeLayerId);
        const target = index + direction;
        if (index < 0 || target < 0 || target >= layers.length) return;

        recordHistory();
        setLayers((current) => {
            const reordered = [...current];
            [reordered[index], reordered[target]] = [reordered[target], reordered[index]];
            return reordered;
        });
    }

    function toggleLayerVisibility(layerId: string) {
        if (!layers.some((layer) => layer.id === layerId)) return;
        recordHistory();
        setLayers((current) => current.map((item) => (item.id === layerId ? { ...item, visible: !item.visible } : item)));
    }

    function setSymmetryDirection(nextSymmetry: Symmetry) {
        setSymmetry(nextSymmetry);
        setSymmetryPosition(nextSymmetry === "vertical" ? canvasSize.width / 2 : canvasSize.height / 2);
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

    async function exportCanvas(format: ExportFormat, target: string, fileName: string) {
        if (exportStatus === "sending") return;

        const pixels = Array.from({ length: canvasSize.height }, (_, y) =>
            Array.from({ length: canvasSize.width }, (_, x) => {
                if (target !== "all") {
                    return layers.find((layer) => layer.id === target)?.pixels[y]?.[x] ?? null;
                }
                for (let layerIndex = layers.length - 1; layerIndex >= 0; layerIndex -= 1) {
                    const layer = layers[layerIndex];
                    const pixel = layer.visible ? layer.pixels[y]?.[x] : null;
                    if (pixel) return pixel;
                }
                return null;
            }),
        );

        setExportStatus("sending");
        try {
            const response = await fetch(import.meta.env.VITE_EXPORT_ENDPOINT || "/api/export", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ format, pixels }),
            });
            if (!response.ok) {
                setExportStatus("error");
                return;
            }

            const downloadUrl = URL.createObjectURL(await response.blob());
            const downloadLink = document.createElement("a");
            downloadLink.href = downloadUrl;
            const safeFileName = Array.from(fileName.trim())
                .filter((character) => character.charCodeAt(0) >= 32)
                .join("")
                .replace(/[<>:"/\\|?*]/g, "-")
                .replace(/[. ]+$/, "") || "pixel-art";
            downloadLink.download = `${safeFileName.replace(/\.(svg|png|bmp)$/i, "")}.${format.toLowerCase()}`;
            downloadLink.click();
            URL.revokeObjectURL(downloadUrl);
            setExportStatus("success");
            setExportDialogOpen(false);
        } catch {
            setExportStatus("error");
        }
    }

    return (
        <main className="editor-shell">
            <header className="topbar">
                <a className="brand" href="#canvas" aria-label={messages.appName}>
                    EP<span>.</span>
                </a>
                <div className="document-title">
                    <strong>{messages.document.untitled}</strong>
                    <span>{formatMessage(messages.document.dimensions, canvasSize)}</span>
                </div>
                <nav className="workspace-nav" aria-label={messages.navigation.label}>
                    <button className="nav-tab active" type="button">
                        {messages.navigation.canvas}
                    </button>
                    <button className="nav-tab" type="button" onClick={() => setExportDialogOpen(true)} disabled={exportStatus === "sending"}>
                        {exportStatus === "sending" ? messages.navigation.exportSending : messages.navigation.export}
                    </button>
                    {exportStatus !== "idle" && (
                        <span className={`export-status ${exportStatus}`} role="status" aria-live="polite">
                            {messages.navigation[`export${exportStatus[0].toUpperCase()}${exportStatus.slice(1)}` as "exportSending" | "exportSuccess" | "exportError"]}
                        </span>
                    )}
                </nav>
                <button className="settings-trigger" type="button" onClick={() => setSettingsOpen(true)} aria-label={messages.settingsTrigger.label}>
                    ⚙ <span>{messages.settingsTrigger.text}</span>
                </button>
            </header>

            <div className="editor-body">
                <ToolRail
                    activeTool={activeTool}
                    color={color}
                    colors={colorsForProfile(displayProfile)}
                    shortcuts={shortcuts}
                    messages={messages}
                    onSelectColor={setColor}
                    onSelectTool={changeActiveTool}
                />

                <CanvasWorkspace
                    canvasRef={canvasRef}
                    viewportRef={viewportRef}
                    activeTool={messages.tools[activeTool]}
                    showBrushSize={activeTool === "pencil" || activeTool === "eraser"}
                    brushSize={brushSize}
                    onBrushSizeChange={setBrushSize}
                    activeLayerName={activeLayer?.name}
                    messages={messages}
                    gridVisible={gridVisible}
                    displayProfile={displayProfile}
                    canvasWidth={canvasSize.width}
                    canvasHeight={canvasSize.height}
                    onChangeDisplayProfile={changeDisplayProfile}
                    onCustomSizeChange={changeCustomSize}
                    canUndo={historyState.canUndo}
                    canRedo={historyState.canRedo}
                    onUndo={undo}
                    onRedo={redo}
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
                    messages={messages}
                    canvasWidth={canvasSize.width}
                    canvasHeight={canvasSize.height}
                    activeLayerId={activeLayerId}
                    onAddLayer={addLayer}
                    onDeleteActiveLayer={deleteActiveLayer}
                    onMoveActiveLayer={moveActiveLayer}
                    onSetActiveLayer={setActiveLayerId}
                    onToggleLayerVisibility={toggleLayerVisibility}
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
                    language={language}
                    messages={messages}
                    shortcuts={shortcuts}
                    listeningTool={listeningTool}
                    onClose={() => {
                        setSettingsOpen(false);
                        setListeningTool(null);
                    }}
                    onToggleGrid={setGridVisible}
                    onChangeLanguage={changeLanguage}
                    onSetListeningTool={setListeningTool}
                    onResetShortcuts={handleResetShortcuts}
                />
            )}
            {exportDialogOpen && (
                <ExportDialog
                    layers={layers}
                    messages={messages}
                    sending={exportStatus === "sending"}
                    onClose={() => setExportDialogOpen(false)}
                    onExport={exportCanvas}
                />
            )}
        </main>
    );
}

export default App;