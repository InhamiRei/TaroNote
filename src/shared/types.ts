export type ThemeMode = 'light' | 'dark'

export type LanguageMode = 'zh' | 'en'

export type FilterKey = 'all' | 'pinned' | `group:${string}`

export type NoteGroup = {
  id: string
  name: string
  color: string
  sortOrder: number
}

export type NoteItem = {
  id: string
  title: string
  content: string
  groupId: string
  favorite: boolean
  createdAt: string
  updatedAt: string
  copyCount: number
  lastCopiedAt?: string
}

export type AppSettings = {
  hideDock: boolean
  launchAtLogin: boolean
  alwaysOnTop: boolean
  globalShortcut: string
  theme: ThemeMode
  language: LanguageMode
  window: {
    x?: number
    y?: number
    width: number
    height: number
  }
  closeToTray: boolean
}

export type AppData = {
  schemaVersion: 1
  groups: NoteGroup[]
  notes: NoteItem[]
  settings: AppSettings
}

export type SaveDataPayload = Partial<Pick<AppData, 'groups' | 'notes' | 'settings'>>

export type ShortcutResult = {
  ok: boolean
  shortcut: string
  message?: string
}

export type DialogResult = {
  canceled: boolean
  filePath?: string
  message?: string
}

export type TaroNoteApi = {
  getState: () => Promise<AppData>
  saveData: (payload: SaveDataPayload) => Promise<AppData>
  copyNote: (noteId: string) => Promise<AppData>
  applySettings: (settings: AppSettings) => Promise<{ data: AppData; shortcut: ShortcutResult }>
  exportData: () => Promise<DialogResult>
  importData: () => Promise<{ data?: AppData; result: DialogResult }>
  hideWindow: () => Promise<void>
  closeWindow: () => Promise<void>
  minimizeWindow: () => Promise<void>
  toggleMaximize: () => Promise<void>
  onOpenSettings: (callback: () => void) => () => void
}
