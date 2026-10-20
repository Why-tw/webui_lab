import type { CSSProperties } from "react";

import { TOOLS } from "../constants/pixelEditor";
import { formatMessage, type Messages } from "../resources/locales";
import { TOOL_GLYPHS } from "../resources/images";
import type { ShortcutMap, Tool } from "../types/pixelEditor";

type ToolRailProps = {
    activeTool: Tool;
    color: string;
    colors: string[];
    shortcuts: ShortcutMap;
    messages: Messages;
    onSelectTool: (tool: Tool) => void;
    onSelectColor: (color: string) => void;
};

export function ToolRail({ activeTool, color, colors, shortcuts, messages, onSelectTool, onSelectColor }: ToolRailProps) {
    return (
        <aside className="tool-rail" aria-label={messages.toolRail.label}>
            <div className="rail-caption">{messages.toolRail.caption}</div>
            {TOOLS.map((tool) => (
                <button
                    key={tool.id}
                    type="button"
                    className={`tool-button ${activeTool === tool.id ? "selected" : ""}`}
                    onClick={() => onSelectTool(tool.id)}
                    aria-pressed={activeTool === tool.id}
                    title={formatMessage(messages.toolRail.toolTitle, { tool: messages.tools[tool.id], shortcut: shortcuts[tool.id] })}
                >
                    <span className={`tool-glyph glyph-${tool.id}`} aria-hidden="true">
                        {TOOL_GLYPHS[tool.id]}
                    </span>
                    <span className="tool-label">{messages.tools[tool.id]}</span>
                    <kbd>{shortcuts[tool.id]}</kbd>
                </button>
            ))}
            <div className="rail-divider" />
            <div className="color-caption">{messages.toolRail.colors}</div>
            <div className="color-swatches" data-color-count={colors.length}>
                {colors.map((swatch) => (
                    <button
                        key={swatch}
                        type="button"
                        className={`swatch ${color === swatch ? "chosen" : ""}`}
                        style={{ ["--swatch" as string]: swatch } as CSSProperties}
                        onClick={() => onSelectColor(swatch)}
                        aria-label={formatMessage(messages.toolRail.selectColor, { color: swatch })}
                        aria-pressed={color === swatch}
                    />
                ))}
            </div>
            <div className="current-color">
                <span style={{ backgroundColor: color }} />
                {messages.toolRail.currentColor}
            </div>
        </aside>
    );
}
