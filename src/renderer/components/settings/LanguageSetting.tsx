import type { LanguageMode } from '../../../shared/types';
import type { AppLabels } from '../../i18n';

type LanguageSettingProps = {
  labels: AppLabels;
  value: LanguageMode;
  onChange: (language: LanguageMode) => void;
};

// 语言切换只更新界面文案，不改动用户保存的 Note 内容。
export function LanguageSetting({ labels, value, onChange }: LanguageSettingProps) {
  return (
    <div className="segmented-setting">
      <span>{labels.interfaceLanguage}</span>
      <div className="segmented-control">
        <button className={value === 'zh' ? 'active' : ''} onClick={() => onChange('zh')}>
          {labels.zh}
        </button>
        <button className={value === 'en' ? 'active' : ''} onClick={() => onChange('en')}>
          {labels.en}
        </button>
      </div>
    </div>
  );
}
