import type { ThemeMode } from '../../../shared/types'

type ThemeChoiceProps = {
  label: string
  value: ThemeMode
  current: ThemeMode
  icon: React.ReactNode
  onSelect: (theme: ThemeMode) => void
}

// 主题选择项用预览缩略图表达结果，比单纯文字按钮更直观。
export function ThemeChoice({ label, value, current, icon, onSelect }: ThemeChoiceProps) {
  return (
    <button className={`theme-choice ${current === value ? 'selected' : ''}`} onClick={() => onSelect(value)}>
      <div className="theme-preview">
        {icon}
        <span />
        <span />
        <span />
        {current === value && <span className="theme-check-icon">✓</span>}
      </div>
      <strong>{label}</strong>
    </button>
  )
}