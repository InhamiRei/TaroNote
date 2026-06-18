import { useCallback, useEffect, useRef, useState } from 'react'
import type { Dispatch, SetStateAction } from 'react'
import type { AppData, FilterKey, NoteGroup, SaveDataPayload } from '../shared/types'
import type { AppLabels } from './i18n'
import { buildGroupFilter, categoryColorPalette, createId, getFilterGroupId } from './utils'

type UseCategoriesOptions = {
  activeFilter: FilterKey
  data: AppData | null
  labels: AppLabels
  onCategoryRemoved: (groupId: string, fallbackGroupId: string, deletedNotes: boolean) => void
  savePayload: (payload: SaveDataPayload) => Promise<AppData | null>
  setActiveFilter: Dispatch<SetStateAction<FilterKey>>
  showToast: (message: string) => void
}

// 分类 Hook 集中新建、改名、删除及其输入态，避免 App 同时维护多组分类 state。
export const useCategories = ({
  activeFilter,
  data,
  labels,
  onCategoryRemoved,
  savePayload,
  setActiveFilter,
  showToast
}: UseCategoriesOptions) => {
  const [categoryDraftOpen, setCategoryDraftOpen] = useState(false)
  const [categoryDraftName, setCategoryDraftName] = useState('')
  const [editingCategoryId, setEditingCategoryId] = useState('')
  const [editingCategoryName, setEditingCategoryName] = useState('')
  const categoryInputRef = useRef<HTMLInputElement>(null)
  const categoryEditInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (categoryDraftOpen) {
      categoryInputRef.current?.focus()
    }
  }, [categoryDraftOpen])

  useEffect(() => {
    if (editingCategoryId) {
      categoryEditInputRef.current?.focus()
      categoryEditInputRef.current?.select()
    }
  }, [editingCategoryId])

  // 打开新建分类时关闭改名输入，保证侧栏只有一个编辑态。
  const openCategoryDraft = useCallback(() => {
    setEditingCategoryId('')
    setEditingCategoryName('')
    setCategoryDraftOpen(true)
    setCategoryDraftName('')
  }, [])

  // 关闭新建分类时清空输入，避免下次打开残留旧草稿。
  const cancelCategoryDraft = useCallback(() => {
    setCategoryDraftOpen(false)
    setCategoryDraftName('')
  }, [])

  // 进入分类改名时关闭新建输入，并复制当前名称作为草稿。
  const openCategoryEdit = useCallback((group: NoteGroup) => {
    setCategoryDraftOpen(false)
    setCategoryDraftName('')
    setEditingCategoryId(group.id)
    setEditingCategoryName(group.name)
  }, [])

  // 退出分类改名时清理目标和输入内容。
  const cancelCategoryEdit = useCallback(() => {
    setEditingCategoryId('')
    setEditingCategoryName('')
  }, [])

  // 分类创建后立即切换过去，方便用户连续新建该分类下的 Note。
  const saveCategoryDraft = async () => {
    if (!data) return

    const name = categoryDraftName.trim()
    if (!name) {
      categoryInputRef.current?.focus()
      return
    }

    if (data.groups.some((group) => group.name.toLowerCase() === name.toLowerCase())) {
      showToast(labels.categoryExists)
      categoryInputRef.current?.focus()
      return
    }

    const group: NoteGroup = {
      id: createId(),
      name,
      color: categoryColorPalette[data.groups.length % categoryColorPalette.length],
      sortOrder: data.groups.length
    }

    if (!(await savePayload({ groups: [...data.groups, group] }))) {
      return
    }

    cancelCategoryDraft()
    setActiveFilter(buildGroupFilter(group.id))
    showToast(labels.categoryCreated)
  }

  // 分类改名只更新分类元数据，保留 Note 归属关系和排序。
  const saveCategoryEdit = async (group: NoteGroup) => {
    if (!data) return

    const name = editingCategoryName.trim()
    if (!name) {
      categoryEditInputRef.current?.focus()
      return
    }

    if (data.groups.some((item) => item.id !== group.id && item.name.toLowerCase() === name.toLowerCase())) {
      showToast(labels.categoryExists)
      categoryEditInputRef.current?.focus()
      return
    }

    if (name === group.name) {
      cancelCategoryEdit()
      return
    }

    if (
      !(await savePayload({
        groups: data.groups.map((item) => (item.id === group.id ? { ...item, name } : item))
      }))
    ) {
      return
    }

    cancelCategoryEdit()
    showToast(labels.categoryRenamed)
  }

  // 删除分类前确认其 Note 去向，保存成功后再同步筛选和草稿。
  const removeCategory = async (group: NoteGroup) => {
    if (!data || data.groups.length <= 1 || group.id === data.groups[0]?.id) return

    const fallbackGroup = data.groups.find((item) => item.id !== group.id) ?? data.groups[0]
    if (!fallbackGroup || !window.confirm(labels.deleteCategoryConfirm(group.name))) {
      return
    }

    const notesInGroup = data.notes.filter((note) => note.groupId === group.id)
    const shouldDeleteNotes = notesInGroup.length > 0 && window.confirm(labels.deleteCategoryNotesConfirm(notesInGroup.length))

    if (
      !(await savePayload({
        groups: data.groups.filter((item) => item.id !== group.id).map((item, index) => ({ ...item, sortOrder: index })),
        notes: shouldDeleteNotes
          ? data.notes.filter((note) => note.groupId !== group.id)
          : data.notes.map((note) => (note.groupId === group.id ? { ...note, groupId: fallbackGroup.id } : note))
      }))
    ) {
      return
    }

    if (getFilterGroupId(activeFilter) === group.id) {
      setActiveFilter(buildGroupFilter(fallbackGroup.id))
    }

    onCategoryRemoved(group.id, fallbackGroup.id, shouldDeleteNotes)
    showToast(labels.categoryDeleted)
  }

  return {
    cancelCategoryDraft,
    cancelCategoryEdit,
    categoryDraftName,
    categoryDraftOpen,
    categoryEditInputRef,
    categoryInputRef,
    editingCategoryId,
    editingCategoryName,
    openCategoryDraft,
    openCategoryEdit,
    removeCategory,
    saveCategoryDraft,
    saveCategoryEdit,
    setCategoryDraftName,
    setEditingCategoryName
  }
}
