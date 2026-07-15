import type { FilterKey, LanguageMode, NoteItem } from '../shared/types';

export type DropPosition = 'above' | 'below';

// 为新建 Note 和分类生成本地唯一 ID，保持渲染进程无需依赖主进程。
export const createId = () => crypto.randomUUID();

// 新分类按固定色板循环取色，避免每次启动生成不同的侧栏颜色。
export const categoryColorPalette = ['#dedede', '#b8c7d9', '#c9d3b8', '#d9c2b8', '#c7bfd9', '#d8ca9d'];

// 从侧栏筛选值中解析分类 ID，非分类筛选统一返回空字符串。
export const getFilterGroupId = (filter: FilterKey) => (filter.startsWith('group:') ? filter.slice('group:'.length) : '');

// 统一构造分类筛选键，避免业务代码散落 `group:` 字符串拼接。
export const buildGroupFilter = (groupId: string): FilterKey => `group:${groupId}`;

// 以纯函数方式移动数组元素，不修改调用方传入的排序结果。
export const moveArrayItem = <Item>(items: readonly Item[], fromIndex: number, toIndex: number): Item[] => {
  if (fromIndex < 0 || toIndex < 0 || fromIndex >= items.length || toIndex >= items.length || fromIndex === toIndex) {
    return [...items];
  }

  const movedItem = items[fromIndex];
  const remainingItems = [...items.slice(0, fromIndex), ...items.slice(fromIndex + 1)];
  return [...remainingItems.slice(0, toIndex), movedItem, ...remainingItems.slice(toIndex)];
};

// 把“落在目标上方/下方”转换为源元素移除后的最终索引。
export const getDropTargetIndex = (fromIndex: number, toIndex: number, position: DropPosition) => {
  if (position === 'above') {
    return fromIndex < toIndex ? toIndex - 1 : toIndex;
  }

  return fromIndex < toIndex ? toIndex : toIndex + 1;
};

// 从未知异常中提取可读原因，供 IPC 失败提示复用。
export const getErrorMessage = (error: unknown) => {
  if (error instanceof Error && error.message.trim()) {
    return error.message;
  }

  return typeof error === 'string' && error.trim() ? error : 'Unknown error';
};

// 判断当前焦点是否在可输入区域，避免快捷键打断用户编辑 Note。
export const isEditableTarget = (target: EventTarget | null) => {
  if (!(target instanceof HTMLElement)) {
    return false;
  }

  const tagName = target.tagName.toLowerCase();
  return target.isContentEditable || tagName === 'input' || tagName === 'textarea' || tagName === 'select';
};

// 补齐日期时间里的个位数，保证卡片时间稳定显示为 2026-06-09 14:50。
const padDatePart = (value: number) => `${value}`.padStart(2, '0');

// 按中文界面的展示要求输出完整日期时间，避免相对时间隐藏日期信息。
const formatZhDateTime = (date: Date) => {
  const year = date.getFullYear();
  const month = padDatePart(date.getMonth() + 1);
  const day = padDatePart(date.getDate());
  const hour = padDatePart(date.getHours());
  const minute = padDatePart(date.getMinutes());

  return `${year}-${month}-${day} ${hour}:${minute}`;
};

// 将更新时间按当前语言格式化；中文界面使用完整日期时间，避免"今天 14:50"信息不够明确。
export const formatDateLabel = (value: string, language: LanguageMode) => {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return value;
  }

  if (language === 'zh') {
    return formatZhDateTime(date);
  }

  return new Intl.DateTimeFormat('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  }).format(date);
};

// 置顶 Note 永远排在前面，其余按 sortOrder、更新时间和创建时间排序，复制不影响排序。
const getNoteEditTime = (note: NoteItem) => {
  const dates = [note.updatedAt, note.createdAt]
    .filter((value): value is string => Boolean(value))
    .map((value) => new Date(value).getTime())
    .filter((value) => Number.isFinite(value));

  return dates.length ? Math.max(...dates) : 0;
};

// 保留原始顺序作为最后兜底，避免时间完全相同时列表产生跳动。
export const sortNotesByActivity = (notes: NoteItem[]) => {
  return notes
    .map((note, index) => ({ note, index }))
    .sort((left, right) => {
      // 置顶优先
      const pinDiff = Number(right.note.favorite) - Number(left.note.favorite);
      if (pinDiff !== 0) return pinDiff;

      // 如果两个 Note 都有 sortOrder，按 sortOrder 排序（越小越前）
      const leftHasOrder = typeof left.note.sortOrder === 'number';
      const rightHasOrder = typeof right.note.sortOrder === 'number';
      if (leftHasOrder && rightHasOrder) {
        const orderDiff = left.note.sortOrder! - right.note.sortOrder!;
        if (orderDiff !== 0) return orderDiff;
      }

      // 没有 sortOrder 的按编辑时间降序
      const timeDiff = getNoteEditTime(right.note) - getNoteEditTime(left.note);
      if (timeDiff !== 0) return timeDiff;

      return left.index - right.index;
    })
    .map(({ note }) => note);
};

