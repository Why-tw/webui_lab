import heroImage from "../assets/hero.png";
import type { Tool } from "../types/pixelEditor";

export const IMAGE_ASSETS = {
    appIcon: "/favicon.svg",
    iconSprite: "/icons.svg",
    hero: heroImage,
} as const;

export const TOOL_GLYPHS: Record<Tool, string> = {
    pencil: "╱",
    eraser: "▱",
    fill: "◩",
    rectangle: "▢",
    line: "／",
    circle: "◯",
    select: "⌖",
};