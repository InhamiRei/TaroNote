import { useState, useEffect, useRef } from 'react'
import { Pencil } from 'lucide-react'
import type { AppLabels } from '../../i18n'
import { formatShortcut, modifierOnlyKeys, buildShortcutFromEvent } from '../../utils'

type ShortcutSettingProps = {
  labels: AppLabels
  shortcut: string
  onShortcutChange: (shortcut: string) => Promise<void>
}

// 快捷键设置在本地捕获键盘事件，再把合法组合键交给主进程注册。
export function ShortcutSetting({ labels, shortcut, onShortcutChange }: ShortcutSettingProps) {
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