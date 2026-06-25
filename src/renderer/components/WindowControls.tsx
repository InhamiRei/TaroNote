import { Copy, Minus, Square, X } from 'lucide-react'
import type { AppLabels } from '../i18n'
import { getTaroNoteApi } from '../previewApi'

const taroNoteApi = getTaroNoteApi()

type WindowControlsProps = {
  labels: AppLabels
  maximized: boolean
}

// Windows 窗控按钮沿用 toolbar-button 样式（28px、同款 hover），与搜索/新建按钮视觉一致；
// 外层 win-controls 用 display:contents，让三个按钮直接参与 top-actions 的 flex 间距。
export function WindowControls({ labels, maximized }: WindowControlsProps) {
  return (
    <div className="win-controls">
      <button className="toolbar-button" aria-label={labels.windowMinimize} onClick={() => void taroNoteApi.minimizeWindow()}>
        <Minus size={16} strokeWidth={2} />
      </button>
      <button className="toolbar-button" aria-label={labels.toggleMaximize} onClick={() => void taroNoteApi.toggleMaximize()}>
        {maximized ? <Copy size={14} strokeWidth={2} /> : <Square size={14} strokeWidth={2} />}
      </button>
      <button className="toolbar-button" aria-label={labels.windowClose} onClick={() => void taroNoteApi.closeWindow()}>
        <X size={16} strokeWidth={2} />
      </button>
    </div>
  )
}
