import type { CSSProperties } from "react";

import { COLORS, TOOL_ICONS, TOOLS } from "../constants/pixelEditor";
import type { ShortcutMap, Tool } from "../types/pixelEditor";

type ToolRailProps = {
    activeTool: Tool;
    color: string;
    shortcuts: ShortcutMap;
    onSelectTool: (tool: Tool) => void;
    onSelectColor: (color: string) => void;
};

export function ToolRail({ activeTool, color, shortcuts, onSelectTool, onSelectColor }: ToolRailProps) {
    return (
        <aside className="tool-rail" aria-label="繪圖工具">
            <div className="rail-caption">TOOLS</div>
            {TOOLS.map((tool) => (
                <button
                    key={tool.id}
                    type="button"
                    className={`tool-button ${activeTool === tool.id ? "selected" : ""}`}
                    onClick={() => onSelectTool(tool.id)}
                    aria-pressed={activeTool === tool.id}
                    title={`${tool.label} (${shortcuts[tool.id]})`}
                >
                    <span className={`tool-glyph glyph-${tool.id}`} aria-hidden="true">
                        {TOOL_ICONS[tool.id]}
                    </span>
                    <span className="tool-label">{tool.label}</span>
                    <kbd>{shortcuts[tool.id]}</kbd>
                </button>
            ))}
            <div className="rail-divider" />
            <div className="color-caption">顏色</div>
            <div className="color-swatches">
                {COLORS.map((swatch) => (
                    <button
                        key={swatch}
                        type="button"
                        className={`swatch ${color === swatch ? "chosen" : ""}`}
                        style={{ ["--swatch" as string]: swatch } as CSSProperties}
                        onClick={() => onSelectColor(swatch)}
                        aria-label={`選擇顏色 ${swatch}`}
                        aria-pressed={color === swatch}
                    />
                ))}
            </div>
            <div className="current-color">
                <span style={{ backgroundColor: color }} />
                目前顏色
            </div>
        </aside>
    );
}
