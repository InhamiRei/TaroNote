# TaroNote

TaroNote 是一个 macOS Note 悬浮应用，用来保存常用客户回复，随时搜索并一键复制。

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

## 数据位置

应用数据保存在：

```text
~/Library/Application Support/TaroNote/data.json
```

第一版只保存手动维护的纯文本 Note，不会自动记录剪贴板历史，也不会自动粘贴到其他应用。
