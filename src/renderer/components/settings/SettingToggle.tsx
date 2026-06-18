type SettingToggleProps = {
  label: string
  checked: boolean
  onChange: (checked: boolean) => void
}

// 设置开关保持受控状态，点击后立刻走统一设置保存流程。
export function SettingToggle({ label, checked, onChange }: SettingToggleProps) {
  return (
    <div className="setting-line">
      <span>{label}</span>
      <button className={`switch ${checked ? 'checked' : ''}`} role="switch" aria-checked={checked} onClick={() => onChange(!checked)}>
        <span />
      </button>
    </div>
  )
}