import {
  ChevronDown,
  Check,
  FileText,
  Minus,
  Moon,
  MoveDiagonal2,
  Pencil,
  Plus,
  Search,
  Settings,
  Star,
  Sun,
  Tag,
  Trash2,
  X
} from 'lucide-react'
import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { AppData, AppSettings, FilterKey, LanguageMode, NoteGroup, NoteItem, ThemeMode } from '../shared/types'
import { getTaroNoteApi } from './previewApi'

const taroNoteApi = getTaroNoteApi()

type ViewMode = 'notes' | 'settings'

type NoteDraft = {
  id?: string
  content: string
  groupId: string
  favorite: boolean
}

const messages = {
  zh: {
    addCategory: '新建分类',
    allNotes: '全部',
    appearance: '外观',
    app: '应用',
    cancel: '取消',
    categories: '分类',
    categoryCreated: '分类已创建',
    categoryDeleted: '分类已删除',
    categoryExists: '分类已存在',
    categoryName: '分类名称',
    categoryRenamed: '分类已修改',
    deleteCategoryConfirm: (name: string) => `删除分类「${name}」？`,
    deleteCategoryNotesConfirm: (count: number) => `这个分类里有 ${count} 条 Note。\n点击「确定」：删除分类和这些 Note。\n点击「取消」：只删除分类，Note 移动到默认分类。`,
    categoryNamePrompt: '输入分类名称',
    closeToTray: '关闭时留在菜单栏',
    contentRequired: '内容不能为空',
    copied: '已复制',
    count: (count: number) => `${count} 条`,
    dark: '深色',
    delete: '删除',
    deleteConfirm: (title: string) => `删除「${title}」？`,
    deleted: '已删除',
    edit: '编辑',
    editNote: '编辑 Note',
    emptyCategory: '这个分类暂无 Note',
    empty: '暂无 Note',
    emptyPinned: '暂无置顶 Note',
    hideDock: '隐藏 Dock 栏',
    interfaceLanguage: '界面语言',
    keyboardShortcut: '快捷键',
    language: '语言',
    light: '浅色',
    newNote: '新建 Note',
    noteCategory: '所属分类',
    notes: 'Note',
    pinNote: '置顶',
    pinned: '置顶',
    pinnedNotes: '置顶',
    pinnedToast: '已置顶',
    placeholder: '输入要复制的 Note 内容',
    save: '保存',
    saved: '已保存',
    search: '搜索',
    settings: '设置',
    shortcutBinding: '按键绑定',
    shortcutCommand: '命令',
    shortcutListening: '按下快捷键',
    shortcutNeedModifier: '请按组合快捷键',
    shortcutShowHide: '显示 / 隐藏 TaroNote',
    shortcutUnset: '未绑定',
    toggleMaximize: '缩放窗口',
    unpinNote: '取消置顶',
    unpinnedToast: '已取消置顶',
    updated: '已更新',
    windowAlwaysOnTop: '窗口置顶',
    windowClose: '关闭窗口',
    windowMinimize: '最小化窗口',
    zh: '中文',
    en: 'English'
  },
  en: {
    addCategory: 'New Category',
    allNotes: 'All',
    appearance: 'APPEARANCE',
    app: 'APP',
    cancel: 'Cancel',
    categories: 'CATEGORIES',
    categoryCreated: 'Category created',
    categoryDeleted: 'Category deleted',
    categoryExists: 'Category already exists',
    categoryName: 'Category Name',
    categoryRenamed: 'Category renamed',
    deleteCategoryConfirm: (name: string) => `Delete "${name}"?`,
    deleteCategoryNotesConfirm: (count: number) => `This category contains ${count} Notes.\nOK: delete the category and those Notes.\nCancel: delete only the category and move Notes to the default category.`,
    categoryNamePrompt: 'Enter category name',
    closeToTray: 'Keep in Menu Bar on Close',
    contentRequired: 'Content is required',
    copied: 'Copied',
    count: (count: number) => `${count}`,
    dark: 'Dark',
    delete: 'Delete',
    deleteConfirm: (title: string) => `Delete "${title}"?`,
    deleted: 'Deleted',
    edit: 'Edit',
    editNote: 'Edit Note',
    emptyCategory: 'No Notes in this category',
    empty: 'No Notes',
    emptyPinned: 'No Pinned Notes',
    hideDock: 'Hide Dock',
    interfaceLanguage: 'Interface Language',
    keyboardShortcut: 'KEYBOARD SHORTCUT',
    language: 'LANGUAGE',
    light: 'Light',
    newNote: 'New Note',
    noteCategory: 'Category',
    notes: 'Notes',
    pinNote: 'Pin',
    pinned: 'Pinned',
    pinnedNotes: 'Pinned',
    pinnedToast: 'Pinned',
    placeholder: 'Enter the Note content to copy',
    save: 'Save',
    saved: 'Saved',
    search: 'Search',
    settings: 'Settings',
    shortcutBinding: 'Key Binding',
    shortcutCommand: 'Command',
    shortcutListening: 'Press shortcut',
    shortcutNeedModifier: 'Press a shortcut with a modifier',
    shortcutShowHide: 'Show / Hide TaroNote',
    shortcutUnset: 'Unset',
    toggleMaximize: 'Zoom Window',
    unpinNote: 'Unpin',
    unpinnedToast: 'Unpinned',
    updated: 'Updated',
    windowAlwaysOnTop: 'Always on Top',
    windowClose: 'Close Window',
    windowMinimize: 'Minimize Window',
    zh: '中文',
    en: 'English'
  }
}

type AppLabels = (typeof messages)['zh']

// 为新建 Note 和分类生成本地唯一 ID，保持渲染进程无需依赖主进程。
const createId = () => crypto.randomUUID()

// 新分类按固定色板循环取色，避免每次启动生成不同的侧栏颜色。
const categoryColorPalette = ['#dedede', '#b8c7d9', '#c9d3b8', '#d9c2b8', '#c7bfd9', '#d8ca9d']

// 从侧栏筛选值中解析分类 ID，非分类筛选统一返回空字符串。
const getFilterGroupId = (filter: FilterKey) => (filter.startsWith('group:') ? filter.slice('group:'.length) : '')

// 返回稳定函数引用，同时始终调用最新逻辑，避免大列表子组件因为回调地址变化而重复渲染。
const useStableCallback = <Args extends unknown[], Return>(callback: (...args: Args) => Return) => {
  const callbackRef = useRef(callback)

  useEffect(() => {
    callbackRef.current = callback
  }, [callback])

  return useCallback((...args: Args) => callbackRef.current(...args), [])
}

