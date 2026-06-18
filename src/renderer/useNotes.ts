import { useRef, useState } from 'react'
import type { Dispatch, SetStateAction } from 'react'
import type { AppData, FilterKey, LanguageMode, NoteItem, SaveDataPayload, TaroNoteApi } from '../shared/types'
import { DEFAULT_GROUP_ID, makeTitle } from '../shared/types'
import type { AppLabels } from './i18n'
import type { DropPosition } from './utils'
import { createId, getDropTargetIndex, getErrorMessage, moveArrayItem, sortNotesByActivity } from './utils'

export type NoteDraft = {
  id?: string
  content: string
  groupId: string
  favorite: boolean
}

type UseNotesOptions = {
  activeFilter: FilterKey
  activeGroupId: string
  data: AppData | null
  labels: AppLabels
  language: LanguageMode
  savePayload: (payload: SaveDataPayload) => Promise<AppData | null>
  setData: (data: AppData) => void
  setSelectedIndex: Dispatch<SetStateAction<number>>
  showToast: (message: string) => void
  copyNoteRequest: TaroNoteApi['copyNote']
}

// Note Hook 集中新建、编辑、复制、删除和排序逻辑，App 只负责连接视图与分类编辑态。
export const useNotes = ({
  activeFilter,
  activeGroupId,
  copyNoteRequest,
  data,
  labels,
  language,
  savePayload,
  setData,
  setSelectedIndex,
  showToast
}: UseNotesOptions) => {
  const [draft, setDraft] = useState<NoteDraft | null>(null)
  const notesCanvasRef = useRef<HTMLElement>(null)

  // 点击 Note 只复制正文，并把复制次数、最后复制时间交给主进程更新。
  const copyNote = async (note: NoteItem) => {
    try {
      const nextData = await copyNoteRequest(note.id)
      setData(nextData)
      showToast(labels.copied)
    } catch (error) {
      showToast(labels.copyFailed(getErrorMessage(error)))
    }
  }

  // 置顶状态复用 favorite 字段，不更新 updatedAt，避免卡片排序抖动。
  const togglePinned = async (note: NoteItem) => {
    if (!data) return

    if (
      !(await savePayload({
        notes: data.notes.map((item) => (item.id === note.id ? { ...item, favorite: !item.favorite } : item))
      }))
    ) {
      return
    }

    showToast(note.favorite ? labels.unpinnedToast : labels.pinnedToast)
  }

  // 新建 Note 优先继承当前分类筛选，在置顶视图中新建时默认置顶。
  const openNewNote = () => {
    const defaultGroupId = data?.groups[0]?.id ?? DEFAULT_GROUP_ID
    const groupId = activeGroupId && data?.groups.some((group) => group.id === activeGroupId) ? activeGroupId : defaultGroupId
    setDraft({ content: '', groupId, favorite: activeFilter === 'pinned' })
  }

  // 编辑 Note 时复制为独立草稿，保存前不直接修改列表数据。
  const openEditNote = (note: NoteItem) => {
    setDraft({
      id: note.id,
      content: note.content,
      groupId: note.groupId,
      favorite: note.favorite
    })
  }

  // 保存新 Note 后回到列表顶部，让刚创建的卡片立即可见。
  const scrollNotesToTop = () => {
    window.requestAnimationFrame(() => {
      notesCanvasRef.current?.scrollTo({ top: 0, behavior: 'smooth' })
    })
  }

  // 新建和编辑共用保存入口，IPC 失败时保留草稿供用户重试。
  const saveDraft = async () => {
    if (!data || !draft) return

    const content = draft.content.trim()
    if (!content) {
      showToast(labels.contentRequired)
      return
    }

    const updatedAt = new Date().toISOString()
    const title = makeTitle(content, language)
    const groupId = data.groups.some((group) => group.id === draft.groupId) ? draft.groupId : data.groups[0]?.id ?? DEFAULT_GROUP_ID

    const savedData = draft.id
      ? await savePayload({
          notes: data.notes.map((note) =>
            note.id === draft.id ? { ...note, title, content, groupId, favorite: draft.favorite, updatedAt } : note
          )
        })
      : await savePayload({
          notes: [
            {
              id: createId(),
              title,
              content,
              groupId,
              favorite: draft.favorite,
              createdAt: updatedAt,
              updatedAt,
              copyCount: 0
            },
            ...data.notes
          ]
        })

    if (!savedData) {
      return
    }

    setDraft(null)
    setSelectedIndex(0)
    scrollNotesToTop()
    showToast(labels.saved)
  }

  // 删除前进行二次确认，避免快捷键或误点直接清掉常用 Note。
  const removeNote = async (note: NoteItem) => {
    if (!data || !window.confirm(labels.deleteConfirm(makeTitle(note.content, language)))) {
      return
    }

    if (!(await savePayload({ notes: data.notes.filter((item) => item.id !== note.id) }))) {
      return
    }

    setDraft((current) => (current?.id === note.id ? null : current))
    showToast(labels.deleted)
  }

  // 拖动排序使用纯函数移动元素，再统一刷新所有 sortOrder。
  const reorderNotes = async (fromId: string, toId: string, position: DropPosition) => {
    if (!data || fromId === toId) return

    const sortedNotes = sortNotesByActivity(data.notes)
    const fromIndex = sortedNotes.findIndex((note) => note.id === fromId)
    const toIndex = sortedNotes.findIndex((note) => note.id === toId)
    if (fromIndex === -1 || toIndex === -1) return

    // 目标索引需要扣除源元素移除后的位移，确保指示线显示“上方/下方”时实际结果一致。
    const targetIndex = getDropTargetIndex(fromIndex, toIndex, position)
    const movedNotes = moveArrayItem(sortedNotes, fromIndex, targetIndex)
    const orderById = new Map<string, number>()
    movedNotes.forEach((note, index) => orderById.set(note.id, index))

    await savePayload({
      notes: data.notes.map((note) => ({
        ...note,
        sortOrder: orderById.get(note.id) ?? 0
      }))
    })
  }

  return {
    copyNote,
    draft,
    notesCanvasRef,
    openEditNote,
    openNewNote,
    removeNote,
    reorderNotes,
    saveDraft,
    setDraft,
    togglePinned
  }
}
