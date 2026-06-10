import { useState, useRef, useEffect } from 'react'

interface EditableCellProps {
  value: string
  onSave: (val: string) => void
  placeholder?: string
}

export default function EditableCell({ value, onSave, placeholder = '' }: EditableCellProps) {
  const [isEditing, setIsEditing] = useState(false)
  const [val, setVal] = useState(value || '')
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => { setVal(value || '') }, [value])

  useEffect(() => {
    if (isEditing && inputRef.current) {
      inputRef.current.focus()
      inputRef.current.select()
    }
  }, [isEditing])

  const handleBlur = () => {
    setIsEditing(false)
    if (val !== value) onSave(val)
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') handleBlur()
    if (e.key === 'Escape') {
      setVal(value || '')
      setIsEditing(false)
    }
  }

  if (isEditing) {
    return (
      <input
        ref={inputRef}
        value={val}
        onChange={e => setVal(e.target.value)}
        onBlur={handleBlur}
        onKeyDown={handleKeyDown}
        placeholder={placeholder}
        className="w-full bg-blue-50 dark:bg-slate-800 text-slate-900 dark:text-slate-100 border border-blue-400 dark:border-blue-500 rounded px-2 py-1 text-sm focus:outline-none"
      />
    )
  }

  return (
    <div
      onClick={() => setIsEditing(true)}
      className="cursor-text hover:bg-slate-100 px-2 py-1 -mx-2 rounded border border-transparent hover:border-slate-200 transition-colors min-h-[28px] truncate flex items-center text-sm text-inherit font-inherit"
    >
      {value || <span className="text-slate-400 italic text-xs font-normal">{placeholder}</span>}
    </div>
  )
}
