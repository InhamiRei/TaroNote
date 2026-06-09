import type { AppData, AppSettings, SaveDataPayload, TaroNoteApi } from '../shared/types'

const previewKey = 'taronote-preview-data-v8'

// 普通浏览器没有 Electron preload，这个 API 只服务开发期视觉预览。
export const getTaroNoteApi = (): TaroNoteApi => {
  if (window.taroNote) {
    return window.taroNote
  }

  if (!import.meta.env.DEV) {
    throw new Error('TaroNote preload API is unavailable.')
  }

  return createPreviewApi()
}

// 创建浏览器预览数据，保持字段结构和主进程持久化数据一致。
const createPreviewData = (): AppData => {
  return {
    schemaVersion: 1,
    groups: [
      {
        id: 'notes',
        name: '默认',
        color: '#dedede',
        sortOrder: 0
      }
    ],
    notes: [],
    settings: {
      hideDock: false,
      launchAtLogin: false,
      alwaysOnTop: true,
      globalShortcut: 'CommandOrControl+;',
      theme: 'light',
      language: 'zh',
      window: {
        width: 380,
        height: 560
      },
      closeToTray: true
    }
  }
}

// 读取 localStorage 里的预览数据；损坏数据直接回落到默认状态。
const readPreviewData = () => {
  const raw = window.localStorage.getItem(previewKey)
  if (!raw) {
    return createPreviewData()
  }

  try {
    return JSON.parse(raw) as AppData
  } catch {
    return createPreviewData()
  }
}

// 预览环境没有文件系统，所有状态临时写入浏览器 localStorage。
const writePreviewData = (data: AppData) => {
  window.localStorage.setItem(previewKey, JSON.stringify(data))
}

// 预览保存和主进程 store.update 保持同样的 settings 合并语义。
const mergePreviewPayload = (data: AppData, payload: SaveDataPayload): AppData => ({
  ...data,
  ...payload,
  settings: payload.settings ? { ...data.settings, ...payload.settings } : data.settings
})

// 开发预览 API 模拟 Electron IPC，让 renderer 能直接在浏览器里跑视觉调试。
const createPreviewApi = (): TaroNoteApi => ({
  getState: async () => {
    const data = readPreviewData()
    writePreviewData(data)
    return data
  },
  saveData: async (payload: SaveDataPayload) => {
    const data = mergePreviewPayload(readPreviewData(), payload)
    writePreviewData(data)
    return data
  },
  copyNote: async (noteId: string) => {
    const data = readPreviewData()
    const copiedAt = new Date().toISOString()
    const note = data.notes.find((item) => item.id === noteId)

    if (note) {
      await navigator.clipboard?.writeText(note.content).catch(() => undefined)
    }

    const nextData = {
      ...data,
      notes: data.notes.map((item) =>
        item.id === noteId
          ? {
              ...item,
              copyCount: item.copyCount + 1,
              lastCopiedAt: copiedAt,
              updatedAt: copiedAt
            }
          : item
      )
    }
    writePreviewData(nextData)
    return nextData
  },
  applySettings: async (settings: AppSettings) => {
    const data = {
      ...readPreviewData(),
      settings
    }
    writePreviewData(data)
    return {
      data,
      shortcut: {
        ok: true,
        shortcut: settings.globalShortcut
      }
    }
  },
  exportData: async () => ({ canceled: true, message: '浏览器预览不导出文件。' }),
  importData: async () => ({ result: { canceled: true, message: '浏览器预览不导入文件。' } }),
  hideWindow: async () => undefined,
  closeWindow: async () => undefined,
  minimizeWindow: async () => undefined,
  toggleMaximize: async () => undefined,
  onOpenSettings: () => () => undefined
})
