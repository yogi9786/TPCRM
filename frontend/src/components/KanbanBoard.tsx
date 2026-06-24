import { useState } from 'react'
import {
  DndContext,
  DragOverlay,
  closestCorners,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragStartEvent,
  DragEndEvent,
} from '@dnd-kit/core'
import { useDroppable, useDraggable } from '@dnd-kit/core'
import { Lead, LeadStatus } from '../types'
import { Edit3, Trash2, ClipboardList } from 'lucide-react'
import clsx from 'clsx'

const KANBAN_COLS: LeadStatus[] = ['New', 'Contacted', 'Qualified', 'Closed']

type BadgeKey = LeadStatus
const STATUS_STYLE: Record<BadgeKey, string> = {
  New: 'badge-new',
  Contacted: 'badge-contacted',
  Qualified: 'badge-qualified',
  Closed: 'badge-closed',
  Lost: 'badge-lost',
}

const KANBAN_COLORS: Record<string, string> = {
  New: 'border-slate-400',
  Contacted: 'border-sky-500/50',
  Qualified: 'border-violet-500/50',
  Closed: 'border-emerald-500/50',
}

// ── Droppable Column ────────────────────────────────────────────────────────
function KanbanColumn({ col, leads, onEdit, onDelete, onStatusChange, onActivity }: any) {
  const { setNodeRef, isOver } = useDroppable({ id: col })

  const totalValue = leads.reduce((sum: number, l: any) => sum + (l.value || 0), 0)

  return (
    <div
      ref={setNodeRef}
      className={clsx(
        'bg-slate-50/50 p-4 border-t-2 min-h-[400px] flex flex-col transition-colors rounded-b-2xl',
        KANBAN_COLORS[col],
        isOver && 'bg-blue-50/50'
      )}
    >
      <div className="flex items-center justify-between mb-4">
        <span className={STATUS_STYLE[col as LeadStatus]}>{col}</span>
        <div className="flex gap-2">
          {totalValue > 0 && <span className="text-xs text-emerald-600 font-bold bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-100">₹{totalValue.toLocaleString('en-IN')}</span>}
          <span className="text-xs text-black font-semibold bg-white px-2 py-0.5 rounded-md shadow-sm border border-slate-100">{leads.length}</span>
        </div>
      </div>
      <div className="space-y-3 flex-1">
        {leads.length === 0 && (
          <div className="flex flex-col items-center justify-center py-8 text-slate-400 dark:text-slate-500">
            <p className="text-xs">Drop leads here</p>
          </div>
        )}
        {leads.map((lead: Lead) => (
          <KanbanCard
            key={lead.id}
            lead={lead}
            onEdit={onEdit}
            onDelete={onDelete}
            onStatusChange={onStatusChange}
            onActivity={onActivity}
          />
        ))}
      </div>
    </div>
  )
}