// 判断当前焦点是否在可输入区域，避免快捷键打断用户编辑 Note。
const isEditableTarget = (target: EventTarget | null) => {
  if (!(target instanceof HTMLElement)) {
    return false
  }

  const tagName = target.tagName.toLowerCase()
  return target.isContentEditable || tagName === 'input' || tagName === 'textarea' || tagName === 'select'
}

// 从 Note 正文提取一个简短标题，方便删除确认和未来扩展搜索。
const makeTitle = (content: string, language: LanguageMode = 'zh') => {
  const line = content.split('\n').find((item) => item.trim())?.trim() ?? ''
  return line.slice(0, 28) || (language === 'zh' ? '未命名 Note' : 'Untitled Note')
}

// 补齐日期时间里的个位数，保证卡片时间稳定显示为 2026-06-09 14:50。
const padDatePart = (value: number) => `${value}`.padStart(2, '0')

// 按中文界面的展示要求输出完整日期时间，避免相对时间隐藏日期信息。
const formatZhDateTime = (date: Date) => {
  const year = date.getFullYear()
  const month = padDatePart(date.getMonth() + 1)
  const day = padDatePart(date.getDate())
  const hour = padDatePart(date.getHours())
  const minute = padDatePart(date.getMinutes())

  return `${year}-${month}-${day} ${hour}:${minute}`
}

// 将更新时间按当前语言格式化；中文界面使用完整日期时间，避免“今天 14:50”信息不够明确。
const formatDateLabel = (value: string, language: LanguageMode) => {
  const date = new Date(value)

  if (Number.isNaN(date.getTime())) {
    return value
  }

  if (language === 'zh') {
    return formatZhDateTime(date)
  }

  return new Intl.DateTimeFormat('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true
  }).format(date)
}

// 置顶 Note 永远排在前面，其余再按更新时间、复制时间和创建时间排序。
const getNoteActivityTime = (note: NoteItem) => {
  const dates = [note.updatedAt, note.lastCopiedAt, note.createdAt]
    .filter((value): value is string => Boolean(value))
    .map((value) => new Date(value).getTime())
    .filter((value) => Number.isFinite(value))

  return dates.length ? Math.max(...dates) : 0
}

// 将活动时间转成 ISO 字符串，复用统一日期格式化逻辑。
const getNoteActivityDate = (note: NoteItem) => {
  const time = getNoteActivityTime(note)
  return time ? new Date(time).toISOString() : note.createdAt
}

// 保留原始顺序作为最后兜底，避免时间完全相同时列表产生跳动。
const sortNotesByActivity = (notes: NoteItem[]) => {
  return notes
    .map((note, index) => ({ note, index }))
    .sort(
      (left, right) =>
        Number(right.note.favorite) - Number(left.note.favorite) ||
        getNoteActivityTime(right.note) - getNoteActivityTime(left.note) ||
        left.index - right.index
    )
    .map(({ note }) => note)
}

const shortcutModifierLabels: Record<string, string> = {
  CommandOrControl: '⌘',
  CmdOrCtrl: '⌘',
  Command: '⌘',
  Cmd: '⌘',
  Control: '⌃',
  Ctrl: '⌃',
  Alt: '⌥',
  Option: '⌥',
  Shift: '⇧'
}

const shortcutModifierOrder = ['Control', 'Ctrl', 'Alt', 'Option', 'Shift', 'CommandOrControl', 'CmdOrCtrl', 'Command', 'Cmd']

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
  ArrowRight: '→'
}

// 把 Electron accelerator 转成更接近系统设置里的快捷键胶囊显示。
const formatShortcut = (shortcut: string) => {
  const parts = shortcut.split('+').map((part) => part.trim()).filter(Boolean)
  if (!parts.length) {
    return ''
  }

  const modifiers = parts.filter((part) => shortcutModifierLabels[part])
  const keys = parts.filter((part) => !shortcutModifierLabels[part])
  const usedModifiers = new Set<string>()
  const orderedModifiers = shortcutModifierOrder
    .filter((part) => modifiers.includes(part))
    .map((part) => {
      usedModifiers.add(part)
      return shortcutModifierLabels[part]
    })
  const remainingModifiers = modifiers.filter((part) => !usedModifiers.has(part)).map((part) => shortcutModifierLabels[part] ?? part)
  const displayKeys = keys.map((part) => shortcutKeyLabels[part] ?? part.toUpperCase())

  return [...orderedModifiers, ...remainingModifiers, ...displayKeys].join('')
}

const modifierOnlyKeys = new Set(['Meta', 'Control', 'Alt', 'Shift', 'OS'])

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
  Backquote: '`'
}

type ShortcutKeyboardEvent = Pick<KeyboardEvent, 'key' | 'code' | 'metaKey' | 'ctrlKey' | 'altKey' | 'shiftKey'>

// 将浏览器键盘事件转换成 Electron accelerator 能识别的按键名。
const normalizeShortcutKey = (event: ShortcutKeyboardEvent) => {
  if (modifierOnlyKeys.has(event.key)) {
    return ''
  }

  if (shortcutCodeMap[event.code]) {
    return shortcutCodeMap[event.code]
  }

  if (/^Key[A-Z]$/.test(event.code)) {
    return event.code.slice(3)
  }

  if (/^Digit\d$/.test(event.code)) {
    return event.code.slice(5)
  }

  if (/^F([1-9]|1\d|2[0-4])$/.test(event.code)) {
    return event.code
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
    Tab: 'Tab'
  }

  if (namedKeys[event.key]) {
    return namedKeys[event.key]
  }

  return event.key.length === 1 ? event.key.toUpperCase() : event.key
}

// 录入时只接受带主修饰键的组合，避免把单个字母注册成全局快捷键。
const buildShortcutFromEvent = (event: ShortcutKeyboardEvent) => {
  const key = normalizeShortcutKey(event)
  if (!key) {
    return null
  }

  const isFunctionKey = /^F([1-9]|1\d|2[0-4])$/.test(key)
  const hasPrimaryModifier = event.metaKey || event.ctrlKey || event.altKey
  if (!hasPrimaryModifier && !isFunctionKey) {
    return null
  }

  const modifiers: string[] = []
  if (event.ctrlKey) modifiers.push('Control')
  if (event.altKey) modifiers.push('Alt')
  if (event.shiftKey) modifiers.push('Shift')
  if (event.metaKey) modifiers.push('CommandOrControl')

  return [...modifiers, key].join('+')
}

