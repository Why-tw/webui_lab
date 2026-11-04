import type { DisplayProfile } from "../constants/pixelEditor";
import type { Layer, Selection } from "./pixelEditor";

export type ProjectHistorySnapshot = {
    layers: Layer[];
    activeLayerId: string;
    selection: Selection | null;
    canvasSize: { width: number; height: number };
    displayProfile: DisplayProfile;
};

export type ProjectHistory = {
    past: ProjectHistorySnapshot[];
    future: ProjectHistorySnapshot[];
};

export type Project = {
    id: string;
    name: string;
    canvasSize: { width: number; height: number };
    displayProfile: DisplayProfile;
    layers: Layer[];
    activeLayerId: string;
    customColors: string[];
    color: string;
    history?: ProjectHistory;
};
