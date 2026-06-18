import { Sun, Moon } from 'lucide-react'
import type { AppSettings } from '../../../shared/types'
import type { AppLabels } from '../../i18n'
import { SettingsSection } from './SettingsSection'
import { ThemeChoice } from './ThemeChoice'
import { LanguageSetting } from './LanguageSetting'
import { SettingToggle } from './SettingToggle'
import { ShortcutSetting } from './ShortcutSetting'

type SettingsViewProps = {
  settings: AppSettings
  labels: AppLabels
  updateSetting: (partial: Partial<AppSettings>) => Promise<void>
}

// 设置页只负责组织控件，具体保存和系统能力同步交给统一设置 Hook。
export function SettingsView({ settings, labels, updateSetting }: SettingsViewProps) {
  return (
    <section className="settings-canvas no-drag">
      <SettingsSection title={labels.appearance}>
        <div className="theme-grid">
          <ThemeChoice
            label={labels.light}
            value="light"
            current={settings.theme}
            icon={<Sun size={20} />}
            onSelect={(theme) => void updateSetting({ theme })}
          />
          <ThemeChoice
            label={labels.dark}
            value="dark"
            current={settings.theme}
            icon={<Moon size={20} />}
            onSelect={(theme) => void updateSetting({ theme })}
          />
        </div>
      </SettingsSection>

      <SettingsSection title={labels.language}>
        <LanguageSetting labels={labels} value={settings.language ?? 'zh'} onChange={(language) => void updateSetting({ language })} />
      </SettingsSection>

      <SettingsSection title={labels.app}>
        <SettingToggle label={labels.hideDock} checked={settings.hideDock} onChange={(checked) => void updateSetting({ hideDock: checked })} />
        <SettingToggle
          label={labels.windowAlwaysOnTop}
          checked={settings.alwaysOnTop}
          onChange={(checked) => void updateSetting({ alwaysOnTop: checked })}
        />
        <SettingToggle
          label={labels.closeToTray}
          checked={settings.closeToTray}
          onChange={(checked) => void updateSetting({ closeToTray: checked })}
        />
      </SettingsSection>

      <SettingsSection title={labels.keyboardShortcut}>
        <ShortcutSetting
          labels={labels}
          shortcut={settings.globalShortcut}
          onShortcutChange={(globalShortcut) => updateSetting({ globalShortcut })}
        />
      </SettingsSection>
    </section>
  )
}
