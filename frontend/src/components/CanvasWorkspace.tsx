import { useRef } from "react";
import type { PointerEvent as ReactPointerEvent, RefObject } from "react";

import { CELL_SIZE, MAX_CUSTOM_DIMENSION, type DisplayProfile } from "../constants/pixelEditor";
import { formatMessage, type Messages } from "../resources/locales";
import type { Symmetry } from "../types/pixelEditor";

type CanvasWorkspaceProps = {
    canvasRef: RefObject<HTMLCanvasElement | null>;
    viewportRef: RefObject<HTMLDivElement | null>;
    activeTool: string;
    showBrushSize: boolean;
    brushSize: number;
    onBrushSizeChange: (size: number) => void;
    activeLayerName?: string;
    messages: Messages;
    gridVisible: boolean;
    displayProfile: DisplayProfile;
    canvasWidth: number;
    canvasHeight: number;
    onChangeDisplayProfile: (profile: DisplayProfile) => void;
    onCustomSizeChange: (width: number, height: number) => void;
    canUndo: boolean;
    canRedo: boolean;
    onUndo: () => void;
    onRedo: () => void;
    zoom: number;
    symmetryEnabled: boolean;
    symmetry: Symmetry;
    draggingAxis: boolean;
    onPointerDown: (event: ReactPointerEvent<HTMLCanvasElement>) => void;
    onPointerMove: (event: ReactPointerEvent<HTMLCanvasElement>) => void;
    onPointerUp: (event: ReactPointerEvent<HTMLCanvasElement>) => void;
    onPointerCancel: (event: ReactPointerEvent<HTMLCanvasElement>) => void;
    onToggleGrid: () => void;
    onToggleSymmetry: () => void;
    onSymmetryChange: (nextSymmetry: Symmetry) => void;
    onZoomOut: () => void;
    onZoomIn: () => void;
    onResetZoom: () => void;
};

