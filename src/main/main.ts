import { app, BrowserWindow, clipboard, dialog, globalShortcut, ipcMain, Menu, nativeImage, Tray } from 'electron'
import type { OpenDialogOptions, SaveDialogOptions } from 'electron'
import { existsSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import type { AppSettings, SaveDataPayload, ShortcutResult } from '../shared/types'
import { getDataPath, TaroNoteStore } from './store'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const APP_NAME = 'TaroNote'
const APP_AUTHOR = 'Taro'
const APP_COPYRIGHT = `Copyright © 2026 ${APP_AUTHOR}`

app.setName(APP_NAME)

let mainWindow: BrowserWindow | undefined
let tray: Tray | undefined
let store: TaroNoteStore
let isQuitting = false
let activeShortcut = ''
let boundsSaveTimer: NodeJS.Timeout | undefined

// Dock 和窗口图标优先使用项目里的 PNG；打包后则回退到 app 资源目录里的 icns。
const createAppIcon = () => {
  const iconPaths = [
    path.resolve(__dirname, '../../assets/app-icons/taronote.png'),
    path.resolve(process.cwd(), 'assets/app-icons/taronote.png'),
    path.join(process.resourcesPath, 'icon.icns')
  ]
  const iconPath = iconPaths.find((candidate) => existsSync(candidate))

  return iconPath ? nativeImage.createFromPath(iconPath) : nativeImage.createEmpty()
}

// 用内联 SVG 创建菜单栏图标，避免第一版额外维护二进制资源。
const createTrayIcon = () => {
  const svg = encodeURIComponent(`
    <svg width="22" height="22" viewBox="0 0 22 22" xmlns="http://www.w3.org/2000/svg">
      <rect x="5" y="4" width="12" height="14" rx="3" fill="black"/>
      <rect x="8" y="8" width="6" height="1.5" rx=".75" fill="white"/>
      <rect x="8" y="11" width="5" height="1.5" rx=".75" fill="white"/>
    </svg>
  `)
  const image = nativeImage.createFromDataURL(`data:image/svg+xml;charset=utf-8,${svg}`)
  image.setTemplateImage(true)
  return image
}

// macOS 切换 Dock 显示或置顶层级后可能把焦点交出去，这里把可见窗口重新激活。
const refocusVisibleMainWindowSoon = () => {
  if (!mainWindow || !mainWindow.isVisible()) {
    return
  }

  setTimeout(() => {
    if (!mainWindow || mainWindow.isDestroyed() || !mainWindow.isVisible()) {
      return
    }

    if (process.platform === 'darwin') {
      app.focus({ steal: true })
    }

    mainWindow.focus()
  }, 60)
}

const focusMainWindow = () => {
  if (!mainWindow) {
    return
  }

  if (process.platform === 'darwin') {
    app.focus({ steal: true })
  }

  mainWindow.show()
  mainWindow.focus()
}

// 根据设置即时控制 Dock、置顶层级和开机启动。
const applyRuntimeSettings = (settings: AppSettings) => {
  if (mainWindow) {
    mainWindow.setAlwaysOnTop(settings.alwaysOnTop, 'floating')
    mainWindow.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true })
  }

  if (process.platform === 'darwin') {
    if (settings.hideDock) {
      app.dock.hide()
    } else {
      app.dock.show()
    }
  }

  if (settings.launchAtLogin || app.getLoginItemSettings().openAtLogin) {
    app.setLoginItemSettings({
      openAtLogin: settings.launchAtLogin,
      path: app.getPath('exe')
    })
  }

  refocusVisibleMainWindowSoon()
}

// 注册全局快捷键；失败时恢复旧快捷键，避免用户失去唤起入口。
const registerGlobalShortcut = (shortcut: string, fallbackShortcut?: string): ShortcutResult => {
  if (activeShortcut) {
    globalShortcut.unregister(activeShortcut)
    activeShortcut = ''
  }

  const ok = globalShortcut.register(shortcut, toggleMainWindow)
  if (ok) {
    activeShortcut = shortcut
    return { ok: true, shortcut }
  }

  if (fallbackShortcut && fallbackShortcut !== shortcut) {
    const restored = globalShortcut.register(fallbackShortcut, toggleMainWindow)
    if (restored) {
      activeShortcut = fallbackShortcut
    }
  }

  return {
    ok: false,
    shortcut,
    message: `快捷键 ${shortcut} 注册失败，可能已被其他应用占用。`
  }
}

