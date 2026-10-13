import type { Tool } from "../types/pixelEditor";

export const GRID_WIDTH = 64;
export const GRID_HEIGHT = 48;
export const CELL_SIZE = 16;
export const MIN_ZOOM = 0.5;
export const MAX_ZOOM = 8;

export const TOOLS: { id: Tool; label: string; shortcut: string }[] = [
    { id: "pencil", label: "鉛筆", shortcut: "B" },
    { id: "eraser", label: "橡皮擦", shortcut: "E" },
    { id: "fill", label: "填充", shortcut: "F" },
    { id: "rectangle", label: "矩形", shortcut: "R" },
    { id: "line", label: "直線", shortcut: "L" },
    { id: "circle", label: "圓形", shortcut: "O" },
];

export const COLORS = [
    "#20211f",
    "#d95040",
    "#e9aa36",
    "#4d9b71",
    "#4389bd",
    "#8a69b5",
    "#f3f0e6",
];

export const TOOL_ICONS: Record<Tool, string> = {
    pencil: "╱",
    eraser: "▱",
    fill: "◩",
    rectangle: "▢",
    line: "／",
    circle: "◯",
};
