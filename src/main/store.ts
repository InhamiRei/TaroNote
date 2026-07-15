import { randomUUID } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import type { AppData, AppSettings, NoteGroup, NoteItem, SaveDataPayload } from '../shared/types';
import { DEFAULT_GROUP_ID, DEFAULT_GROUPS, DEFAULT_SETTINGS, createDefaultAppData, makeTitle, mergePayload } from '../shared/types';

type UnknownRecord = Record<string, unknown>;

// 判断导入数据是否是普通对象，避免数组或 null 进入规范化逻辑。
const isRecord = (value: unknown): value is UnknownRecord => {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
};

// 字符串字段统一用这个类型保护，方便后续 trim 和默认值处理。
const isString = (value: unknown): value is string => typeof value === 'string';

const nowIso = () => new Date().toISOString();

// 统一修正设置结构，兼容后续版本升级或用户导入的旧备份。
const normalizeSettings = (value: unknown): AppSettings => {
  if (!isRecord(value)) {
    return { ...DEFAULT_SETTINGS, window: { ...DEFAULT_SETTINGS.window } };
  }

  const windowValue = isRecord(value.window) ? value.window : {};
  // 主题只保留浅色和深色；旧备份里的其他值会自动回落为浅色。
  const theme = value.theme === 'light' || value.theme === 'dark' ? value.theme : DEFAULT_SETTINGS.theme;
  const language = value.language === 'en' || value.language === 'zh' ? value.language : DEFAULT_SETTINGS.language;
  const width = typeof windowValue.width === 'number' && windowValue.width >= 1000 ? windowValue.width : DEFAULT_SETTINGS.window.width;
  const height = typeof windowValue.height === 'number' && windowValue.height >= 620 ? windowValue.height : DEFAULT_SETTINGS.window.height;

  return {
    hideDock: typeof value.hideDock === 'boolean' ? value.hideDock : DEFAULT_SETTINGS.hideDock,
    launchAtLogin: typeof value.launchAtLogin === 'boolean' ? value.launchAtLogin : DEFAULT_SETTINGS.launchAtLogin,
    alwaysOnTop: typeof value.alwaysOnTop === 'boolean' ? value.alwaysOnTop : DEFAULT_SETTINGS.alwaysOnTop,
    globalShortcut: isString(value.globalShortcut) && value.globalShortcut.trim() ? value.globalShortcut : DEFAULT_SETTINGS.globalShortcut,
    theme,
    language,
    window: {
      x: typeof windowValue.x === 'number' ? windowValue.x : undefined,
      y: typeof windowValue.y === 'number' ? windowValue.y : undefined,
      width,
      height,
    },
    closeToTray: typeof value.closeToTray === 'boolean' ? value.closeToTray : DEFAULT_SETTINGS.closeToTray,
  };
};

// 清洗分组数据，至少保留一个默认分组，避免 Note 失去归属。
const normalizeGroups = (value: unknown): NoteGroup[] => {
  const groups = Array.isArray(value)
    ? value.filter(isRecord).map((group, index) => ({
        id: isString(group.id) && group.id.trim() ? group.id : randomUUID(),
        name:
          group.id === DEFAULT_GROUP_ID && group.name === 'Notes'
            ? '默认'
            : isString(group.name) && group.name.trim()
              ? group.name.trim()
              : `列表 ${index + 1}`,
        color: isString(group.color) && group.color.trim() ? group.color : '#dedede',
        sortOrder: typeof group.sortOrder === 'number' ? group.sortOrder : index,
      }))
    : [];

  if (!groups.length) {
    return DEFAULT_GROUPS.map((group) => ({ ...group }));
  }

  return groups.sort((a, b) => a.sortOrder - b.sortOrder);
};

