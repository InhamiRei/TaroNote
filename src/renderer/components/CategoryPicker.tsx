import { useState, useRef, useEffect } from 'react'
import { ChevronDown, Check } from 'lucide-react'
import type { NoteGroup } from '../../shared/types'
import type { AppLabels } from '../i18n'

type CategoryPickerProps = {
  groups: NoteGroup[]
  labels: AppLabels
  value: string
  onChange: (groupId: string) => void
}

// 自定义分类下拉避免系统 select 样式突兀，也让控件宽度稳定贴近左侧。
export function CategoryPicker({ groups, labels, value, onChange }: CategoryPickerProps) {
  const [open, setOpen] = useState(false)
  const pickerRef = useRef<HTMLDivElement>(null)
  const selectedGroup = groups.find((group) => group.id === value) ?? groups[0]

  useEffect(() => {
    if (!open) {
      return
    }

    const handlePointerDown = (event: PointerEvent) => {
      if (event.target instanceof Node && pickerRef.current?.contains(event.target)) {
        return
      }

      setOpen(false)
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setOpen(false)
      }
    }

    window.addEventListener('pointerdown', handlePointerDown)
    window.addEventListener('keydown', handleKeyDown)
    return () => {
      window.removeEventListener('pointerdown', handlePointerDown)
      window.removeEventListener('keydown', handleKeyDown)
    }
  }, [open])

  return (
    <div className="category-picker" ref={pickerRef}>
      <button
        aria-expanded={open}
        aria-haspopup="listbox"
        className={`category-picker-trigger ${open ? 'open' : ''}`}
        type="button"
        onClick={() => setOpen((current) => !current)}
      >
        <span>{selectedGroup?.name ?? labels.categoryName}</span>
        <ChevronDown size={15} />
      </button>
      {open && (
        <div className="category-picker-menu" role="listbox">
          {groups.map((group) => {
            const selected = group.id === value

            return (
              <button
                aria-selected={selected}
                className={`category-picker-option ${selected ? 'selected' : ''}`}
                key={group.id}
                role="option"
                type="button"
                onClick={() => {
                  onChange(group.id)
                  setOpen(false)
                }}
              >
                <span>{group.name}</span>
                {selected && <Check size={14} />}
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}