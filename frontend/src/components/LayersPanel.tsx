import type { Layer } from "../types/pixelEditor";
import type { Messages } from "../resources/locales";

type LayersPanelProps = {
    layers: Layer[];
    messages: Messages;
    canvasWidth: number;
    canvasHeight: number;
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
    messages,
    canvasWidth,
    canvasHeight,
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
        <aside className="layers-panel" aria-label={messages.layers.label}>
            <div className="panel-heading">
                <div>
                    <span className="eyebrow">STACK</span>
                    <h2>{messages.layers.heading}</h2>
                </div>
                <span className="layer-count">{layers.length.toString().padStart(2, "0")}</span>
            </div>

            <div className="layer-actions">
                <button type="button" onClick={onAddLayer} title={messages.layers.addTitle}>
                    ＋ <span>{messages.layers.add}</span>
                </button>
                <button type="button" onClick={onDeleteActiveLayer} disabled={layers.length <= 1} title={messages.layers.deleteTitle}>
                    － <span>{messages.layers.delete}</span>
                </button>
                <span className="action-spacer" />
                <button
                    type="button"
                    onClick={() => onMoveActiveLayer(1)}
                    disabled={activeIndex === layers.length - 1}
                    aria-label={messages.layers.moveUp}
                    title={messages.layers.moveUp}
                >
                    ↑
                </button>
                <button
                    type="button"
                    onClick={() => onMoveActiveLayer(-1)}
                    disabled={activeIndex === 0}
                    aria-label={messages.layers.moveDown}
                    title={messages.layers.moveDown}
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
                            aria-label={`${layer.visible ? messages.layers.hide : messages.layers.show} ${layer.name}`}
                            title={layer.visible ? messages.layers.hide : messages.layers.show}
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
                <p>{messages.layers.hint}</p>
            </div>

            <div className="symmetry-card">
                <div className="symmetry-card-heading">
                    <span>{messages.layers.symmetryAxis}</span>
                    <label className="switch">
                        <input type="checkbox" checked={symmetryEnabled} onChange={onToggleSymmetry} />
                        <span />
                    </label>
                </div>
                <div className="symmetry-options" role="group" aria-label={messages.layers.symmetryDirection}>
                    <button
                        type="button"
                        className={symmetry === "vertical" ? "selected" : ""}
                        onClick={() => {
                            onSetSymmetry("vertical");
                            onSetSymmetryPosition(canvasWidth / 2);
                        }}
                    >
                        <span>↕</span>{messages.layers.vertical}
                    </button>
                    <button
                        type="button"
                        className={symmetry === "horizontal" ? "selected" : ""}
                        onClick={() => {
                            onSetSymmetry("horizontal");
                            onSetSymmetryPosition(canvasHeight / 2);
                        }}
                    >
                        <span>↔</span>{messages.layers.horizontal}
                    </button>
                </div>
                <p>{messages.layers.moveAxisHint}</p>
            </div>
        </aside>
    );
}
