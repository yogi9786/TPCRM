import { useState, useEffect, useRef } from 'react'
import { MessageSquare, X, Send, Bot, User, Trash2, Edit2 } from 'lucide-react'
import { useAuth } from '../contexts/AuthContext'
import toast from 'react-hot-toast'
import clsx from 'clsx'

const isLocalhost = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
const API = isLocalhost ? (import.meta.env.VITE_API_URL || 'http://localhost:8000') : 'https://tpcrm.onrender.com';

interface ChatMsg {
  id: string
  role: 'user' | 'bot'
  content: string
  time: string
}

export default function ChatbotWidget() {
  const { currentUser } = useAuth()
  const [isOpen, setIsOpen] = useState(false)
  const [messages, setMessages] = useState<ChatMsg[]>([])
  const [input, setInput] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editText, setEditText] = useState('')

  const chatEndRef = useRef<HTMLDivElement>(null)

  // Load from local storage on mount
  useEffect(() => {
    const saved = localStorage.getItem('site_chatbot_history')
    if (saved) {
      setMessages(JSON.parse(saved))
    } else {
      setMessages([{
        id: 'welcome',
        role: 'bot',
        content: 'Hi there! 👋 I am the TekhPortal AI Assistant. How can I help you today?',
        time: new Date().toISOString()
      }])
    }
  }, [])

  // Save to local storage on change
  useEffect(() => {
    if (messages.length > 0) {
      localStorage.setItem('site_chatbot_history', JSON.stringify(messages))
    }
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  async function sendMessage() {
    if (!input.trim()) return

    const userMsg: ChatMsg = {
      id: Date.now().toString(),
      role: 'user',
      content: input.trim(),
      time: new Date().toISOString()
    }
    
    const newMessages = [...messages, userMsg]
    setMessages(newMessages)
    setInput('')
    setIsLoading(true)

    try {
      const token = await currentUser?.getIdToken?.()
      const formattedHistory = newMessages.slice(-6).map(m => ({
        role: m.role === 'user' ? 'user' : 'assistant',
        content: m.content
      }))

      const res = await fetch(`${API}/chatbot/query`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {})
        },
        body: JSON.stringify({
          message: userMsg.content,
          history: formattedHistory
        })
      })

      if (!res.ok) throw new Error('Failed to get response')
      
      const data = await res.json()
      
      setMessages(prev => [...prev, {
        id: Date.now().toString() + '_bot',
        role: 'bot',
        content: data.response || "I'm having trouble connecting to my brain right now.",
        time: new Date().toISOString()
      }])
      
    } catch (err) {
      console.error(err)
      toast.error('AI Chatbot is currently unavailable')
      setMessages(prev => [...prev, {
        id: Date.now().toString() + '_error',
        role: 'bot',
        content: "Sorry, I couldn't process that request.",
        time: new Date().toISOString()
      }])
    } finally {
      setIsLoading(false)
    }
  }

  function deleteMessage(id: string) {
    if (confirm('Delete this message?')) {
      setMessages(prev => prev.filter(m => m.id !== id))
    }
  }

  function saveEdit(id: string) {
    if (!editText.trim()) return
    setMessages(prev => prev.map(m => m.id === id ? { ...m, content: editText.trim() } : m))
    setEditingId(null)
    setEditText('')
  }

  return (
    <div className="fixed bottom-6 right-6 z-[9999] flex flex-col items-end">
      
      {isOpen && (
        <div className="w-80 sm:w-96 h-[500px] max-h-[80vh] bg-white rounded-2xl shadow-2xl border border-slate-200 flex flex-col mb-4 overflow-hidden animate-slide-up">
          {/* Header */}
          <div className="bg-gradient-to-r from-blue-600 to-indigo-600 p-4 flex items-center justify-between text-white flex-shrink-0">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-full bg-white/20 flex items-center justify-center">
                <Bot size={18} />
              </div>
              <div>
                <h3 className="font-bold text-sm leading-tight">TekhPortal AI</h3>
                <p className="text-[10px] text-blue-100 opacity-90">Usually replies instantly</p>
              </div>
            </div>
            <button onClick={() => setIsOpen(false)} className="text-blue-100 hover:text-white transition-colors p-1 rounded-lg hover:bg-white/10">
              <X size={20} />
            </button>
          </div>

          {/* Chat Feed */}
          <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-slate-50/50">
            {messages.map((msg) => (
              <div key={msg.id} className={clsx('flex w-full group', msg.role === 'user' ? 'justify-end' : 'justify-start')}>
                
                {msg.role === 'user' && (
                  <div className="flex flex-col gap-1 mx-2 opacity-0 group-hover:opacity-100 transition-opacity justify-start pt-1">
                    <button onClick={() => { setEditingId(msg.id); setEditText(msg.content) }} className="p-1 rounded text-slate-400 hover:bg-slate-200 hover:text-blue-600">
                      <Edit2 size={12} />
                    </button>
                    <button onClick={() => deleteMessage(msg.id)} className="p-1 rounded text-slate-400 hover:bg-slate-200 hover:text-red-500">
                      <Trash2 size={12} />
                    </button>
                  </div>
                )}

                <div className={clsx(
                  'max-w-[75%] rounded-2xl p-3 shadow-sm flex flex-col gap-1',
                  msg.role === 'user' ? 'bg-blue-600 text-white rounded-tr-none' : 'bg-white border border-slate-200 text-slate-800 rounded-tl-none'
                )}>
                  {editingId === msg.id ? (
                    <div className="flex flex-col gap-2">
                      <textarea
                        value={editText}
                        onChange={e => setEditText(e.target.value)}
                        className="w-full text-xs p-2 rounded text-slate-900 resize-none"
                        rows={2}
                      />
                      <div className="flex gap-2 justify-end">
                        <button onClick={() => setEditingId(null)} className="text-[10px] font-medium opacity-80 hover:opacity-100">Cancel</button>
                        <button onClick={() => saveEdit(msg.id)} className="text-[10px] font-bold bg-white text-blue-600 px-2 py-1 rounded">Save</button>
                      </div>
                    </div>
                  ) : (
                    <p className="text-[13px] leading-relaxed whitespace-pre-wrap">{msg.content}</p>
                  )}
                  <span className={clsx('text-[9px] mt-1 text-right', msg.role === 'user' ? 'text-blue-200' : 'text-slate-400')}>
                    {new Date(msg.time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </span>
                </div>

                {msg.role === 'bot' && (
                  <div className="flex flex-col gap-1 mx-2 opacity-0 group-hover:opacity-100 transition-opacity justify-start pt-1">
                    <button onClick={() => deleteMessage(msg.id)} className="p-1 rounded text-slate-400 hover:bg-slate-200 hover:text-red-500">
                      <Trash2 size={12} />
                    </button>
                  </div>
                )}
              </div>
            ))}
            
            {isLoading && (
              <div className="flex justify-start">
                <div className="bg-white border border-slate-200 rounded-2xl rounded-tl-none p-3 shadow-sm flex items-center gap-1.5">
                  <div className="w-1.5 h-1.5 bg-slate-400 rounded-full animate-bounce" />
                  <div className="w-1.5 h-1.5 bg-slate-400 rounded-full animate-bounce delay-75" />
                  <div className="w-1.5 h-1.5 bg-slate-400 rounded-full animate-bounce delay-150" />
                </div>
              </div>
            )}
            <div ref={chatEndRef} />
          </div>

          {/* Input Area */}
          <div className="p-3 bg-white border-t border-slate-200 flex gap-2">
            <input
              type="text"
              placeholder="Ask anything..."
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && sendMessage()}
              className="flex-1 text-sm bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 transition-all"
            />
            <button
              onClick={sendMessage}
              disabled={!input.trim() || isLoading}
              className="w-10 h-10 rounded-xl bg-blue-600 text-white flex items-center justify-center hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              <Send size={16} />
            </button>
          </div>
        </div>
      )}

      {/* Floating Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={clsx(
          "w-14 h-14 rounded-full shadow-2xl flex items-center justify-center text-white transition-all transform hover:scale-105 duration-300",
          isOpen ? "bg-slate-800 rotate-90" : "bg-gradient-to-r from-blue-600 to-indigo-600"
        )}
      >
        {isOpen ? <X size={24} className="-rotate-90" /> : <MessageSquare size={24} />}
      </button>

    </div>
  )
}
