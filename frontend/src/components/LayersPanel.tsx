import type { Layer } from "../types/pixelEditor";

type LayersPanelProps = {
    layers: Layer[];
    activeLayerId: string;
    onAddLayer: () => void;
    onDeleteActiveLayer: () => void;
    onMoveActiveLayer: (direction: -1 | 1) => void;
    onSetActiveLayer: (id: string) => void;
    onToggleLayerVisibility: (id: string) => void;
    symmetryEnabled: boolean;
    symmetry: "vertical" | "horizontal";
    onSetSymmetry: (value: "vertical" | "horizontal") => void;
    onSetSymmetryPosition: (value: number) => void;
    onToggleSymmetry: () => void;
};

export function LayersPanel({
    layers,
    activeLayerId,
    onAddLayer,
    onDeleteActiveLayer,
    onMoveActiveLayer,
    onSetActiveLayer,
    onToggleLayerVisibility,
    symmetryEnabled,
    symmetry,
    onSetSymmetry,
    onSetSymmetryPosition,
    onToggleSymmetry,
}: LayersPanelProps) {
    const activeIndex = layers.findIndex((layer) => layer.id === activeLayerId);

    return (
        <aside className="layers-panel" aria-label="圖層面板">
            <div className="panel-heading">
                <div>
                    <span className="eyebrow">STACK</span>
                    <h2>圖層</h2>
                </div>
                <span className="layer-count">{layers.length.toString().padStart(2, "0")}</span>
            </div>

            <div className="layer-actions">
                <button type="button" onClick={onAddLayer} title="新增圖層">
                    ＋ <span>新增</span>
                </button>
                <button type="button" onClick={onDeleteActiveLayer} disabled={layers.length <= 1} title="刪除目前圖層">
                    － <span>刪除</span>
                </button>
                <span className="action-spacer" />
                <button
                    type="button"
                    onClick={() => onMoveActiveLayer(1)}
                    disabled={activeIndex === layers.length - 1}
                    aria-label="上移圖層"
                    title="上移圖層"
                >
                    ↑
                </button>
                <button
                    type="button"
                    onClick={() => onMoveActiveLayer(-1)}
                    disabled={activeIndex === 0}
                    aria-label="下移圖層"
                    title="下移圖層"
                >
                    ↓
                </button>
            </div>

            <div className="layer-list">
                {[...layers].reverse().map((layer) => (
                    <div key={layer.id} className={`layer-row ${layer.id === activeLayerId ? "active" : ""}`}>
                        <button
                            type="button"
                            className={`visibility-button ${layer.visible ? "visible" : ""}`}
                            onClick={() => onToggleLayerVisibility(layer.id)}
                            aria-label={`${layer.visible ? "隱藏" : "顯示"}${layer.name}`}
                            title={layer.visible ? "隱藏圖層" : "顯示圖層"}
                        >
                            {layer.visible ? "◉" : "○"}
                        </button>
                        <button
                            type="button"
                            className="layer-select"
                            onClick={() => onSetActiveLayer(layer.id)}
                            aria-pressed={layer.id === activeLayerId}
                        >
                            <span className="layer-thumb">
                                <span style={{ background: layer.pixels.flat().find(Boolean) ?? "transparent" }} />
                            </span>
                            <span className="layer-name">{layer.name}</span>
                        </button>
                        <span className="layer-active-mark">{layer.id === activeLayerId ? "●" : ""}</span>
                    </div>
                ))}
            </div>

            <div className="layer-hint">
                <span className="hint-mark">i</span>
                <p>筆觸只會修改目前選取的圖層。</p>
            </div>

            <div className="symmetry-card">
                <div className="symmetry-card-heading">
                    <span>對稱軸</span>
                    <label className="switch">
                        <input type="checkbox" checked={symmetryEnabled} onChange={onToggleSymmetry} />
                        <span />
                    </label>
                </div>
                <div className="symmetry-options" role="group" aria-label="對稱軸方向">
                    <button
                        type="button"
                        className={symmetry === "vertical" ? "selected" : ""}
                        onClick={() => {
                            onSetSymmetry("vertical");
                            onSetSymmetryPosition(32);
                        }}
                    >
                        <span>↕</span>垂直
                    </button>
                    <button
                        type="button"
                        className={symmetry === "horizontal" ? "selected" : ""}
                        onClick={() => {
                            onSetSymmetry("horizontal");
                            onSetSymmetryPosition(24);
                        }}
                    >
                        <span>↔</span>水平
                    </button>
                </div>
                <p>拖曳畫布上的紅色虛線來移動</p>
            </div>
        </aside>
    );
}
