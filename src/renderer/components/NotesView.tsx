import { useState, useCallback } from 'react'
import type { LanguageMode, NoteGroup, NoteItem } from '../../shared/types'
import type { RefObject } from 'react'
import type { AppLabels } from '../i18n'
import type { DropPosition } from '../utils'
import { NoteCard } from './NoteCard'

export type NotesViewProps = {
  notes: NoteItem[]
  groupsById: ReadonlyMap<string, NoteGroup>
  selectedIndex: number
  labels: AppLabels
  language: LanguageMode
  canvasRef: RefObject<HTMLElement>
  emptyText: string
  onCopy: (note: NoteItem) => Promise<void>
  onEdit: (note: NoteItem) => void
  onDelete: (note: NoteItem) => Promise<void>
  onTogglePinned: (note: NoteItem) => Promise<void>
  onReorder: (fromId: string, toId: string, position: DropPosition) => Promise<void>
}

// Note 列表视图只负责渲染和派发操作，具体数据修改留给上层 App。
export function NotesView({ notes, groupsById, selectedIndex, labels, language, canvasRef, emptyText, onCopy, onEdit, onDelete, onTogglePinned, onReorder }: NotesViewProps) {
  const [dragNoteId, setDragNoteId] = useState<string | null>(null)
  const [dropTarget, setDropTarget] = useState<{ id: string; position: DropPosition } | null>(null)

  const handleDragStart = useCallback((noteId: string) => {
    setDragNoteId(noteId)
  }, [])

  const handleDragOver = useCallback(
    (event: React.DragEvent, noteId: string) => {
      if (!dragNoteId || dragNoteId === noteId) return
      const rect = (event.currentTarget as HTMLElement).getBoundingClientRect()
      const midY = rect.top + rect.height / 2
      const position = event.clientY < midY ? 'above' : 'below'
      setDropTarget((current) => (current?.id === noteId && current.position === position ? current : { id: noteId, position }))
    },
    [dragNoteId]
  )

  const handleDragLeave = useCallback(() => {
    setDropTarget(null)
  }, [])

  const handleDrop = useCallback((targetId: string, position: DropPosition) => {
    if (!dragNoteId || dragNoteId === targetId) return
    void onReorder(dragNoteId, targetId, position)
    setDragNoteId(null)
    setDropTarget(null)
  }, [dragNoteId, onReorder])

  const handleDragEnd = useCallback(() => {
    setDragNoteId(null)
    setDropTarget(null)
  }, [])

  return (
    <section className="notes-canvas no-drag" ref={canvasRef}>
      <div className="notes-stack">
        {notes.map((note, index) => {
          const group = groupsById.get(note.groupId)
          const isDragOver = dropTarget?.id === note.id ? dropTarget.position : null

          return (
            <NoteCard
              key={note.id}
              note={note}
              group={group}
              isSelected={index === selectedIndex}
              isDragOver={isDragOver}
              isDragging={dragNoteId === note.id}
              labels={labels}
              language={language}
              onCopy={onCopy}
              onEdit={onEdit}
              onDelete={onDelete}
              onTogglePinned={onTogglePinned}
              onDragStart={handleDragStart}
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
              onDragEnd={handleDragEnd}
            />
          )
        })}

        {!notes.length && <div className="empty-state">{emptyText}</div>}
      </div>
    </section>
  )
}