// 将当前窗口位置写回设置，保证下次启动回到用户熟悉的位置。
const scheduleWindowBoundsSave = () => {
  if (!mainWindow || !store) {
    return
  }

  if (boundsSaveTimer) {
    clearTimeout(boundsSaveTimer)
  }

  boundsSaveTimer = setTimeout(() => {
    boundsSaveTimer = undefined

    if (!mainWindow) {
      return
    }

    const bounds = mainWindow.getBounds()
    const data = store.get()
    store.update({
      settings: {
        ...data.settings,
        window: bounds
      }
    })
  }, 300)
}

// 悬浮窗保持轻量、无标题栏、可置顶，视觉由渲染进程负责。
const createMainWindow = () => {
  const settings = store.get().settings
  const { window } = settings

  mainWindow = new BrowserWindow({
    x: window.x,
    y: window.y,
    width: window.width,
    height: window.height,
    minWidth: 1000,
    minHeight: 620,
    frame: false,
    transparent: true,
    show: false,
    resizable: true,
    alwaysOnTop: settings.alwaysOnTop,
    backgroundColor: '#00000000',
    title: APP_NAME,
    icon: createAppIcon(),
    trafficLightPosition: { x: 14, y: 14 },
    webPreferences: {
      preload: path.join(__dirname, '../preload/index.mjs'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false
    }
  })

  mainWindow.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true })

  mainWindow.on('ready-to-show', () => {
    focusMainWindow()
  })

  mainWindow.on('move', scheduleWindowBoundsSave)
  mainWindow.on('resize', scheduleWindowBoundsSave)

  mainWindow.on('close', (event) => {
    const settings = store.get().settings
    if (!isQuitting && settings.closeToTray) {
      event.preventDefault()
      mainWindow?.hide()
      return
    }

    if (!isQuitting) {
      isQuitting = true
      app.quit()
    }
  })

  if (process.env.ELECTRON_RENDERER_URL) {
    mainWindow.loadURL(process.env.ELECTRON_RENDERER_URL)
  } else {
    mainWindow.loadFile(path.join(__dirname, '../renderer/index.html'))
  }
}

// 托盘菜单提供隐藏模式下的入口，也承载退出动作。
const createTray = () => {
  tray = new Tray(createTrayIcon())
  tray.setToolTip(APP_NAME)

  const openSettings = () => {
    showMainWindow()
    mainWindow?.webContents.send('ui:open-settings')
  }

  const contextMenu = Menu.buildFromTemplate([
    {
      label: `显示/隐藏 ${APP_NAME}`,
      click: toggleMainWindow
    },
    {
      label: '设置',
      click: openSettings
    },
    { type: 'separator' },
    {
      label: '退出',
      click: () => {
        isQuitting = true
        app.quit()
      }
    }
  ])

  tray.setContextMenu(contextMenu)
  tray.on('click', toggleMainWindow)
}

// 确保窗口存在并获得焦点，供托盘、Dock 激活和快捷键共同复用。
const showMainWindow = () => {
  if (!mainWindow) {
    createMainWindow()
  }

  focusMainWindow()
}

// 全局快捷键和托盘点击共用同一套显示/隐藏逻辑。
function toggleMainWindow() {
  if (!mainWindow) {
    createMainWindow()
    return
  }

  if (mainWindow.isVisible() && mainWindow.isFocused()) {
    mainWindow.hide()
  } else {
    showMainWindow()
  }
}

// 红色关闭按钮遵守“关闭时留在菜单栏”设置；关闭该设置时直接退出应用。
const closeMainWindow = () => {
  if (!mainWindow) {
    return
  }

  if (store.get().settings.closeToTray) {
    mainWindow.hide()
    return
  }

  isQuitting = true
  app.quit()
}

