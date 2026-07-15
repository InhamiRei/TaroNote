export type ThemeMode = 'light' | 'dark';

export type LanguageMode = 'zh' | 'en';

export type FilterKey = 'all' | 'pinned' | `group:${string}`;

export type NoteGroup = {
  id: string;
  name: string;
  color: string;
  sortOrder: number;
};

export type NoteItem = {
  id: string;
  title: string;
  content: string;
  groupId: string;
  favorite: boolean;
  createdAt: string;
  updatedAt: string;
  copyCount: number;
  lastCopiedAt?: string;
  sortOrder?: number;
};

export type AppSettings = {
  hideDock: boolean;
  launchAtLogin: boolean;
  alwaysOnTop: boolean;
  globalShortcut: string;
  theme: ThemeMode;
  language: LanguageMode;
  window: {
    x?: number;
    y?: number;
    width: number;
    height: number;
  };
  closeToTray: boolean;
};

export type AppData = {
  schemaVersion: 1;
  groups: NoteGroup[];
  notes: NoteItem[];
  settings: AppSettings;
};

export type SaveDataPayload = Partial<Pick<AppData, 'groups' | 'notes' | 'settings'>>;

export type ShortcutResult = {
  ok: boolean;
  shortcut: string;
  message?: string;
};

export type DialogResult = {
  canceled: boolean;
  filePath?: string;
  message?: string;
};

// 缩放方向用四条边标记，组合后可表示四角拖拽；与具体平台无关。
export type ResizeEdges = {
  left?: boolean;
  right?: boolean;
  top?: boolean;
  bottom?: boolean;
};

// 窗口状态变化只随最大化/还原推送，渲染层据此切换窗控图标和去除留白/圆角。
export type WindowState = {
  maximized: boolean;
};

export type TaroNoteApi = {
  getState: () => Promise<AppData>;
  saveData: (payload: SaveDataPayload) => Promise<AppData>;
  copyNote: (noteId: string) => Promise<AppData>;
  applySettings: (settings: AppSettings) => Promise<{ data: AppData; shortcut: ShortcutResult }>;
  exportData: () => Promise<DialogResult>;
  importData: () => Promise<{ data?: AppData; result: DialogResult }>;
  hideWindow: () => Promise<void>;
  closeWindow: () => Promise<void>;
  minimizeWindow: () => Promise<void>;
  toggleMaximize: () => Promise<void>;
  onOpenSettings: (callback: () => void) => () => void;
  // 渲染进程无权读 process.platform，统一由主进程提供，用于按平台开关功能与样式。
  getPlatform: () => Promise<string>;
  // Windows 无边框窗口没有稳定的原生边框缩放，由渲染层拖拽边条驱动主进程改 Bounds。
  startResize: (edges: ResizeEdges, pointerX: number, pointerY: number) => Promise<void>;
  resize: (pointerX: number, pointerY: number) => Promise<void>;
  endResize: () => Promise<void>;
  isMaximized: () => Promise<boolean>;
  onWindowState: (callback: (state: WindowState) => void) => () => void;
};

// ── 共享常量与工厂 ──────────────────────────────────────

export const DEFAULT_GROUP_ID = 'notes';

export const DEFAULT_SETTINGS: AppSettings = {
  hideDock: false,
  launchAtLogin: false,
  alwaysOnTop: true,
  globalShortcut: 'CommandOrControl+;',
  theme: 'light',
  language: 'zh',
  window: {
    width: 1200,
    height: 800,
  },
  closeToTray: true,
};

export const DEFAULT_GROUPS: NoteGroup[] = [
  {
    id: DEFAULT_GROUP_ID,
    name: '默认',
    color: '#dedede',
    sortOrder: 0,
  },
];

// store.ts 和 previewApi.ts 共用同一份 payload 合并逻辑，保持结构同步。
export const mergePayload = (data: AppData, payload: SaveDataPayload): AppData => ({
  ...data,
  ...payload,
  settings: payload.settings ? { ...data.settings, ...payload.settings } : data.settings,
});

// store.ts 和 previewApi.ts 共用同一份默认数据，保持结构同步。
export const createDefaultAppData = (): AppData => ({
  schemaVersion: 1,
  groups: DEFAULT_GROUPS.map((group) => ({ ...group })),
  notes: [],
  settings: { ...DEFAULT_SETTINGS, window: { ...DEFAULT_SETTINGS.window } },
});

// 统一的标题提取：取首行非空文本截断，store 和 renderer 共用同一逻辑，避免两处不一致。
export const makeTitle = (content: string, language: LanguageMode = 'zh'): string => {
  const line =
    content
      .split('\n')
      .find((item) => item.trim())
      ?.trim() ?? '';
  return line.slice(0, 28) || (language === 'zh' ? '未命名 Note' : 'Untitled Note');
};