// ── 快捷键格式化 ──────────────────────────────────────

const shortcutModifierLabels: Record<string, string> = {
  CommandOrControl: '⌘',
  CmdOrCtrl: '⌘',
  Command: '⌘',
  Cmd: '⌘',
  Control: '⌃',
  Ctrl: '⌃',
  Alt: '⌥',
  Option: '⌥',
  Shift: '⇧',
};

const shortcutModifierOrder = ['Control', 'Ctrl', 'Alt', 'Option', 'Shift', 'CommandOrControl', 'CmdOrCtrl', 'Command', 'Cmd'];

const shortcutKeyLabels: Record<string, string> = {
  Space: 'Space',
  Enter: '↩',
  Return: '↩',
  Escape: 'Esc',
  Esc: 'Esc',
  Backspace: '⌫',
  Delete: '⌦',
  Up: '↑',
  Down: '↓',
  Left: '←',
  Right: '→',
  ArrowUp: '↑',
  ArrowDown: '↓',
  ArrowLeft: '←',
  ArrowRight: '→',
};

// 把 Electron accelerator 转成更接近系统设置里的快捷键胶囊显示。
export const formatShortcut = (shortcut: string) => {
  const parts = shortcut
    .split('+')
    .map((part) => part.trim())
    .filter(Boolean);
  if (!parts.length) {
    return '';
  }

  const modifiers = parts.filter((part) => shortcutModifierLabels[part]);
  const keys = parts.filter((part) => !shortcutModifierLabels[part]);
  const usedModifiers = new Set<string>();
  const orderedModifiers = shortcutModifierOrder
    .filter((part) => modifiers.includes(part))
    .map((part) => {
      usedModifiers.add(part);
      return shortcutModifierLabels[part];
    });
  const remainingModifiers = modifiers.filter((part) => !usedModifiers.has(part)).map((part) => shortcutModifierLabels[part] ?? part);
  const displayKeys = keys.map((part) => shortcutKeyLabels[part] ?? part.toUpperCase());

  return [...orderedModifiers, ...remainingModifiers, ...displayKeys].join('');
};

// ── 快捷键录入 ──────────────────────────────────────

export const modifierOnlyKeys = new Set(['Meta', 'Control', 'Alt', 'Shift', 'OS']);

const shortcutCodeMap: Record<string, string> = {
  Space: 'Space',
  Minus: '-',
  Equal: '=',
  BracketLeft: '[',
  BracketRight: ']',
  Backslash: '\\',
  Semicolon: ';',
  Quote: "'",
  Comma: ',',
  Period: '.',
  Slash: '/',
  Backquote: '`',
};

type ShortcutKeyboardEvent = Pick<KeyboardEvent, 'key' | 'code' | 'metaKey' | 'ctrlKey' | 'altKey' | 'shiftKey'>;

// 将浏览器键盘事件转换成 Electron accelerator 能识别的按键名。
export const normalizeShortcutKey = (event: ShortcutKeyboardEvent) => {
  if (modifierOnlyKeys.has(event.key)) {
    return '';
  }

  if (shortcutCodeMap[event.code]) {
    return shortcutCodeMap[event.code];
  }

  if (/^Key[A-Z]$/.test(event.code)) {
    return event.code.slice(3);
  }

  if (/^Digit\d$/.test(event.code)) {
    return event.code.slice(5);
  }

  if (/^F([1-9]|1\d|2[0-4])$/.test(event.code)) {
    return event.code;
  }

  const namedKeys: Record<string, string> = {
    ArrowUp: 'Up',
    ArrowDown: 'Down',
    ArrowLeft: 'Left',
    ArrowRight: 'Right',
    Escape: 'Escape',
    Backspace: 'Backspace',
    Delete: 'Delete',
    Enter: 'Enter',
    Tab: 'Tab',
  };

  if (namedKeys[event.key]) {
    return namedKeys[event.key];
  }

  return event.key.length === 1 ? event.key.toUpperCase() : event.key;
};

// 录入时只接受带主修饰键的组合，避免把单个字母注册成全局快捷键。
export const buildShortcutFromEvent = (event: ShortcutKeyboardEvent) => {
  const key = normalizeShortcutKey(event);
  if (!key) {
    return null;
  }

  const isFunctionKey = /^F([1-9]|1\d|2[0-4])$/.test(key);
  const hasPrimaryModifier = event.metaKey || event.ctrlKey || event.altKey;
  if (!hasPrimaryModifier && !isFunctionKey) {
    return null;
  }

  const modifiers: string[] = [];
  if (event.ctrlKey) modifiers.push('Control');
  if (event.altKey) modifiers.push('Alt');
  if (event.shiftKey) modifiers.push('Shift');
  if (event.metaKey) modifiers.push('CommandOrControl');

  return [...modifiers, key].join('+');
};
