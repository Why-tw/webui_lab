import { useState } from "react";
import type { Messages } from "../resources/locales";
import type { Layer } from "../types/pixelEditor";

export type ExportFormat = "SVG";

type ExportDialogProps = {
    layers: Layer[];
    messages: Messages;
    sending: boolean;
    onClose: () => void;
    onExport: (format: ExportFormat, target: string, fileName: string) => void;
};

export function ExportDialog({ layers, messages, sending, onClose, onExport }: ExportDialogProps) {
    const [format] = useState<ExportFormat>("SVG");
    const [target, setTarget] = useState("all");
    const [fileName, setFileName] = useState("pixel-art");

    return (
        <div
            className="modal-backdrop"
            onMouseDown={(event) => {
                if (event.target === event.currentTarget && !sending) onClose();
            }}
        >
            <form
                className="export-dialog"
                role="dialog"
                aria-modal="true"
                aria-labelledby="export-dialog-title"
                onSubmit={(event) => {
                    event.preventDefault();
                    onExport(format, target, fileName);
                }}
            >
                <div className="settings-heading">
                    <div>
                        <span className="eyebrow">{messages.exportDialog.eyebrow}</span>
                        <h2 id="export-dialog-title">{messages.exportDialog.title}</h2>
                    </div>
                    <button type="button" className="close-settings" onClick={onClose} disabled={sending} aria-label={messages.exportDialog.close}>
                        ×
                    </button>
                </div>

                <div className="export-dialog-fields">
                    <label className="export-field" htmlFor="export-file-name">
                        <span>{messages.exportDialog.fileName}</span>
                        <input
                            id="export-file-name"
                            type="text"
                            value={fileName}
                            onChange={(event) => setFileName(event.target.value)}
                            maxLength={80}
                            required
                            disabled={sending}
                        />
                    </label>

                    <label className="export-field" htmlFor="export-format">
                        <span>{messages.exportDialog.format}</span>
                        <select id="export-format" value={format} disabled>
                            <option value="SVG">SVG</option>
                        </select>
                    </label>

                    <label className="export-field" htmlFor="export-target">
                        <span>{messages.exportDialog.target}</span>
                        <select id="export-target" value={target} onChange={(event) => setTarget(event.target.value)} disabled={sending}>
                            <option value="all">{messages.exportDialog.allLayers}</option>
                            {layers.map((layer) => (
                                <option key={layer.id} value={layer.id}>{layer.name}</option>
                            ))}
                        </select>
                    </label>
                </div>

                <div className="export-dialog-footer">
                    <button type="button" className="export-cancel" onClick={onClose} disabled={sending}>
                        {messages.exportDialog.cancel}
                    </button>
                    <button type="submit" className="export-submit" disabled={sending}>
                        {sending ? messages.navigation.exportSending : messages.exportDialog.confirm}
                    </button>
                </div>
            </form>
        </div>
    );
}