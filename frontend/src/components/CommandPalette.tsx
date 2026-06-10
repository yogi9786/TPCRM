import { useState, useEffect } from 'react'
import { Command } from 'cmdk'
import { useNavigate } from 'react-router-dom'
import { useTheme } from 'next-themes'
import {
  LayoutDashboard, Users, Settings, Moon, Sun, Monitor,
  Search, MessageCircle, Mail, Activity
} from 'lucide-react'
import { useAuth } from '../contexts/AuthContext'

export default function CommandPalette() {
  const [open, setOpen] = useState(false)
  const navigate = useNavigate()
  const { theme, setTheme } = useTheme()
  const { currentUser } = useAuth()

  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.key === 'k' && (e.metaKey || e.ctrlKey)) {
        e.preventDefault()
        setOpen((open) => !open)
      }
    }
    document.addEventListener('keydown', down)
    return () => document.removeEventListener('keydown', down)
  }, [])

  const runCommand = (command: () => void) => {
    setOpen(false)
    command()
  }

  if (!currentUser) return null

  return (
    <Command.Dialog
      open={open}
      onOpenChange={setOpen}
      label="Global Command Menu"
      className="fixed inset-0 z-[100] flex items-start justify-center pt-[20vh] bg-slate-900/50 dark:bg-black/50 backdrop-blur-sm p-4 animate-fade-in"
    >
      <div className="w-full max-w-xl bg-white dark:bg-slate-900 rounded-2xl shadow-2xl overflow-hidden border border-slate-200 dark:border-slate-800 animate-scale-in">
        <div className="flex items-center border-b border-slate-100 dark:border-slate-800 px-3">
          <Search size={18} className="text-slate-400 shrink-0" />
          <Command.Input
            autoFocus
            placeholder="Type a command or search..."
            className="w-full bg-transparent p-4 text-sm font-medium text-slate-900 dark:text-slate-100 placeholder:text-slate-400 focus:outline-none"
          />
        </div>
        <Command.List className="max-h-[300px] overflow-y-auto p-2 scrollbar-hide">
          <Command.Empty className="py-6 text-center text-sm text-slate-500">
            No results found.
          </Command.Empty>

          <Command.Group heading="Navigation" className="px-2 text-xs font-semibold text-slate-500 dark:text-slate-400 py-2">
            <Command.Item
              onSelect={() => runCommand(() => navigate('/'))}
              className="flex items-center gap-2 px-3 py-2.5 mt-1 rounded-xl cursor-pointer text-sm text-slate-700 dark:text-slate-200 aria-selected:bg-slate-100 dark:aria-selected:bg-slate-800 transition-colors"
            >
              <LayoutDashboard size={16} /> Dashboard
            </Command.Item>
            <Command.Item
              onSelect={() => runCommand(() => navigate('/crm'))}
              className="flex items-center gap-2 px-3 py-2.5 mt-1 rounded-xl cursor-pointer text-sm text-slate-700 dark:text-slate-200 aria-selected:bg-slate-100 dark:aria-selected:bg-slate-800 transition-colors"
            >
              <Users size={16} /> CRM Leads
            </Command.Item>
            <Command.Item
              onSelect={() => runCommand(() => navigate('/whatsapp'))}
              className="flex items-center gap-2 px-3 py-2.5 mt-1 rounded-xl cursor-pointer text-sm text-slate-700 dark:text-slate-200 aria-selected:bg-slate-100 dark:aria-selected:bg-slate-800 transition-colors"
            >
              <MessageCircle size={16} /> WhatsApp
            </Command.Item>
            <Command.Item
              onSelect={() => runCommand(() => navigate('/email'))}
              className="flex items-center gap-2 px-3 py-2.5 mt-1 rounded-xl cursor-pointer text-sm text-slate-700 dark:text-slate-200 aria-selected:bg-slate-100 dark:aria-selected:bg-slate-800 transition-colors"
            >
              <Mail size={16} /> Email
            </Command.Item>
            <Command.Item
              onSelect={() => runCommand(() => navigate('/analytics'))}
              className="flex items-center gap-2 px-3 py-2.5 mt-1 rounded-xl cursor-pointer text-sm text-slate-700 dark:text-slate-200 aria-selected:bg-slate-100 dark:aria-selected:bg-slate-800 transition-colors"
            >
              <Activity size={16} /> Analytics
            </Command.Item>
            <Command.Item
              onSelect={() => runCommand(() => navigate('/settings'))}
              className="flex items-center gap-2 px-3 py-2.5 mt-1 rounded-xl cursor-pointer text-sm text-slate-700 dark:text-slate-200 aria-selected:bg-slate-100 dark:aria-selected:bg-slate-800 transition-colors"
            >
              <Settings size={16} /> Settings
            </Command.Item>
          </Command.Group>

          <Command.Separator className="h-px bg-slate-100 dark:bg-slate-800 my-2" />

          <Command.Group heading="Theme" className="px-2 text-xs font-semibold text-slate-500 dark:text-slate-400 py-2">
            <Command.Item
              onSelect={() => runCommand(() => setTheme('light'))}
              className="flex items-center gap-2 px-3 py-2.5 mt-1 rounded-xl cursor-pointer text-sm text-slate-700 dark:text-slate-200 aria-selected:bg-slate-100 dark:aria-selected:bg-slate-800 transition-colors"
            >
              <Sun size={16} /> Light Theme
            </Command.Item>
            <Command.Item
              onSelect={() => runCommand(() => setTheme('dark'))}
              className="flex items-center gap-2 px-3 py-2.5 mt-1 rounded-xl cursor-pointer text-sm text-slate-700 dark:text-slate-200 aria-selected:bg-slate-100 dark:aria-selected:bg-slate-800 transition-colors"
            >
              <Moon size={16} /> Dark Theme
            </Command.Item>
            <Command.Item
              onSelect={() => runCommand(() => setTheme('system'))}
              className="flex items-center gap-2 px-3 py-2.5 mt-1 rounded-xl cursor-pointer text-sm text-slate-700 dark:text-slate-200 aria-selected:bg-slate-100 dark:aria-selected:bg-slate-800 transition-colors"
            >
              <Monitor size={16} /> System Theme
            </Command.Item>
          </Command.Group>
        </Command.List>
      </div>
    </Command.Dialog>
  )
}