// 清洗 Note 数据，并把无效分组引用落回第一个可用分组。
const normalizeNotes = (value: unknown, groups: NoteGroup[]): NoteItem[] => {
  if (!Array.isArray(value)) {
    return [];
  }

  const groupIds = new Set(groups.map((group) => group.id));
  const fallbackGroupId = groups[0]?.id ?? DEFAULT_GROUP_ID;

  return value.filter(isRecord).map((note) => {
    const createdAt = isString(note.createdAt) ? note.createdAt : nowIso();

    return {
      id: isString(note.id) && note.id.trim() ? note.id : randomUUID(),
      title: isString(note.title) && note.title.trim() ? note.title.trim() : makeTitle(isString(note.content) ? note.content : ''),
      content: isString(note.content) ? note.content : '',
      groupId: isString(note.groupId) && groupIds.has(note.groupId) ? note.groupId : fallbackGroupId,
      favorite: typeof note.favorite === 'boolean' ? note.favorite : false,
      createdAt,
      updatedAt: isString(note.updatedAt) ? note.updatedAt : createdAt,
      copyCount: typeof note.copyCount === 'number' && note.copyCount >= 0 ? note.copyCount : 0,
      lastCopiedAt: isString(note.lastCopiedAt) ? note.lastCopiedAt : undefined,
      sortOrder: typeof note.sortOrder === 'number' ? note.sortOrder : undefined,
    };
  });
};

// 将任意输入规范化成当前版本的数据文件，所有入口都走这里。
const normalizeData = (value: unknown): AppData => {
  if (!isRecord(value)) {
    return createDefaultAppData();
  }

  const groups = normalizeGroups(value.groups);
  const notes = normalizeNotes(value.notes, groups);

  return {
    schemaVersion: 1,
    groups,
    notes,
    settings: normalizeSettings(value.settings),
  };
};

export class TaroNoteStore {
  private data: AppData;

  constructor(private readonly dataPath: string) {
    this.data = this.load();
  }

  // 暴露当前数据文件路径，方便未来调试或设置页展示。
  get filePath(): string {
    return this.dataPath;
  }

  // 启动时读取本地数据；损坏的 JSON 会被备份并自动重建。
  private load(): AppData {
    mkdirSync(path.dirname(this.dataPath), { recursive: true });

    if (!existsSync(this.dataPath)) {
      const data = createDefaultAppData();
      this.write(data);
      return data;
    }

    try {
      const raw = JSON.parse(readFileSync(this.dataPath, 'utf8')) as unknown;
      const data = normalizeData(raw);
      this.write(data);
      return data;
    } catch {
      const backupPath = `${this.dataPath}.corrupt-${Date.now()}`;
      renameSync(this.dataPath, backupPath);
      const data = createDefaultAppData();
      this.write(data);
      return data;
    }
  }

  // 原子写入可以减少应用崩溃或断电时写坏数据文件的概率。
  private write(data: AppData): void {
    mkdirSync(path.dirname(this.dataPath), { recursive: true });
    const tempPath = `${this.dataPath}.tmp`;
    writeFileSync(tempPath, `${JSON.stringify(data, null, 2)}\n`, 'utf8');
    renameSync(tempPath, this.dataPath);
  }

  // 返回深拷贝，避免主进程内部缓存被渲染进程的返回值间接污染。
  get(): AppData {
    return structuredClone(this.data);
  }

  // 渲染进程保存列表、分组或设置时统一走这里，先合并再规范化。
  update(payload: SaveDataPayload): AppData {
    this.data = normalizeData(mergePayload(this.data, payload));
    this.write(this.data);
    return this.get();
  }

  // 点击 Note 时只写入剪贴板，不做自动粘贴，顺手记录使用次数。
  markCopied(noteId: string): AppData | undefined {
    const copiedAt = nowIso();
    let didCopy = false;

    const notes = this.data.notes.map((note) => {
      if (note.id !== noteId) {
        return note;
      }

      didCopy = true;
      return {
        ...note,
        copyCount: note.copyCount + 1,
        lastCopiedAt: copiedAt,
      };
    });

    if (!didCopy) {
      return undefined;
    }

    this.data = { ...this.data, notes };
    this.write(this.data);
    return this.get();
  }

  // 导出当前缓存数据，不重新读磁盘，保证导出内容和界面状态一致。
  exportTo(filePath: string): void {
    writeFileSync(filePath, `${JSON.stringify(this.data, null, 2)}\n`, 'utf8');
  }

  // 导入文件先规范化再落盘，防止旧版本或手改 JSON 破坏运行时结构。
  importFrom(filePath: string): AppData {
    const raw = JSON.parse(readFileSync(filePath, 'utf8')) as unknown;
    this.data = normalizeData(raw);
    this.write(this.data);
    return this.get();
  }
}

// 数据文件固定放在 Electron userData 下，避免和应用安装目录权限耦合。
export const getDataPath = (userDataPath: string): string => {
  return path.join(userDataPath, 'data.json');
};
