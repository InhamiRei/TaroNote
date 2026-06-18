import { memo } from 'react'
import { Pin, Pencil, Trash2 } from 'lucide-react'
import type { LanguageMode, NoteGroup, NoteItem } from '../../shared/types'
import type { AppLabels } from '../i18n'
import type { DropPosition } from '../utils'
import { formatDateLabel } from '../utils'

export type NoteCardProps = {
  note: NoteItem
  group?: NoteGroup
  isSelected: boolean
  isDragOver: DropPosition | null
  isDragging: boolean
  labels: AppLabels
  language: LanguageMode
  onCopy: (note: NoteItem) => Promise<void>
  onEdit: (note: NoteItem) => void
  onDelete: (note: NoteItem) => Promise<void>
  onTogglePinned: (note: NoteItem) => Promise<void>
  onDragStart: (noteId: string) => void
  onDragOver: (event: React.DragEvent, noteId: string) => void
  onDragLeave: () => void
  onDrop: (noteId: string, position: DropPosition) => void
  onDragEnd: () => void
}

// 卡片操作按钮统一阻止事件冒泡，避免点击置顶、编辑或删除时触发卡片复制。
const stopCardAction =
  (action: () => void | Promise<void>) =>
  (event: React.MouseEvent<HTMLButtonElement>) => {
    event.stopPropagation()
    void action()
  }

// Note 卡片拆成 memo 组件，键盘选择或搜索输入时避免 1000 条列表全部重新渲染。
export const NoteCard = memo(function NoteCard({
  note, group, isSelected, isDragOver, isDragging, labels, language,
  onCopy, onEdit, onDelete, onTogglePinned,
  onDragStart, onDragOver, onDragLeave, onDrop, onDragEnd
}: NoteCardProps) {
  // 卡片左上角只显示编辑时间，复制不影响显示。
  const noteDateLabel = formatDateLabel(note.updatedAt || note.createdAt, language)

  const dragOverClass = isDragOver === 'above' ? 'drop-above' : isDragOver === 'below' ? 'drop-below' : ''

  return (
    <article
      className={`note-card ${isSelected ? 'selected' : ''} ${note.favorite ? 'pinned' : ''} ${isDragging ? 'dragging' : ''} ${dragOverClass}`}
      draggable
      onDragStart={(event) => {
        event.dataTransfer.effectAllowed = 'move'
        event.dataTransfer.setData('text/plain', note.id)
        onDragStart(note.id)
      }}
      onDragOver={(event) => {
        event.preventDefault()
        event.dataTransfer.dropEffect = 'move'
        onDragOver(event, note.id)
      }}
      onDragLeave={onDragLeave}
      onDrop={(event) => {
        event.preventDefault()
        if (isDragOver) {
          onDrop(note.id, isDragOver)
        }
      }}
      onDragEnd={onDragEnd}
      onClick={() => void onCopy(note)}
    >
      <div className="note-date-row">
        <div className="note-date" title={noteDateLabel}>
          {noteDateLabel}
        </div>
      </div>
      <div className="note-text" title={note.content}>
        {note.content}
      </div>
      <div className="note-footer">
        <div className="note-footer-left">
          {group && (
            <span className="note-category-badge" title={group.name}>
              <span style={{ backgroundColor: group.color }} />
              {group.name}
            </span>
          )}
          {note.favorite && (
            <span className="pin-badge">
              <Pin size={13} fill="currentColor" />
              {labels.pinned}
            </span>
          )}
        </div>
        <div className="note-footer-right">
          <span className="copy-count">{labels.copyCountText(note.copyCount)}</span>
        </div>
      </div>
      <div className="card-actions">
        <button
          className={note.favorite ? 'active' : ''}
          title={note.favorite ? labels.unpinNote : labels.pinNote}
          onClick={stopCardAction(() => onTogglePinned(note))}
        >
          <Pin size={16} fill={note.favorite ? 'currentColor' : 'none'} />
        </button>
        <button title={labels.edit} onClick={stopCardAction(() => onEdit(note))}>
          <Pencil size={16} />
        </button>
        <button title={labels.delete} onClick={stopCardAction(() => onDelete(note))}>
          <Trash2 size={16} />
        </button>
      </div>
    </article>
  )
})