// IPC 是渲染进程和系统能力之间的边界，所有文件和剪贴板操作留在主进程。
const registerIpcHandlers = () => {
  ipcMain.handle('data:get', () => store.get())

  ipcMain.handle('data:save', (_event, payload: SaveDataPayload) => {
    return store.update(payload)
  })

  ipcMain.handle('notes:copy', (_event, noteId: string) => {
    const data = store.get()
    const note = data.notes.find((item) => item.id === noteId)
    if (!note) {
      return data
    }

    clipboard.writeText(note.content)
    return store.markCopied(noteId) ?? store.get()
  })

  ipcMain.handle('settings:apply', (_event, settings: AppSettings) => {
    const previousShortcut = store.get().settings.globalShortcut
    const data = store.update({ settings })
    const shortcut = registerGlobalShortcut(data.settings.globalShortcut, previousShortcut)

    if (!shortcut.ok) {
      const restored = store.update({
        settings: {
          ...data.settings,
          globalShortcut: previousShortcut
        }
      })
      applyRuntimeSettings(restored.settings)
      return { data: restored, shortcut }
    }

    applyRuntimeSettings(data.settings)
    return { data: store.get(), shortcut }
  })

  ipcMain.handle('dialog:export', async () => {
    const options: SaveDialogOptions = {
      title: `导出 ${APP_NAME} 备份`,
      defaultPath: `${APP_NAME}-backup.json`,
      filters: [{ name: 'JSON', extensions: ['json'] }]
    }
    const result = mainWindow ? await dialog.showSaveDialog(mainWindow, options) : await dialog.showSaveDialog(options)

    if (result.canceled || !result.filePath) {
      return { canceled: true }
    }

    store.exportTo(result.filePath)
    return { canceled: false, filePath: result.filePath }
  })

  ipcMain.handle('dialog:import', async () => {
    const options: OpenDialogOptions = {
      title: `导入 ${APP_NAME} 备份`,
      properties: ['openFile'],
      filters: [{ name: 'JSON', extensions: ['json'] }]
    }
    const result = mainWindow ? await dialog.showOpenDialog(mainWindow, options) : await dialog.showOpenDialog(options)

    if (result.canceled || !result.filePaths[0]) {
      return { result: { canceled: true } }
    }

    try {
      const data = store.importFrom(result.filePaths[0])
      applyRuntimeSettings(data.settings)
      const shortcut = registerGlobalShortcut(data.settings.globalShortcut)
      return {
        data,
        result: {
          canceled: false,
          filePath: result.filePaths[0],
          message: shortcut.ok ? undefined : shortcut.message
        }
      }
    } catch {
      return {
        result: {
          canceled: false,
          filePath: result.filePaths[0],
          message: `导入失败，请确认文件是有效的 ${APP_NAME} JSON 备份。`
        }
      }
    }
  })

  ipcMain.handle('window:hide', () => {
    mainWindow?.hide()
  })

  ipcMain.handle('window:close', () => {
    closeMainWindow()
  })

  ipcMain.handle('window:minimize', () => {
    mainWindow?.minimize()
  })

  // 绿色窗控按钮使用系统最大化/还原能力，保持和 mac 窗口操作一致。
  ipcMain.handle('window:toggle-maximize', () => {
    if (!mainWindow) {
      return
    }

    if (mainWindow.isMaximized()) {
      mainWindow.unmaximize()
    } else {
      mainWindow.maximize()
    }
  })
}

app.whenReady().then(() => {
  // 设置 macOS 关于面板的应用名和开发作者，避免开发态继续显示 Electron 默认信息。
  app.setAboutPanelOptions({
    applicationName: APP_NAME,
    applicationVersion: app.getVersion(),
    authors: [APP_AUTHOR],
    copyright: APP_COPYRIGHT
  })

  if (process.platform === 'darwin') {
    app.dock.setIcon(createAppIcon())
  }

  store = new TaroNoteStore(getDataPath(app.getPath('userData')))
  registerIpcHandlers()
  createMainWindow()
  createTray()
  applyRuntimeSettings(store.get().settings)
  registerGlobalShortcut(store.get().settings.globalShortcut)

  app.on('activate', () => {
    showMainWindow()
  })
})

app.on('before-quit', () => {
  isQuitting = true
})

app.on('will-quit', () => {
  globalShortcut.unregisterAll()
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})
