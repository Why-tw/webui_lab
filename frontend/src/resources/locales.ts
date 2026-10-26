import type { Tool } from "../types/pixelEditor";

const zhHant = {
    languageName: "繁體中文",
    appName: "EmbedPixel Studio",
    document: {
        untitled: "未命名像素作品",
        dimensions: "{width} × {height} px",
    },
    navigation: {
        label: "工作區導航",
        canvas: "畫布",
        export: "匯出",
        exportSending: "傳送中…",
        exportSuccess: "已傳送",
        exportError: "傳送失敗",
        reserved: "預留功能",
    },
    settingsTrigger: {
        label: "開啟設定",
        text: "設定",
    },
    tools: {
        pencil: "鉛筆",
        eraser: "橡皮擦",
        fill: "填充",
        rectangle: "矩形",
        line: "直線",
        circle: "圓形",
        select: "選取",
    } satisfies Record<Tool, string>,
    toolRail: {
        label: "繪圖工具",
        caption: "TOOLS",
        colors: "顏色",
        selectColor: "選擇顏色 {color}",
        currentColor: "目前顏色",
        toolTitle: "{tool} ({shortcut})",
        brushSize: "筆刷粗細",
    },
    canvas: {
        label: "像素畫布工作區",
        symmetryTitle: "切換對稱繪製",
        symmetry: "對稱",
        symmetryDirection: "對稱軸方向",
        verticalAxis: "垂直軸",
        horizontalAxis: "水平軸",
        gridTitle: "顯示或隱藏格線",
        undo: "上一步",
        redo: "下一步",
        displayProfile: "顯示設定",
        customSize: "自訂尺寸",
        ssd1306: "SSD1306 (1bpp)",
        ssd1327: "SSD1327 (4bpp)",
        width: "寬",
        height: "高",
        zoomOut: "縮小",
        zoomIn: "放大",
        fit: "預設",
        autoSave: "自動儲存於此工作階段",
        zoom: "縮放 {percent}%",
    },
    layers: {
        label: "圖層面板",
        heading: "圖層",
        defaultName: "圖層 {number}",
        addTitle: "新增圖層",
        add: "新增",
        deleteTitle: "刪除目前圖層",
        delete: "刪除",
        moveUp: "上移圖層",
        moveDown: "下移圖層",
        hide: "隱藏",
        show: "顯示",
        hint: "筆觸只會修改目前選取的圖層。",
        symmetryAxis: "對稱軸",
        vertical: "垂直",
        horizontal: "水平",
        symmetryDirection: "對稱軸方向",
        moveAxisHint: "拖曳畫布上的紅色虛線來移動",
    },
    settings: {
        eyebrow: "PREFERENCES",
        title: "設定",
        close: "關閉設定",
        language: "語言",
        workspace: "工作區",
        pixelGrid: "像素格線",
        pixelGridHint: "在畫布上顯示像素邊界",
        shortcuts: "快捷鍵",
        shortcutHint: "選擇快捷鍵後，按下要指派的按鍵。",
        pressKey: "請按下按鍵…",
        resetShortcuts: "還原預設",
    },
} as const;

type WidenStrings<T> = T extends string
    ? string
    : T extends Record<string, unknown>
    ? { [Key in keyof T]: WidenStrings<T[Key]> }
    : T;

type LocaleMessages = WidenStrings<typeof zhHant>;

const en: LocaleMessages = {
    languageName: "English",
    appName: "EmbedPixel Studio",
    document: {
        untitled: "Untitled Pixel Art",
        dimensions: "{width} × {height} px",
    },
    navigation: {
        label: "Workspace navigation",
        canvas: "Canvas",
        export: "Export",
        exportSending: "Sending…",
        exportSuccess: "Sent",
        exportError: "Send failed",
        reserved: "Coming soon",
    },
    settingsTrigger: {
        label: "Open settings",
        text: "Settings",
    },
    tools: {
        pencil: "Pencil",
        eraser: "Eraser",
        fill: "Fill",
        rectangle: "Rectangle",
        line: "Line",
        circle: "Circle",
        select: "Select",
    },
    toolRail: {
        label: "Drawing tools",
        caption: "TOOLS",
        colors: "Colors",
        selectColor: "Select color {color}",
        currentColor: "Current color",
        toolTitle: "{tool} ({shortcut})",
        brushSize: "Brush size",
    },
    canvas: {
        label: "Pixel canvas workspace",
        symmetryTitle: "Toggle symmetry drawing",
        symmetry: "Symmetry",
        symmetryDirection: "Symmetry axis direction",
        verticalAxis: "Vertical axis",
        horizontalAxis: "Horizontal axis",
        gridTitle: "Show or hide grid",
        undo: "Undo",
        redo: "Redo",
        displayProfile: "Display Profile",
        customSize: "Custom size",
        ssd1306: "SSD1306 (1bpp)",
        ssd1327: "SSD1327 (4bpp)",
        width: "W",
        height: "H",
        zoomOut: "Zoom out",
        zoomIn: "Zoom in",
        fit: "Fit",
        autoSave: "Autosaved in this session",
        zoom: "Zoom {percent}%",
    },
    layers: {
        label: "Layers panel",
        heading: "Layers",
        defaultName: "Layer {number}",
        addTitle: "Add layer",
        add: "Add",
        deleteTitle: "Delete current layer",
        delete: "Delete",
        moveUp: "Move layer up",
        moveDown: "Move layer down",
        hide: "Hide",
        show: "Show",
        hint: "Brush strokes only affect the selected layer.",
        symmetryAxis: "Symmetry axis",
        vertical: "Vertical",
        horizontal: "Horizontal",
        symmetryDirection: "Symmetry axis direction",
        moveAxisHint: "Drag the red dashed line on the canvas to move it",
    },
    settings: {
        eyebrow: "PREFERENCES",
        title: "Settings",
        close: "Close settings",
        language: "Language",
        workspace: "Workspace",
        pixelGrid: "Pixel grid",
        pixelGridHint: "Show pixel boundaries on the canvas",
        shortcuts: "Shortcuts",
        shortcutHint: "Select a shortcut, then press the key to assign.",
        pressKey: "Press a key…",
        resetShortcuts: "Reset defaults",
    },
};

export const locales = {
    "zh-Hant": zhHant,
    en,
} satisfies Record<string, LocaleMessages>;

export type Language = keyof typeof locales;
export type Messages = LocaleMessages;

export const LANGUAGE_OPTIONS: { id: Language; label: string }[] = [
    { id: "zh-Hant", label: zhHant.languageName },
    { id: "en", label: en.languageName },
];

export function formatMessage(template: string, values: Record<string, string | number>): string {
    return template.replace(/\{(\w+)\}/g, (_, key: string) => String(values[key] ?? `{${key}}`));
}

export function isLanguage(value: string | null): value is Language {
    return value !== null && Object.prototype.hasOwnProperty.call(locales, value);
}