function App() {
  const [data, setData] = useState<AppData | null>(null)
  const [view, setView] = useState<ViewMode>('notes')
  const [activeFilter, setActiveFilter] = useState<FilterKey>('all')
  const [searchOpen, setSearchOpen] = useState(false)
  const [searchText, setSearchText] = useState('')
  const [selectedIndex, setSelectedIndex] = useState(0)
  const [draft, setDraft] = useState<NoteDraft | null>(null)
  const [categoryDraftOpen, setCategoryDraftOpen] = useState(false)
  const [categoryDraftName, setCategoryDraftName] = useState('')
  const [editingCategoryId, setEditingCategoryId] = useState('')
  const [editingCategoryName, setEditingCategoryName] = useState('')
  const [shortcutDraft, setShortcutDraft] = useState('')
  const [toast, setToast] = useState('')
  const categoryInputRef = useRef<HTMLInputElement>(null)
  const categoryEditInputRef = useRef<HTMLInputElement>(null)
  const searchInputRef = useRef<HTMLInputElement>(null)
  const searchPanelRef = useRef<HTMLDivElement>(null)
  const notesCanvasRef = useRef<HTMLElement>(null)
  const toastTimerRef = useRef<number | undefined>(undefined)
  const language = data?.settings.language ?? 'zh'
  const t = messages[language]
  const groupsById = useMemo(() => new Map((data?.groups ?? []).map((group) => [group.id, group])), [data?.groups])
  const activeGroupId = getFilterGroupId(activeFilter)
  const activeGroup = activeGroupId ? groupsById.get(activeGroupId) : undefined
  // 一次遍历缓存置顶数和分类计数，避免分类较多时每个侧栏项都重新扫描全部 Note。
  const noteStats = useMemo(() => {
    const groupCounts = new Map<string, number>()
    let pinnedCount = 0

    for (const note of data?.notes ?? []) {
      groupCounts.set(note.groupId, (groupCounts.get(note.groupId) ?? 0) + 1)
      if (note.favorite) {
        pinnedCount += 1
      }
    }

    return { groupCounts, pinnedCount }
  }, [data?.notes])
  const pinnedCount = noteStats.pinnedCount
  const currentViewTitle = view === 'settings' ? t.settings : activeFilter === 'pinned' ? t.pinnedNotes : activeGroup?.name ?? t.notes
  const emptyNotesText = activeFilter === 'pinned' ? t.emptyPinned : activeGroup ? t.emptyCategory : t.empty

  // 首次加载本地数据，并响应托盘菜单打开设置页的动作。
  useEffect(() => {
    taroNoteApi.getState().then((nextData) => {
      setData(nextData)
      setShortcutDraft(nextData.settings.globalShortcut)
    })

    return taroNoteApi.onOpenSettings(() => {
      setView('settings')
      setSearchOpen(false)
      setDraft(null)
    })
  }, [])

  useEffect(() => {
    if (searchOpen) {
      searchInputRef.current?.focus()
    }
  }, [searchOpen])

  useEffect(() => {
    if (categoryDraftOpen) {
      categoryInputRef.current?.focus()
    }
  }, [categoryDraftOpen])

  useEffect(() => {
    if (editingCategoryId) {
      categoryEditInputRef.current?.focus()
      categoryEditInputRef.current?.select()
    }
  }, [editingCategoryId])

  // 空搜索框打开后，点击搜索区域外自动收起，避免顶栏残留输入框。
  useEffect(() => {
    if (!searchOpen || view !== 'notes') {
      return
    }

    const handlePointerDown = (event: PointerEvent) => {
      if (!(event.target instanceof Node)) {
        return
      }

      if (searchPanelRef.current?.contains(event.target)) {
        return
      }

      if (!searchText.trim()) {
        setSearchOpen(false)
      }
    }

    window.addEventListener('pointerdown', handlePointerDown)
    return () => window.removeEventListener('pointerdown', handlePointerDown)
  }, [searchOpen, searchText, view])

  useEffect(() => {
    if (data) {
      document.documentElement.dataset.theme = data.settings.theme
      document.documentElement.lang = language === 'zh' ? 'zh-CN' : 'en'
      setShortcutDraft(data.settings.globalShortcut)
    }
  }, [data, language])

  // 分类可能来自导入文件，若当前筛选指向了不存在的分类，就自动回到全部列表。
  useEffect(() => {
    if (!data || !activeGroupId) {
      return
    }

    if (!data.groups.some((group) => group.id === activeGroupId)) {
      setActiveFilter('all')
    }
  }, [activeGroupId, data])

  // Note 排序只在原始列表变化时执行；搜索输入变化时复用排序结果，避免 1000 条数据每次按键都重新排序。
  const sortedNotes = useMemo(() => sortNotesByActivity(data?.notes ?? []), [data?.notes])

  // 预先构建小写搜索索引，搜索时直接查 Map，减少连续输入时的字符串拼接成本。
  const noteSearchIndex = useMemo(() => {
    const index = new Map<string, string>()

    for (const note of data?.notes ?? []) {
      index.set(note.id, `${note.title} ${note.content} ${groupsById.get(note.groupId)?.name ?? ''}`.toLowerCase())
    }

    return index
  }, [data?.notes, groupsById])

  // 搜索匹配标题、正文和分类名；先复用缓存排序，再按当前筛选和搜索词收窄范围。
  const filteredNotes = useMemo(() => {
    const query = searchText.trim().toLowerCase()
    const groupId = getFilterGroupId(activeFilter)

    return sortedNotes.filter((note) => {
      if (activeFilter === 'pinned') {
        if (!note.favorite) {
          return false
        }
      }

      if (groupId && note.groupId !== groupId) {
        return false
      }

      return query ? (noteSearchIndex.get(note.id) ?? '').includes(query) : true
    })
  }, [activeFilter, noteSearchIndex, searchText, sortedNotes])

  useEffect(() => {
    setSelectedIndex((current) => Math.min(Math.max(current, 0), Math.max(filteredNotes.length - 1, 0)))
  }, [filteredNotes.length])

  // 用轻提示反馈复制、保存和删除结果，不打断用户连续操作；重复触发时清理旧定时器。
  const showToast = (message: string) => {
    if (toastTimerRef.current) {
      window.clearTimeout(toastTimerRef.current)
    }

    setToast(message)
    toastTimerRef.current = window.setTimeout(() => setToast(''), 1400)
  }

  // 侧栏分类计数从缓存统计里读取，避免渲染分类时重复过滤 Note。
  const getGroupNoteCount = (groupId: string) => noteStats.groupCounts.get(groupId) ?? 0

  useEffect(() => {
    return () => {
      if (toastTimerRef.current) {
        window.clearTimeout(toastTimerRef.current)
      }
    }
  }, [])

  // 快捷键只处理列表里的复制、搜索、新建和删除，输入框聚焦时不拦截。
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (!data || draft || categoryDraftOpen || editingCategoryId || view !== 'notes' || isEditableTarget(event.target)) {
        return
      }

      if (event.metaKey && event.key.toLowerCase() === 'n') {
        event.preventDefault()
        openNewNote()
        return
      }

      if (event.metaKey && event.key.toLowerCase() === 'f') {
        event.preventDefault()
        setSearchOpen(true)
        return
      }

      if (event.metaKey || event.ctrlKey || event.altKey) {
        return
      }

      if (event.key === 'ArrowDown') {
        event.preventDefault()
        setSelectedIndex((current) => Math.min(current + 1, Math.max(filteredNotes.length - 1, 0)))
        return
      }

      if (event.key === 'ArrowUp') {
        event.preventDefault()
        setSelectedIndex((current) => Math.max(current - 1, 0))
        return
      }

      if (event.key === 'Enter' && filteredNotes[selectedIndex]) {
        event.preventDefault()
        void copyNote(filteredNotes[selectedIndex])
        return
      }

      if (event.key === 'Backspace' || event.key === 'Delete') {
        event.preventDefault()
        if (filteredNotes[selectedIndex]) {
          void removeNote(filteredNotes[selectedIndex])
        }
        return
      }

      if (event.key.length === 1) {
        event.preventDefault()
        setSearchOpen(true)
        setSearchText(event.key)
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [categoryDraftOpen, data, draft, editingCategoryId, filteredNotes, selectedIndex, view])

  // 统一保存入口，确保每次本地数据写入后立即刷新界面。
  const savePayload = async (payload: Parameters<typeof taroNoteApi.saveData>[0]) => {
    const nextData = await taroNoteApi.saveData(payload)
    setData(nextData)
    return nextData
  }

  // 打开新建分类面板前先收起其他编辑态，保证侧栏只出现一个输入区域。
  const openCategoryDraft = () => {
    setDraft(null)
    setEditingCategoryId('')
    setEditingCategoryName('')
    setCategoryDraftOpen(true)
    setCategoryDraftName('')
    setView('notes')
  }

  // 关闭新建分类面板并清空未保存输入，避免下次打开看到旧草稿。
  const cancelCategoryDraft = () => {
    setCategoryDraftOpen(false)
    setCategoryDraftName('')
  }

  // 分类创建后立即切换过去，方便用户连续新建该分类下的 Note。
  const saveCategoryDraft = async () => {
    if (!data) return

    const name = categoryDraftName.trim()
    if (!name) {
      categoryInputRef.current?.focus()
      return
    }

    if (data.groups.some((group) => group.name.toLowerCase() === name.toLowerCase())) {
      showToast(t.categoryExists)
      categoryInputRef.current?.focus()
      return
    }

    const group: NoteGroup = {
      id: createId(),
      name,
      color: categoryColorPalette[data.groups.length % categoryColorPalette.length],
      sortOrder: data.groups.length
    }

    await savePayload({ groups: [...data.groups, group] })
    setCategoryDraftOpen(false)
    setCategoryDraftName('')
    setView('notes')
    setActiveFilter(`group:${group.id}`)
    showToast(t.categoryCreated)
  }

  // 进入分类行内编辑时先关闭新建分类面板，避免两个输入态同时出现。
  const openCategoryEdit = (group: NoteGroup) => {
    cancelCategoryDraft()
    setEditingCategoryId(group.id)
    setEditingCategoryName(group.name)
  }

  // 退出分类编辑时清理目标 ID 和输入框内容。
  const cancelCategoryEdit = () => {
    setEditingCategoryId('')
    setEditingCategoryName('')
  }

  // 分类改名只更新分类元数据，保留原来的 Note 归属关系和排序。
  const saveCategoryEdit = async (group: NoteGroup) => {
    if (!data) return

    const name = editingCategoryName.trim()
    if (!name) {
      categoryEditInputRef.current?.focus()
      return
    }

    if (data.groups.some((item) => item.id !== group.id && item.name.toLowerCase() === name.toLowerCase())) {
      showToast(t.categoryExists)
      categoryEditInputRef.current?.focus()
      return
    }

    if (name === group.name) {
      cancelCategoryEdit()
      return
    }

    await savePayload({
      groups: data.groups.map((item) => (item.id === group.id ? { ...item, name } : item))
    })
    cancelCategoryEdit()
    showToast(t.categoryRenamed)
  }

  // 删除分类前先确认处理分类内的 Note，避免用户误删常用话术。
  const removeCategory = async (group: NoteGroup) => {
    if (!data || data.groups.length <= 1 || group.id === data.groups[0]?.id) return

    const fallbackGroup = data.groups.find((item) => item.id !== group.id) ?? data.groups[0]
    if (!fallbackGroup || !window.confirm(t.deleteCategoryConfirm(group.name))) {
      return
    }

    const notesInGroup = data.notes.filter((note) => note.groupId === group.id)
    const shouldDeleteNotes = notesInGroup.length > 0 && window.confirm(t.deleteCategoryNotesConfirm(notesInGroup.length))

    await savePayload({
      groups: data.groups.filter((item) => item.id !== group.id).map((item, index) => ({ ...item, sortOrder: index })),
      notes: shouldDeleteNotes
        ? data.notes.filter((note) => note.groupId !== group.id)
        : data.notes.map((note) => (note.groupId === group.id ? { ...note, groupId: fallbackGroup.id } : note))
    })

    if (activeFilter === `group:${group.id}`) {
      setActiveFilter(`group:${fallbackGroup.id}`)
    }

    setDraft((current) => {
      if (current?.groupId !== group.id) {
        return current
      }

      return shouldDeleteNotes ? null : { ...current, groupId: fallbackGroup.id }
    })
    showToast(t.categoryDeleted)
  }

  // 点击 Note 只复制正文，并把复制次数、最后复制时间交给主进程更新。
  const copyNote = async (note: NoteItem) => {
    const nextData = await taroNoteApi.copyNote(note.id)
    setData(nextData)
    showToast(t.copied)
  }

  // 置顶状态复用 favorite 字段，保持数据结构不额外膨胀。
  const togglePinned = async (note: NoteItem) => {
    if (!data) return

    const updatedAt = new Date().toISOString()
    await savePayload({
      notes: data.notes.map((item) => (item.id === note.id ? { ...item, favorite: !item.favorite, updatedAt } : item))
    })
    showToast(note.favorite ? t.unpinnedToast : t.pinnedToast)
  }

  // 新建 Note 优先继承当前分类筛选，在置顶视图中新建时默认置顶。
  const openNewNote = () => {
    const defaultGroupId = data?.groups[0]?.id ?? 'notes'
    const groupId = activeGroupId && data?.groups.some((group) => group.id === activeGroupId) ? activeGroupId : defaultGroupId
    cancelCategoryDraft()
    cancelCategoryEdit()
    setDraft({ content: '', groupId, favorite: activeFilter === 'pinned' })
    setView('notes')
  }

  // 编辑 Note 时先复制到草稿，用户保存前不直接改动列表数据。
  const openEditNote = (note: NoteItem) => {
    cancelCategoryDraft()
    cancelCategoryEdit()
    setDraft({
      id: note.id,
      content: note.content,
      groupId: note.groupId,
      favorite: note.favorite
    })
  }

  // 保存新 Note 后回到列表顶部，让刚创建的卡片立即可见。
  const scrollNotesToTop = () => {
    window.requestAnimationFrame(() => {
      notesCanvasRef.current?.scrollTo({ top: 0, behavior: 'smooth' })
    })
  }

  // 新建和编辑共用同一个保存逻辑，第一版只维护纯文本 Note。
  const saveDraft = async () => {
    if (!data || !draft) return

    const content = draft.content.trim()
    if (!content) {
      showToast(t.contentRequired)
      return
    }

    const updatedAt = new Date().toISOString()
    const title = makeTitle(content, language)
    const groupId = data.groups.some((group) => group.id === draft.groupId) ? draft.groupId : data.groups[0]?.id ?? 'notes'

    if (draft.id) {
      await savePayload({
        notes: data.notes.map((note) =>
          note.id === draft.id ? { ...note, title, content, groupId, favorite: draft.favorite, updatedAt } : note
        )
      })
    } else {
      await savePayload({
        notes: [
          {
            id: createId(),
            title,
            content,
            groupId,
            favorite: draft.favorite,
            createdAt: updatedAt,
            updatedAt,
            copyCount: 0
          },
          ...data.notes
        ]
      })
    }

    setDraft(null)
    setSelectedIndex(0)
    scrollNotesToTop()
    showToast(t.saved)
  }

  // 删除前进行二次确认，避免快捷键或误点直接清掉常用 Note。
  const removeNote = async (note: NoteItem) => {
    if (!data) return
    if (!window.confirm(t.deleteConfirm(makeTitle(note.content, language)))) return

    await savePayload({ notes: data.notes.filter((item) => item.id !== note.id) })
    setDraft((current) => (current?.id === note.id ? null : current))
    showToast(t.deleted)
  }

  // 设置先乐观更新界面，再等待主进程注册快捷键和应用系统设置。
  const applySettings = async (settings: AppSettings) => {
    if (!data) return

    setData({ ...data, settings })
    setShortcutDraft(settings.globalShortcut)
    const response = await taroNoteApi.applySettings(settings)
    setData(response.data)
    setShortcutDraft(response.data.settings.globalShortcut)
    const nextLabels = messages[response.data.settings.language]
    showToast(response.shortcut.message ?? nextLabels.updated)
  }

  // 局部设置变更统一合并成完整 settings，减少各控件重复保存逻辑。
  const updateSetting = (partial: Partial<AppSettings>) => {
    if (!data) return
    void applySettings({ ...data.settings, ...partial })
  }

  // 主题切换单独封装，便于 ThemeChoice 只关心当前选择值。
  const updateTheme = (theme: ThemeMode) => {
    updateSetting({ theme })
  }

  // 语言切换通过设置保存入口持久化，刷新后仍保留用户选择。
  const updateLanguage = (nextLanguage: LanguageMode) => {
    updateSetting({ language: nextLanguage })
  }

  const handleCopyNote = useStableCallback(copyNote)
  const handleEditNote = useStableCallback(openEditNote)
  const handleDeleteNote = useStableCallback(removeNote)
  const handleTogglePinned = useStableCallback(togglePinned)

  if (!data) {
    return <div className="boot">TaroNote</div>
  }

  return (
    <main className="app-shell">
      <aside className="sidebar">
        <div className="traffic-lights">
          <button className="traffic red" aria-label={t.windowClose} onClick={() => void taroNoteApi.closeWindow()}>
            <X size={8} strokeWidth={3.4} />
          </button>
          <button className="traffic yellow" aria-label={t.windowMinimize} onClick={() => void taroNoteApi.minimizeWindow()}>
            <Minus size={8} strokeWidth={3.8} />
          </button>
          <button className="traffic green" aria-label={t.toggleMaximize} onClick={() => void taroNoteApi.toggleMaximize()}>
            <MoveDiagonal2 size={7} strokeWidth={3.2} />
          </button>
        </div>

        <div className="cloud-title">
          <strong>TaroNote</strong>
        </div>

        <nav className="side-nav">
          <button
            className={`sidebar-item ${view === 'notes' && activeFilter === 'all' ? 'active' : ''}`}
            onClick={() => {
              setView('notes')
              setActiveFilter('all')
            }}
          >
            <FileText className="sidebar-item-icon" size={18} />
            <span className="sidebar-item-label">{t.allNotes}</span>
            <em className="sidebar-item-meta">{data.notes.length}</em>
          </button>
          <button
            className={`sidebar-item ${view === 'notes' && activeFilter === 'pinned' ? 'active' : ''}`}
            onClick={() => {
              setView('notes')
              setActiveFilter('pinned')
            }}
          >
            <Star className="sidebar-item-icon" size={18} />
            <span className="sidebar-item-label">{t.pinnedNotes}</span>
            <em className="sidebar-item-meta">{pinnedCount}</em>
          </button>
        </nav>

        <div className="sidebar-section no-drag">
          <div className="sidebar-item sidebar-section-head">
            <Tag className="sidebar-item-icon" size={18} />
            <span className="sidebar-item-label">{t.categories}</span>
            <button className="sidebar-item-action" title={t.addCategory} onClick={openCategoryDraft}>
              <Plus size={16} />
            </button>
          </div>
          <div className="category-list">
            {data.groups.map((group, index) => {
              const isActive = view === 'notes' && activeFilter === `group:${group.id}`
              const canDelete = index > 0

              if (editingCategoryId === group.id) {
                return (
                  <div className="sidebar-item category-draft-row category-edit-row" key={group.id}>
                    <input
                      ref={categoryEditInputRef}
                      value={editingCategoryName}
                      placeholder={t.categoryNamePrompt}
                      onChange={(event) => setEditingCategoryName(event.target.value)}
                      onKeyDown={(event) => {
                        if (event.key === 'Enter') {
                          event.preventDefault()
                          void saveCategoryEdit(group)
                        }

                        if (event.key === 'Escape') {
                          event.preventDefault()
                          cancelCategoryEdit()
                        }
                      }}
                    />
                    <button title={t.save} onMouseDown={(event) => event.preventDefault()} onClick={() => void saveCategoryEdit(group)}>
                      <Check size={15} />
                    </button>
                    <button title={t.cancel} onMouseDown={(event) => event.preventDefault()} onClick={cancelCategoryEdit}>
                      <X size={14} />
                    </button>
                  </div>
                )
              }

              return (
                <div className={`sidebar-item category-row ${isActive ? 'active' : ''}`} key={group.id}>
                  <button
                    className="category-button"
                    onClick={() => {
                      setView('notes')
                      setActiveFilter(`group:${group.id}`)
                    }}
                  >
                    <span className="sidebar-item-label">{group.name}</span>
                    <em className="sidebar-item-meta">{getGroupNoteCount(group.id)}</em>
                  </button>
                  <button
                    className={canDelete ? 'category-edit' : 'category-edit solo'}
                    title={t.edit}
                    onClick={(event) => {
                      event.stopPropagation()
                      openCategoryEdit(group)
                    }}
                  >
                    <Pencil size={14} />
                  </button>
                  {canDelete && (
                    <button
                      className="category-delete"
                      title={t.delete}
                      onClick={(event) => {
                        event.stopPropagation()
                        void removeCategory(group)
                      }}
                    >
                      <Trash2 size={14} />
                    </button>
                  )}
                </div>
              )
            })}
          </div>
        </div>

        <nav className="side-nav side-nav-bottom">
          <button
            className={`sidebar-item ${view === 'settings' ? 'active' : ''}`}
            onClick={() => {
              setView('settings')
              setSearchOpen(false)
            }}
          >
            <Settings className="sidebar-item-icon" size={18} />
            <span className="sidebar-item-label">{t.settings}</span>
          </button>
        </nav>
      </aside>

      <section className="workspace">
        <header className="topbar">
          <h1>{currentViewTitle}</h1>
          <div className="top-actions no-drag">
            <div className="search-cluster" ref={searchPanelRef}>
              {searchOpen && view === 'notes' && (
                <label className="inline-search">
                  <Search size={16} />
                  <input ref={searchInputRef} value={searchText} onChange={(event) => setSearchText(event.target.value)} />
                  {searchText && (
                    <button onClick={() => setSearchText('')}>
                      <X size={14} />
                    </button>
                  )}
                </label>
              )}
              <button className="toolbar-button" title={t.search} onClick={() => setSearchOpen((open) => !open)}>
                <Search size={18} />
              </button>
            </div>
            <button className="toolbar-button" title={t.newNote} onClick={openNewNote}>
              <Plus size={20} />
            </button>
          </div>
        </header>

        {view === 'notes' ? (
          <NotesView
            notes={filteredNotes}
            groups={data.groups}
            selectedIndex={selectedIndex}
            onCopy={handleCopyNote}
            onEdit={handleEditNote}
            onDelete={handleDeleteNote}
            onTogglePinned={handleTogglePinned}
            labels={t}
            language={language}
            canvasRef={notesCanvasRef}
            emptyText={emptyNotesText}
          />
        ) : (
          <SettingsView
            settings={data.settings}
            labels={t}
            shortcutDraft={shortcutDraft}
            updateTheme={updateTheme}
            updateLanguage={updateLanguage}
            updateSetting={updateSetting}
            applySettings={applySettings}
          />
        )}
      </section>

      <footer className="bottom-count">{t.count(filteredNotes.length)}</footer>

      {draft && (
        <section className="note-editor no-drag">
          <div className="editor-head">
            <span>{draft.id ? t.editNote : t.newNote}</span>
            <button onClick={() => setDraft(null)}>
              <X size={18} />
            </button>
          </div>
          <div className="editor-meta">
            <div className="editor-category">
              <span>{t.noteCategory}</span>
              <CategoryPicker
                groups={data.groups}
                labels={t}
                value={draft.groupId}
                onChange={(groupId) => setDraft((current) => (current ? { ...current, groupId } : current))}
              />
            </div>
            <button className={`editor-pin ${draft.favorite ? 'active' : ''}`} onClick={() => setDraft({ ...draft, favorite: !draft.favorite })}>
              <Star size={16} fill={draft.favorite ? 'currentColor' : 'none'} />
              <span>{draft.favorite ? t.pinned : t.pinNote}</span>
            </button>
          </div>
          <textarea
            autoFocus
            placeholder={t.placeholder}
            value={draft.content}
            onChange={(event) => setDraft({ ...draft, content: event.target.value })}
          />
          <div className="editor-actions">
            {draft.id && (
              <button
                className="ghost danger"
                onClick={() => {
                  const note = data.notes.find((item) => item.id === draft.id)
                  if (note) void removeNote(note)
                }}
              >
                {t.delete}
              </button>
            )}
            <button className="ghost" onClick={() => setDraft(null)}>
              {t.cancel}
            </button>
            <button className="solid" onClick={() => void saveDraft()}>
              {t.save}
            </button>
          </div>
        </section>
      )}

      {categoryDraftOpen && (
        <section className="note-editor category-editor no-drag">
          <div className="editor-head">
            <span>{t.addCategory}</span>
            <button onClick={cancelCategoryDraft}>
              <X size={18} />
            </button>
          </div>
          <label className="category-name-field">
            <span>{t.categoryName}</span>
            <input
              ref={categoryInputRef}
              autoFocus
              value={categoryDraftName}
              placeholder={t.categoryNamePrompt}
              onChange={(event) => setCategoryDraftName(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === 'Enter') {
                  event.preventDefault()
                  void saveCategoryDraft()
                }

                if (event.key === 'Escape') {
                  event.preventDefault()
                  cancelCategoryDraft()
                }
              }}
            />
          </label>
          <div className="editor-actions">
            <button className="ghost" onClick={cancelCategoryDraft}>
              {t.cancel}
            </button>
            <button className="solid" onClick={() => void saveCategoryDraft()}>
              {t.save}
            </button>
          </div>
        </section>
      )}

      {toast && <div className="toast no-drag">{toast}</div>}
    </main>
  )
}

