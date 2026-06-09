<div align="center">
  <img src="./assets/app-icons/taronote.png" width="128" alt="TaroNote app icon" />
  <h1>TaroNote</h1>
  <p><strong>A floating macOS Note app for saving reusable phrases.</strong></p>
  <p>
    <a href="./README.md">简体中文</a>
    ·
    English
  </p>
  <p>
    <img alt="macOS" src="https://img.shields.io/badge/platform-macOS-111827?logo=apple&logoColor=white" />
    <img alt="Electron" src="https://img.shields.io/badge/Electron-33-47848F?logo=electron&logoColor=white" />
    <img alt="React" src="https://img.shields.io/badge/React-18-149ECA?logo=react&logoColor=white" />
    <img alt="TypeScript" src="https://img.shields.io/badge/TypeScript-5.7-3178C6?logo=typescript&logoColor=white" />
    <img alt="Vite" src="https://img.shields.io/badge/Vite-5.4-646CFF?logo=vite&logoColor=white" />
  </p>
</div>

## Development

```bash
nvm install
nvm use
```

Install dependencies and start the development environment:

```bash
npm install
npm start
```

## Build Check

```bash
npm run build
```

## Data Location

App data is saved at:

```text
~/Library/Application Support/TaroNote/data.json
```

The first version only saves plain-text notes that you maintain manually. It does not automatically record clipboard history or paste into other apps.
