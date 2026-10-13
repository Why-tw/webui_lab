import { TOOLS } from "../constants/pixelEditor";
import type { ShortcutMap, Tool } from "../types/pixelEditor";

type SettingsDialogProps = {
    gridVisible: boolean;
    shortcuts: ShortcutMap;
    listeningTool: Tool | null;
    onClose: () => void;
    onToggleGrid: (checked: boolean) => void;
    onSetListeningTool: (tool: Tool | null) => void;
    onResetShortcuts: () => void;
};

export function SettingsDialog({
    gridVisible,
    shortcuts,
    listeningTool,
    onClose,
    onToggleGrid,
    onSetListeningTool,
    onResetShortcuts,
}: SettingsDialogProps) {
    return (
        <div
            className="modal-backdrop"
            onMouseDown={(event) => {
                if (event.target === event.currentTarget) onClose();
            }}
        >
            <section className="settings-dialog" role="dialog" aria-modal="true" aria-labelledby="settings-title">
                <div className="settings-heading">
                    <div>
                        <span className="eyebrow">PREFERENCES</span>
                        <h2 id="settings-title">設定</h2>
                    </div>
                    <button type="button" className="close-settings" onClick={onClose} aria-label="關閉設定">
                        ×
                    </button>
                </div>

                <div className="settings-section">
                    <h3>工作區</h3>
                    <label className="setting-row">
                        <span>
                            <strong>像素格線</strong>
                            <small>在畫布上顯示像素邊界</small>
                        </span>
                        <input type="checkbox" checked={gridVisible} onChange={(event) => onToggleGrid(event.target.checked)} />
                    </label>
                </div>

                <div className="settings-section">
                    <h3>快捷鍵</h3>
                    <p className="settings-note">選擇快捷鍵後，按下要指派的按鍵。</p>
                    {TOOLS.map((tool) => (
                        <div className="shortcut-row" key={tool.id}>
                            <span>{tool.label}</span>
                            <button
                                type="button"
                                className={listeningTool === tool.id ? "listening" : ""}
                                onClick={() => onSetListeningTool(tool.id)}
                            >
                                {listeningTool === tool.id ? "請按下按鍵…" : shortcuts[tool.id]}
                            </button>
                        </div>
                    ))}
                </div>

                <div className="settings-footer">
                    <span>EmbedPixel Studio</span>
                    <button type="button" onClick={onResetShortcuts}>
                        還原預設
                    </button>
                </div>
            </section>
        </div>
    );
}
