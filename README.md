<div align="center">
  <img src="./assets/app-icons/taronote.png" width="128" alt="TaroNote 应用图标" />
  <h1>TaroNote</h1>
  <p><strong>一个悬浮 Note 应用，用来保存常用短语，支持 macOS 与 Windows。</strong></p>
  <p>
    简体中文
    ·
    <a href="./README.en.md">English</a>
  </p>
  <p>
    <img alt="macOS" src="https://img.shields.io/badge/platform-macOS-111827?logo=apple&logoColor=white" />
    <img alt="Windows" src="https://img.shields.io/badge/platform-Windows-111827?logo=windows11&logoColor=white" />
    <img alt="Electron" src="https://img.shields.io/badge/Electron-33-47848F?logo=electron&logoColor=white" />
    <img alt="React" src="https://img.shields.io/badge/React-18-149ECA?logo=react&logoColor=white" />
    <img alt="TypeScript" src="https://img.shields.io/badge/TypeScript-5.7-3178C6?logo=typescript&logoColor=white" />
    <img alt="Vite" src="https://img.shields.io/badge/Vite-5.4-646CFF?logo=vite&logoColor=white" />
  </p>
</div>

## 开发运行

```bash
nvm install
nvm use
```

安装依赖并启动开发环境：

```bash
npm install
npm start
```

## 构建检查

```bash
npm run build
```

## 打包发布

按目标平台分别打包：

```bash
npm run dist:mac   # 只打 macOS dmg/zip
npm run dist:win   # 只打 Windows x64 exe
npm run dist:all   # 同时打两端（macOS + Windows）
```

产物在 `release/` 目录：`TaroNote-<version>-arm64.dmg`（macOS）、`TaroNote-<version>-x64.exe`（Windows 安装包，未签名，首次运行 Windows 会弹 SmartScreen 警告，点“仍要运行”即可）。

## 数据位置

应用数据保存在：

- macOS：`~/Library/Application Support/TaroNote/data.json`
- Windows：`%APPDATA%\TaroNote\data.json`

第一版只保存手动维护的纯文本 Note，不会自动记录剪贴板历史，也不会自动粘贴到其他应用。
