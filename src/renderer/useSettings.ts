import { useEffect, useRef } from 'react'
import type { AppData, AppSettings, TaroNoteApi } from '../shared/types'
import { messages } from './i18n'
import type { AppLabels } from './i18n'
import { useStableCallback } from './hooks'
import { getErrorMessage } from './utils'

type UseSettingsOptions = {
  applySettingsRequest: TaroNoteApi['applySettings']
  data: AppData | null
  labels: AppLabels
  setData: (data: AppData) => void
  showToast: (message: string) => void
}

// 设置写入按触发顺序排队，避免连续点击不同开关时后一次请求基于旧 settings 覆盖前一次修改。
export const useSettings = ({ applySettingsRequest, data, labels, setData, showToast }: UseSettingsOptions) => {
  const desiredSettingsRef = useRef<AppSettings | null>(data?.settings ?? null)
  const appliedSettingsRef = useRef<AppSettings | null>(data?.settings ?? null)
  const pendingCountRef = useRef(0)
  const queueRef = useRef<Promise<void>>(Promise.resolve())

  useEffect(() => {
    appliedSettingsRef.current = data?.settings ?? null
    if (pendingCountRef.current === 0) {
      desiredSettingsRef.current = data?.settings ?? null
    }
  }, [data?.settings])

  // 每个请求都吞掉自身异常并恢复到最后一次成功设置，保证队列不会因单次 IPC 失败中断。
  const applySettings = useStableCallback((settings: AppSettings): Promise<void> => {
    desiredSettingsRef.current = settings
    pendingCountRef.current += 1

    const operation = queueRef.current.then(async () => {
      try {
        const response = await applySettingsRequest(settings)
        appliedSettingsRef.current = response.data.settings
        setData(response.data)

        const responseLabels = messages[response.data.settings.language]
        showToast(response.shortcut.message ?? responseLabels.updated)
      } catch (error) {
        showToast(labels.settingsFailed(getErrorMessage(error)))
      } finally {
        pendingCountRef.current -= 1
        if (pendingCountRef.current === 0) {
          desiredSettingsRef.current = appliedSettingsRef.current
        }
      }
    })

    queueRef.current = operation
    return operation
  })

  // 局部设置始终合并到“最新期望值”，即使前一次 IPC 还未返回也不会丢字段。
  const updateSetting = useStableCallback((partial: Partial<AppSettings>): Promise<void> => {
    const currentSettings = desiredSettingsRef.current ?? data?.settings
    if (!currentSettings) {
      return Promise.resolve()
    }

    return applySettings({ ...currentSettings, ...partial })
  })

  return { updateSetting }
}