type NotesViewProps = {
  notes: NoteItem[]
  groups: NoteGroup[]
  selectedIndex: number
  labels: AppLabels
  language: LanguageMode
  canvasRef: React.RefObject<HTMLElement>
  emptyText: string
  onCopy: (note: NoteItem) => Promise<void>
  onEdit: (note: NoteItem) => void
  onDelete: (note: NoteItem) => Promise<void>
  onTogglePinned: (note: NoteItem) => Promise<void>
}

type NoteCardProps = {
  note: NoteItem
  group?: NoteGroup
  isSelected: boolean
  labels: AppLabels
  language: LanguageMode
  onCopy: (note: NoteItem) => Promise<void>
  onEdit: (note: NoteItem) => void
  onDelete: (note: NoteItem) => Promise<void>
  onTogglePinned: (note: NoteItem) => Promise<void>
}

// Note 卡片拆成 memo 组件，键盘选择或搜索输入时避免 1000 条列表全部重新渲染。
const NoteCard = memo(function NoteCard({ note, group, isSelected, labels, language, onCopy, onEdit, onDelete, onTogglePinned }: NoteCardProps) {
  // 提前计算卡片展示文案，截断时可通过 title 悬浮查看完整内容。
  const noteDateLabel = formatDateLabel(getNoteActivityDate(note), language)

  return (
    <article className={`note-card ${isSelected ? 'selected' : ''} ${note.favorite ? 'pinned' : ''}`} onClick={() => void onCopy(note)}>
      <div className="note-date-row">
        <div className="note-date" title={noteDateLabel}>
          {noteDateLabel}
        </div>
        {note.favorite && (
          <span className="pin-badge">
            <Star size={13} fill="currentColor" />
            {labels.pinned}
          </span>
        )}
      </div>
      <div className="note-text" title={note.content}>
        {note.content}
      </div>
      {group && (
        <div className="note-footer">
          <span className="note-category-badge" title={group.name}>
            <span style={{ backgroundColor: group.color }} />
            {group.name}
          </span>
        </div>
      )}
      <div className="card-actions">
        <button
          className={note.favorite ? 'active' : ''}
          title={note.favorite ? labels.unpinNote : labels.pinNote}
          onClick={(event) => {
            event.stopPropagation()
            void onTogglePinned(note)
          }}
        >
          <Star size={16} fill={note.favorite ? 'currentColor' : 'none'} />
        </button>
        <button
          title={labels.edit}
          onClick={(event) => {
            event.stopPropagation()
            onEdit(note)
          }}
        >
          <Pencil size={16} />
        </button>
        <button
          title={labels.delete}
          onClick={(event) => {
            event.stopPropagation()
            void onDelete(note)
          }}
        >
          <Trash2 size={16} />
        </button>
      </div>
    </article>
  )
})

