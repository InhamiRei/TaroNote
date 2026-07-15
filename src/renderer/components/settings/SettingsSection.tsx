import type { ReactNode } from 'react';

type SettingsSectionProps = {
  title: string;
  children: ReactNode;
};

// 设置页区块统一外壳，确保不同设置组的间距和边框一致。
export function SettingsSection({ title, children }: SettingsSectionProps) {
  return (
    <section className="settings-section">
      <h2>{title}</h2>
      <div className="settings-panel-card">{children}</div>
    </section>
  );
}
