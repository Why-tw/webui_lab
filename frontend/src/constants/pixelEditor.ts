import type { Tool } from "../types/pixelEditor";

export const GRID_WIDTH = 64;
export const GRID_HEIGHT = 48;
export const CELL_SIZE = 16;
export const MIN_ZOOM = 0.5;
export const MAX_ZOOM = 8;
export const MAX_CUSTOM_DIMENSION = 512;

export type DisplayProfile = "custom" | "ssd1306" | "ssd1327";

export const DISPLAY_PROFILE_PRESETS = {
    ssd1306: { width: 128, height: 64, bitDepth: 1 },
    ssd1327: { width: 128, height: 128, bitDepth: 4 },
} as const;

export const TOOLS: { id: Tool; shortcut: string }[] = [
    { id: "pencil", shortcut: "B" },
    { id: "eraser", shortcut: "E" },
    { id: "fill", shortcut: "F" },
    { id: "rectangle", shortcut: "R" },
    { id: "line", shortcut: "L" },
    { id: "circle", shortcut: "O" },
    { id: "select", shortcut: "S" },
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

export const SSD1306_COLORS = ["#000000", "#ffffff"];
export const SSD1327_COLORS = Array.from({ length: 16 }, (_, index) => {
    const value = Math.round((index * 255) / 15).toString(16).padStart(2, "0");
    return `#${value}${value}${value}`;
});

export function colorsForProfile(profile: DisplayProfile): string[] {
    if (profile === "ssd1306") return SSD1306_COLORS;
    if (profile === "ssd1327") return SSD1327_COLORS;
    return COLORS;
}