export function CanvasWorkspace({
    canvasRef,
    viewportRef,
    activeTool,
    showBrushSize,
    brushSize,
    onBrushSizeChange,
    activeLayerName,
    messages,
    gridVisible,
    displayProfile,
    canvasWidth,
    canvasHeight,
    onChangeDisplayProfile,
    onCustomSizeChange,
    canUndo,
    canRedo,
    onUndo,
    onRedo,
    zoom,
    symmetryEnabled,
    symmetry,
    draggingAxis,
    onPointerDown,
    onPointerMove,
    onPointerUp,
    onPointerCancel,
    onToggleGrid,
    onToggleSymmetry,
    onSymmetryChange,
    onZoomOut,
    onZoomIn,
    onResetZoom,
}: CanvasWorkspaceProps) {
    const widthInputRef = useRef<HTMLInputElement>(null);
    const heightInputRef = useRef<HTMLInputElement>(null);

    function applyCustomSize() {
        const width = Number(widthInputRef.current?.value);
        const height = Number(heightInputRef.current?.value);
        if (!Number.isInteger(width) || !Number.isInteger(height) || width < 1 || height < 1 || width > MAX_CUSTOM_DIMENSION || height > MAX_CUSTOM_DIMENSION) {
            if (widthInputRef.current) widthInputRef.current.value = String(canvasWidth);
            if (heightInputRef.current) heightInputRef.current.value = String(canvasHeight);
            return;
        }
        onCustomSizeChange(width, height);
    }

    return (
        <section className="canvas-workspace" id="canvas" aria-label={messages.canvas.label}>
            <div className="canvas-toolbar">
                <div className="tool-context">
                    <span className="context-dot" />
                    {activeTool}
                    <span className="context-separator">/</span>
                    {activeLayerName}
                    {showBrushSize && (
                        <label className="brush-size-control" htmlFor="brush-size">
                            <span>{messages.toolRail.brushSize}</span>
                            <input
                                id="brush-size"
                                type="range"
                                min={1}
                                max={8}
                                step={1}
                                value={brushSize}
                                onChange={(event) => onBrushSizeChange(Number(event.target.value))}
                                aria-label={messages.toolRail.brushSize}
                            />
                            <output>{brushSize}</output>
                        </label>
                    )}
                </div>
                <div className="canvas-actions">
                    <label className="display-profile-control">
                        <span>{messages.canvas.displayProfile}</span>
                        <select
                            className="display-profile-select"
                            aria-label={messages.canvas.displayProfile}
                            value={displayProfile}
                            onChange={(event) => onChangeDisplayProfile(event.target.value as DisplayProfile)}
                        >
                            <option value="custom">{messages.canvas.customSize}</option>
                            <option value="ssd1306">{messages.canvas.ssd1306}</option>
                            <option value="ssd1327">{messages.canvas.ssd1327}</option>
                        </select>
                    </label>
                    {displayProfile === "custom" && (
                        <div className="custom-size-controls">
                            <label>
                                <span>{messages.canvas.width}</span>
                                <input
                                    ref={widthInputRef}
                                    type="number"
                                    min={1}
                                    max={MAX_CUSTOM_DIMENSION}
                                    defaultValue={canvasWidth}
                                    aria-label={messages.canvas.width}
                                    onBlur={applyCustomSize}
                                    onKeyDown={(event) => {
                                        if (event.key === "Enter") event.currentTarget.blur();
                                    }}
                                />
                            </label>
                            <label>
                                <span>{messages.canvas.height}</span>
                                <input
                                    ref={heightInputRef}
                                    type="number"
                                    min={1}
                                    max={MAX_CUSTOM_DIMENSION}
                                    defaultValue={canvasHeight}
                                    aria-label={messages.canvas.height}
                                    onBlur={applyCustomSize}
                                    onKeyDown={(event) => {
                                        if (event.key === "Enter") event.currentTarget.blur();
                                    }}
                                />
                            </label>
                        </div>
                    )}
                    <span className="action-divider" />
                    <button type="button" onClick={onUndo} disabled={!canUndo} aria-label={messages.canvas.undo} title={`${messages.canvas.undo} (Ctrl+Z)`}>
                        ↶
                    </button>
                    <button type="button" onClick={onRedo} disabled={!canRedo} aria-label={messages.canvas.redo} title={`${messages.canvas.redo} (Ctrl+X)`}>
                        ↷
                    </button>
                    <span className="action-divider" />
                    <button
                        type="button"
                        className={`symmetry-toggle ${symmetryEnabled ? "on" : ""}`}
                        onClick={onToggleSymmetry}
                        aria-pressed={symmetryEnabled}
                        title={messages.canvas.symmetryTitle}
                    >
                        ⌁ <span>{messages.canvas.symmetry}</span>
                    </button>
                    <select
                        aria-label={messages.canvas.symmetryDirection}
                        value={symmetry}
                        onChange={(event) =>
                            onSymmetryChange(event.target.value as Symmetry)
                        }
                    >
                        <option value="vertical">{messages.canvas.verticalAxis}</option>
                        <option value="horizontal">{messages.canvas.horizontalAxis}</option>
                    </select>
                    <span className="action-divider" />
                    <button
                        type="button"
                        className={`grid-toggle ${gridVisible ? "on" : ""}`}
                        onClick={onToggleGrid}
                        aria-pressed={gridVisible}
                        title={messages.canvas.gridTitle}
                    >
                        ▦
                    </button>
                    <button type="button" onClick={onZoomOut} aria-label={messages.canvas.zoomOut}>
                        −
                    </button>
                    <span className="zoom-value">{Math.round(zoom * 100)}%</span>
                    <button type="button" onClick={onZoomIn} aria-label={messages.canvas.zoomIn}>
                        +
                    </button>
                    <button type="button" className="fit-button" onClick={onResetZoom}>
                        {messages.canvas.fit}
                    </button>
                </div>
            </div>

            <div className="canvas-stage" ref={viewportRef}>
                <div className="canvas-mat">
                    <div
                        className="canvas-paper"
                        style={{
                            width: canvasWidth * CELL_SIZE * zoom,
                            height: canvasHeight * CELL_SIZE * zoom,
                        }}
                    >
                        <canvas
                            ref={canvasRef}
                            className="drawing-canvas"
                            width={canvasWidth * CELL_SIZE}
                            height={canvasHeight * CELL_SIZE}
                            style={{
                                width: "100%",
                                height: "100%",
                                touchAction: "none",
                                cursor: draggingAxis ? "move" : "crosshair",
                            }}
                            onPointerDown={onPointerDown}
                            onPointerMove={onPointerMove}
                            onPointerUp={onPointerUp}
                            onPointerCancel={onPointerCancel}
                        />
                    </div>
                </div>
            </div>

            <footer className="canvas-status">
                <span>
                    <i />
                    {messages.canvas.autoSave}
                </span>
                <span>{canvasWidth} × {canvasHeight} px</span>
                <span>{formatMessage(messages.canvas.zoom, { percent: Math.round(zoom * 100) })}</span>
            </footer>
        </section>
    );
}
