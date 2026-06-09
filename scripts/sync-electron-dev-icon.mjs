import { execFileSync } from 'node:child_process'
import { copyFileSync, existsSync, utimesSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const appName = 'TaroNote'
const appAuthor = 'Taro'
const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const sourceIcon = path.join(projectRoot, 'assets/app-icons/taronote.icns')
const electronApp = path.join(projectRoot, 'node_modules/electron/dist/Electron.app')
const electronIcon = path.join(electronApp, 'Contents/Resources/electron.icns')
const electronPlist = path.join(electronApp, 'Contents/Info.plist')

// 写入开发态 Electron.app 的 Info.plist，让 Dock 气泡和关于面板显示真实应用名。
const setPlistValue = (key, value) => {
  if (!existsSync(electronPlist)) {
    return
  }

  execFileSync('/usr/bin/plutil', ['-replace', key, '-string', value, electronPlist])
}

// 同步开发态 Electron 壳的 bundle 图标和名称，避免启动阶段显示默认 Electron 信息。
const syncElectronDevBranding = () => {
  if (!existsSync(electronApp)) {
    return
  }

  if (existsSync(sourceIcon) && existsSync(electronIcon)) {
    copyFileSync(sourceIcon, electronIcon)

    const now = new Date()
    utimesSync(electronIcon, now, now)
  }

  setPlistValue('CFBundleDisplayName', appName)
  setPlistValue('CFBundleName', appName)
  setPlistValue('CFBundleIdentifier', 'com.taro.taronote')
  setPlistValue('NSHumanReadableCopyright', `Copyright © 2026 ${appAuthor}`)

  const now = new Date()
  utimesSync(electronApp, now, now)
}

syncElectronDevBranding()
