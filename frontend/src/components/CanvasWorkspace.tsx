import type { PointerEvent as ReactPointerEvent, RefObject } from "react";

import { CELL_SIZE, GRID_HEIGHT, GRID_WIDTH } from "../constants/pixelEditor";
import type { Symmetry } from "../types/pixelEditor";

type CanvasWorkspaceProps = {
    canvasRef: RefObject<HTMLCanvasElement | null>;
    viewportRef: RefObject<HTMLDivElement | null>;
    activeTool: string;
    activeLayerName?: string;
    gridVisible: boolean;
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
    activeLayerName,
    gridVisible,
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
    return (
        <section className="canvas-workspace" id="canvas" aria-label="像素畫布工作區">
            <div className="canvas-toolbar">
                <div className="tool-context">
                    <span className="context-dot" />
                    {activeTool}
                    <span className="context-separator">/</span>
                    {activeLayerName}
                </div>
                <div className="canvas-actions">
                    <button
                        type="button"
                        className={`symmetry-toggle ${symmetryEnabled ? "on" : ""}`}
                        onClick={onToggleSymmetry}
                        aria-pressed={symmetryEnabled}
                        title="切換對稱繪製"
                    >
                        ⌁ <span>對稱</span>
                    </button>
                    <select
                        aria-label="對稱軸方向"
                        value={symmetry}
                        onChange={(event) =>
                            onSymmetryChange(event.target.value as Symmetry)
                        }
                    >
                        <option value="vertical">垂直軸</option>
                        <option value="horizontal">水平軸</option>
                    </select>
                    <span className="action-divider" />
                    <button
                        type="button"
                        className={`grid-toggle ${gridVisible ? "on" : ""}`}
                        onClick={onToggleGrid}
                        aria-pressed={gridVisible}
                        title="顯示或隱藏格線"
                    >
                        ▦
                    </button>
                    <button type="button" onClick={onZoomOut} aria-label="縮小">
                        −
                    </button>
                    <span className="zoom-value">{Math.round(zoom * 100)}%</span>
                    <button type="button" onClick={onZoomIn} aria-label="放大">
                        +
                    </button>
                    <button type="button" onClick={onResetZoom}>
                        適合
                    </button>
                </div>
            </div>

            <div className="canvas-stage" ref={viewportRef}>
                <div className="canvas-mat">
                    <div
                        className="canvas-paper"
                        style={{
                            width: GRID_WIDTH * CELL_SIZE * zoom,
                            height: GRID_HEIGHT * CELL_SIZE * zoom,
                        }}
                    >
                        <canvas
                            ref={canvasRef}
                            className="drawing-canvas"
                            width={GRID_WIDTH * CELL_SIZE}
                            height={GRID_HEIGHT * CELL_SIZE}
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
                    自動儲存於此工作階段
                </span>
                <span>{GRID_WIDTH} × {GRID_HEIGHT} px</span>
                <span>縮放 {Math.round(zoom * 100)}%</span>
            </footer>
        </section>
    );
}
