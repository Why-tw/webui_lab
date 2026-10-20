import { TOOLS } from "../constants/pixelEditor";
import { LANGUAGE_OPTIONS, type Language, type Messages } from "../resources/locales";
import type { ShortcutMap, Tool } from "../types/pixelEditor";

type SettingsDialogProps = {
    gridVisible: boolean;
    language: Language;
    messages: Messages;
    shortcuts: ShortcutMap;
    listeningTool: Tool | null;
    onClose: () => void;
    onToggleGrid: (checked: boolean) => void;
    onChangeLanguage: (language: Language) => void;
    onSetListeningTool: (tool: Tool | null) => void;
    onResetShortcuts: () => void;
};

export function SettingsDialog({
    gridVisible,
    language,
    messages,
    shortcuts,
    listeningTool,
    onClose,
    onToggleGrid,
    onChangeLanguage,
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
                        <span className="eyebrow">{messages.settings.eyebrow}</span>
                        <h2 id="settings-title">{messages.settings.title}</h2>
                    </div>
                    <button type="button" className="close-settings" onClick={onClose} aria-label={messages.settings.close}>
                        ×
                    </button>
                </div>

                <div className="settings-section">
                    <label className="setting-row" htmlFor="language-select">
                        <strong>{messages.settings.language}</strong>
                        <select id="language-select" value={language} onChange={(event) => onChangeLanguage(event.target.value as Language)}>
                            {LANGUAGE_OPTIONS.map((option) => (
                                <option key={option.id} value={option.id}>{option.label}</option>
                            ))}
                        </select>
                    </label>
                </div>

                <div className="settings-section">
                    <h3>{messages.settings.workspace}</h3>
                    <label className="setting-row">
                        <span>
                            <strong>{messages.settings.pixelGrid}</strong>
                            <small>{messages.settings.pixelGridHint}</small>
                        </span>
                        <input type="checkbox" checked={gridVisible} onChange={(event) => onToggleGrid(event.target.checked)} />
                    </label>
                </div>

                <div className="settings-section">
                    <h3>{messages.settings.shortcuts}</h3>
                    <p className="settings-note">{messages.settings.shortcutHint}</p>
                    {TOOLS.map((tool) => (
                        <div className="shortcut-row" key={tool.id}>
                            <span>{messages.tools[tool.id]}</span>
                            <button
                                type="button"
                                className={listeningTool === tool.id ? "listening" : ""}
                                onClick={() => onSetListeningTool(tool.id)}
                            >
                                {listeningTool === tool.id ? messages.settings.pressKey : shortcuts[tool.id]}
                            </button>
                        </div>
                    ))}
                </div>

                <div className="settings-footer">
                    <span>EmbedPixel Studio</span>
                    <button type="button" onClick={onResetShortcuts}>
                        {messages.settings.resetShortcuts}
                    </button>
                </div>
            </section>
        </div>
    );
}
