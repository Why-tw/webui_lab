import type { DisplayProfile } from "../constants/pixelEditor";
import type { Layer } from "./pixelEditor";

export type Project = {
    id: string;
    name: string;
    canvasSize: { width: number; height: number };
    displayProfile: DisplayProfile;
    layers: Layer[];
    activeLayerId: string;
    customColors: string[];
    color: string;
};