// ── Draggable Card ──────────────────────────────────────────────────────────
function KanbanCard({ lead, onEdit, onDelete, onStatusChange, onActivity }: any) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: lead.id,
    data: { lead },
  })

  const style = transform
    ? { transform: `translate3d(${transform.x}px, ${transform.y}px, 0)` }
    : undefined

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...listeners}
      {...attributes}
      className={clsx(
        'bg-white border border-slate-200 shadow-sm rounded-xl p-3.5 space-y-2',
        'hover:border-slate-300 hover:-translate-y-1 hover:shadow-md transition-all duration-300 cursor-grab group relative z-10',
        isDragging && 'opacity-50 cursor-grabbing'
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <p className="text-sm font-bold text-black leading-tight flex-1 break-words pt-1">{lead.fullName}</p>
        <div className="flex gap-1 flex-shrink-0">
          <button
            onPointerDown={(e) => { e.stopPropagation(); onActivity(lead) }}
            className="w-7 h-7 flex items-center justify-center rounded-lg bg-amber-50 text-amber-600 hover:bg-amber-500 hover:text-white transition-all duration-150 cursor-pointer"
            title="Activities"
          >
            <ClipboardList size={13} />
          </button>
          <button
            onPointerDown={(e) => { e.stopPropagation(); onEdit(lead) }}
            className="w-7 h-7 flex items-center justify-center rounded-lg bg-blue-50 text-blue-600 hover:bg-blue-600 hover:text-white transition-all duration-150 cursor-pointer"
          >
            <Edit3 size={13} />
          </button>
          <button
            onPointerDown={(e) => { e.stopPropagation(); onDelete(lead.id) }}
            className="w-7 h-7 flex items-center justify-center rounded-lg bg-red-50 text-red-500 hover:bg-red-500 hover:text-white transition-all duration-150 cursor-pointer"
          >
            <Trash2 size={13} />
          </button>
        </div>
      </div>

      {lead.companyName && <p className="text-xs font-semibold text-black opacity-80">{lead.companyName}</p>}
      <div className="flex items-center justify-between">
        <p className="text-xs font-semibold text-black">{lead.phone}</p>
        {lead.value && <span className="text-[10px] text-emerald-600 font-bold bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-100">₹{lead.value.toLocaleString('en-IN')}</span>}
      </div>
      <p className="text-[11px] text-black font-medium truncate">{lead.serviceInterested}</p>

      <div className="flex items-center justify-between pt-1.5">
        <span className="text-[9px] font-extrabold uppercase tracking-wider text-black inline-flex items-center px-2 py-0.5 rounded-md bg-slate-100 border border-slate-200">
          {lead.leadSource}
        </span>
        <div className="flex gap-1">
          {KANBAN_COLS.filter(s => s !== lead.status).map(s => (
            <button
              key={s}
              onPointerDown={(e) => { e.stopPropagation(); onStatusChange(lead.id, s) }}
              className="text-[10px] text-slate-500 dark:text-slate-400 hover:text-blue-700 dark:hover:text-blue-400 transition-colors cursor-pointer"
              title={`Move to ${s}`}
            >
              →{s.charAt(0)}
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}

// ── Board ────────────────────────────────────────────────────────────────────
export default function KanbanBoard({
  leads, onEdit, onDelete, onStatusChange, onActivity,
}: {
  leads: Lead[]
  onEdit: (l: Lead) => void
  onDelete: (id: string) => void
  onStatusChange: (id: string, s: LeadStatus) => void
  onActivity: (l: Lead) => void
}) {
  const [activeLead, setActiveLead] = useState<Lead | null>(null)

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor)
  )

  const handleDragStart = (event: DragStartEvent) => {
    setActiveLead(event.active.data.current?.lead as Lead)
  }

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event
    setActiveLead(null)
    if (!over) return
    const lead = leads.find((l) => l.id === active.id)
    if (!lead) return
    const overId = over.id as LeadStatus
    if (lead.status !== overId && KANBAN_COLS.includes(overId)) {
      onStatusChange(lead.id, overId)
    }
  }

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCorners}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
    >
      <div className="grid grid-cols-2 xl:grid-cols-4 gap-4 overflow-x-auto pb-4">
        {KANBAN_COLS.map(col => {
          const colLeads = leads.filter(l => l.status === col)
          return (
            <KanbanColumn
              key={col}
              col={col}
              leads={colLeads}
              onEdit={onEdit}
              onDelete={onDelete}
              onStatusChange={onStatusChange}
              onActivity={onActivity}
            />
          )
        })}
      </div>

      <DragOverlay dropAnimation={{ duration: 200, easing: 'ease' }}>
        {activeLead ? (
          <div className="opacity-90 scale-105 rotate-2">
            <KanbanCard
              lead={activeLead}
              onEdit={onEdit}
              onDelete={onDelete}
              onStatusChange={onStatusChange}
              onActivity={onActivity}
            />
          </div>
        ) : null}
      </DragOverlay>
    </DndContext>
  )
}
