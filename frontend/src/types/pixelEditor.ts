export type Pixel = string | null;

export type Point = {
    x: number;
    y: number;
};

export type Tool = "pencil" | "eraser" | "fill" | "rectangle" | "line" | "circle" | "select";

export type Selection = {
    x: number;
    y: number;
    width: number;
    height: number;
};

export type Layer = {
    id: string;
    name: string;
    visible: boolean;
    pixels: Pixel[][];
};

export type Symmetry = "vertical" | "horizontal";

export type Gesture = {
    start: Point;
    last: Point;
    mode: "paint" | "shape" | "select" | "move";
    axis?: Symmetry;
    selection?: Selection;
    pixels?: Pixel[][];
};

export type Preview = {
    start: Point;
    end: Point;
};

export type ShortcutMap = Record<Tool, string>;