// Note 列表视图只负责渲染和派发操作，具体数据修改留给上层 App。
function NotesView({ notes, groups, selectedIndex, labels, language, canvasRef, emptyText, onCopy, onEdit, onDelete, onTogglePinned }: NotesViewProps) {
  // 列表渲染时只构建一次分类索引，避免每张卡片都线性查找分类。
  const groupsById = useMemo(() => new Map(groups.map((group) => [group.id, group])), [groups])

  return (
    <section className="notes-canvas no-drag" ref={canvasRef}>
      <div className="notes-stack">
        {notes.map((note, index) => {
          const group = groupsById.get(note.groupId)

          return (
            <NoteCard
              key={note.id}
              note={note}
              group={group}
              isSelected={index === selectedIndex}
              labels={labels}
              language={language}
              onCopy={onCopy}
              onEdit={onEdit}
              onDelete={onDelete}
              onTogglePinned={onTogglePinned}
            />
          )
        })}

        {!notes.length && <div className="empty-state">{emptyText}</div>}
      </div>
    </section>
  )
}

type CategoryPickerProps = {
  groups: NoteGroup[]
  labels: AppLabels
  value: string
  onChange: (groupId: string) => void
}

// 自定义分类下拉避免系统 select 样式突兀，也让控件宽度稳定贴近左侧。
function CategoryPicker({ groups, labels, value, onChange }: CategoryPickerProps) {
  const [open, setOpen] = useState(false)
  const pickerRef = useRef<HTMLDivElement>(null)
  const selectedGroup = groups.find((group) => group.id === value) ?? groups[0]

  useEffect(() => {
    if (!open) {
      return
    }

    const handlePointerDown = (event: PointerEvent) => {
      if (event.target instanceof Node && pickerRef.current?.contains(event.target)) {
        return
      }

      setOpen(false)
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setOpen(false)
      }
    }

    window.addEventListener('pointerdown', handlePointerDown)
    window.addEventListener('keydown', handleKeyDown)
    return () => {
      window.removeEventListener('pointerdown', handlePointerDown)
      window.removeEventListener('keydown', handleKeyDown)
    }
  }, [open])

  return (
    <div className="category-picker" ref={pickerRef}>
      <button
        aria-expanded={open}
        aria-haspopup="listbox"
        className={`category-picker-trigger ${open ? 'open' : ''}`}
        type="button"
        onClick={() => setOpen((current) => !current)}
      >
        <span>{selectedGroup?.name ?? labels.categoryName}</span>
        <ChevronDown size={15} />
      </button>
      {open && (
        <div className="category-picker-menu" role="listbox">
          {groups.map((group) => {
            const selected = group.id === value

            return (
              <button
                aria-selected={selected}
                className={`category-picker-option ${selected ? 'selected' : ''}`}
                key={group.id}
                role="option"
                type="button"
                onClick={() => {
                  onChange(group.id)
                  setOpen(false)
                }}
              >
                <span>{group.name}</span>
                {selected && <Check size={14} />}
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}

type SettingsViewProps = {
  settings: AppSettings
  labels: AppLabels
  shortcutDraft: string
  updateTheme: (theme: ThemeMode) => void
  updateLanguage: (language: LanguageMode) => void
  updateSetting: (partial: Partial<AppSettings>) => void
  applySettings: (settings: AppSettings) => Promise<void>
}

// 设置页只负责组织控件，具体保存和系统能力同步交给 App 里的统一入口。
function SettingsView({ settings, labels, shortcutDraft, updateTheme, updateLanguage, updateSetting, applySettings }: SettingsViewProps) {
  return (
    <section className="settings-canvas no-drag">
      <SettingsSection title={labels.appearance}>
        <div className="theme-grid">
          <ThemeChoice label={labels.light} value="light" current={settings.theme} icon={<Sun size={20} />} onSelect={updateTheme} />
          <ThemeChoice label={labels.dark} value="dark" current={settings.theme} icon={<Moon size={20} />} onSelect={updateTheme} />
        </div>
      </SettingsSection>

      <SettingsSection title={labels.language}>
        <LanguageSetting labels={labels} value={settings.language ?? 'zh'} onChange={updateLanguage} />
      </SettingsSection>

      <SettingsSection title={labels.app}>
        <SettingToggle label={labels.hideDock} checked={settings.hideDock} onChange={(checked) => updateSetting({ hideDock: checked })} />
        <SettingToggle label={labels.windowAlwaysOnTop} checked={settings.alwaysOnTop} onChange={(checked) => updateSetting({ alwaysOnTop: checked })} />
        <SettingToggle label={labels.closeToTray} checked={settings.closeToTray} onChange={(checked) => updateSetting({ closeToTray: checked })} />
      </SettingsSection>

      <SettingsSection title={labels.keyboardShortcut}>
        <ShortcutSetting
          labels={labels}
          shortcut={shortcutDraft}
          onShortcutChange={(shortcut) => applySettings({ ...settings, globalShortcut: shortcut })}
        />
      </SettingsSection>
    </section>
  )
}

type ShortcutSettingProps = {
  labels: AppLabels
  shortcut: string
  onShortcutChange: (shortcut: string) => Promise<void>
}

// 快捷键设置在本地捕获键盘事件，再把合法组合键交给主进程注册。
function ShortcutSetting({ labels, shortcut, onShortcutChange }: ShortcutSettingProps) {
  const [isEditing, setIsEditing] = useState(false)
  const [captureError, setCaptureError] = useState('')
  const captureButtonRef = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    if (!isEditing) {
      return
    }

    setCaptureError('')
    window.requestAnimationFrame(() => captureButtonRef.current?.focus())
  }, [isEditing])

  // 录入按钮只负责捕获组合键，保存仍交给设置统一入口处理。
  const handleShortcutKeyDown = (event: React.KeyboardEvent<HTMLButtonElement>) => {
    event.preventDefault()
    event.stopPropagation()

    if (event.key === 'Escape') {
      setIsEditing(false)
      setCaptureError('')
      return
    }

    if (modifierOnlyKeys.has(event.key)) {
      return
    }

    const nextShortcut = buildShortcutFromEvent(event)
    if (!nextShortcut) {
      setCaptureError(labels.shortcutNeedModifier)
      return
    }

    setIsEditing(false)
    setCaptureError('')
    void onShortcutChange(nextShortcut)
  }

  return (
    <div className="shortcut-table">
      <div className="shortcut-table-head">
        <span>{labels.shortcutCommand}</span>
        <span>{labels.shortcutBinding}</span>
      </div>
      <div className="shortcut-row">
        <span className="shortcut-command-name">{labels.shortcutShowHide}</span>
        <div className="shortcut-controls">
          {isEditing ? (
            <>
              <button
                ref={captureButtonRef}
                className={`shortcut-recorder ${captureError ? 'error' : ''}`}
                type="button"
                onKeyDown={handleShortcutKeyDown}
              >
                {captureError || labels.shortcutListening}
              </button>
              <button className="shortcut-cancel" type="button" onClick={() => setIsEditing(false)}>
                {labels.cancel}
              </button>
            </>
          ) : (
            <>
              <button className="shortcut-pill" type="button" onClick={() => setIsEditing(true)}>
                {formatShortcut(shortcut) || labels.shortcutUnset}
              </button>
              <button className="shortcut-edit" type="button" title={labels.edit} onClick={() => setIsEditing(true)}>
                <Pencil size={15} />
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  )
}

type SettingsSectionProps = {
  title: string
  children: React.ReactNode
}

// 设置页区块统一外壳，确保不同设置组的间距和边框一致。
function SettingsSection({ title, children }: SettingsSectionProps) {
  return (
    <section className="settings-section">
      <h2>{title}</h2>
      <div className="settings-panel-card">{children}</div>
    </section>
  )
}

type ThemeChoiceProps = {
  label: string
  value: ThemeMode
  current: ThemeMode
  icon: React.ReactNode
  onSelect: (theme: ThemeMode) => void
}

// 主题选择项用预览缩略图表达结果，比单纯文字按钮更直观。
function ThemeChoice({ label, value, current, icon, onSelect }: ThemeChoiceProps) {
  return (
    <button className={`theme-choice ${current === value ? 'selected' : ''}`} onClick={() => onSelect(value)}>
      <div className="theme-preview">
        {icon}
        <span />
        <span />
        <span />
        {current === value && <Check size={18} />}
      </div>
      <strong>{label}</strong>
    </button>
  )
}

type LanguageSettingProps = {
  labels: AppLabels
  value: LanguageMode
  onChange: (language: LanguageMode) => void
}

// 语言切换只更新界面文案，不改动用户保存的 Note 内容。
function LanguageSetting({ labels, value, onChange }: LanguageSettingProps) {
  return (
    <div className="segmented-setting">
      <span>{labels.interfaceLanguage}</span>
      <div className="segmented-control">
        <button className={value === 'zh' ? 'active' : ''} onClick={() => onChange('zh')}>
          {labels.zh}
        </button>
        <button className={value === 'en' ? 'active' : ''} onClick={() => onChange('en')}>
          {labels.en}
        </button>
      </div>
    </div>
  )
}

type SettingToggleProps = {
  label: string
  checked: boolean
  onChange: (checked: boolean) => void
}

// 设置开关保持受控状态，点击后立刻走统一设置保存流程。
function SettingToggle({ label, checked, onChange }: SettingToggleProps) {
  return (
    <div className="setting-line">
      <span>{label}</span>
      <button className={`switch ${checked ? 'checked' : ''}`} role="switch" aria-checked={checked} onClick={() => onChange(!checked)}>
        <span />
      </button>
    </div>
  )
}

export default App
