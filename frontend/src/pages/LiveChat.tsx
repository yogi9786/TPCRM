import { useState, useEffect, useRef } from 'react'
import { collection, query, where, onSnapshot, addDoc, serverTimestamp, orderBy, updateDoc, deleteDoc, doc } from 'firebase/firestore'
import { db } from '../firebase'
import { useAuth } from '../contexts/AuthContext'
import MainLayout from '../layouts/MainLayout'
import { 
  MessageSquare, Send, Phone, User, Bot, Search, ShieldAlert, Check, RefreshCw, AlertCircle, ToggleLeft, ToggleRight, Edit2, Trash2
} from 'lucide-react'
import toast from 'react-hot-toast'
import clsx from 'clsx'
import { Lead } from '../types'

const isLocalhost = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
const API = isLocalhost ? (import.meta.env.VITE_API_URL || 'http://localhost:8000') : 'https://tpcrm.onrender.com';

interface ChatMessage {
  id?: string
  sender: 'client' | 'agent' | 'bot'
  text: string
  createdAt: string
  leadId: string
}

export default function LiveChat() {
  const { currentUser } = useAuth()
  const [leads, setLeads] = useState<Lead[]>([])
  const [selectedLead, setSelectedLead] = useState<Lead | null>(null)
  const [searchQuery, setSearchQuery] = useState('')
  const [sourceFilter, setSourceFilter] = useState<'All' | 'WhatsApp' | 'Meta'>('All')
  const [messageText, setMessageText] = useState('')
  
  // Chat modes & automation states
  const [chatMode, setChatMode] = useState<'web' | 'whatsapp'>('web')
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [loadingHistory, setLoadingHistory] = useState(false)
  const [sending, setSending] = useState(false)
  const [botTyping, setBotTyping] = useState(false)
  
  // Edit State
  const [editingMessageId, setEditingMessageId] = useState<string | null>(null)
  const [editMessageText, setEditMessageText] = useState('')

  const chatEndRef = useRef<HTMLDivElement>(null)

  // ── Fetch CRM Leads for the sidebar ──────────────────────────────────────
  useEffect(() => {
    if (!currentUser) return
    const q = query(collection(db, 'leads'), where('userId', '==', currentUser.uid))
    const unsub = onSnapshot(q, snap => {
      const fetched = snap.docs.map(d => ({ id: d.id, ...d.data() } as Lead))
      setLeads(fetched)
      
      // Auto-select lead if provided in query parameter
      const params = new URLSearchParams(window.location.search)
      const phoneParam = params.get('phone')
      if (phoneParam && fetched.length > 0) {
        const found = fetched.find(l => l.phone.replace(/\D/g, '') === phoneParam.replace(/\D/g, ''))
        if (found) {
          setSelectedLead(found)
        }
      }
    })
    return unsub
  }, [currentUser])

  // ── Sync Chat History (Realtime via Firestore or LocalStorage backup) ─────
  useEffect(() => {
    if (!selectedLead || !currentUser) {
      setMessages([])
      return
    }
    
    setLoadingHistory(true)
    // Attempt Firestore sync
    try {
      const q = query(
        collection(db, 'chats'), 
        where('userId', '==', currentUser.uid),
        where('leadId', '==', selectedLead.id),
        orderBy('createdAt', 'asc')
      )
      
      const unsub = onSnapshot(q, snap => {
        if (!snap.empty) {
          const chats = snap.docs.map(d => {
            const data = d.data()
            return {
              id: d.id,
              sender: data.sender,
              text: data.text,
              createdAt: data.createdAt?.seconds ? new Date(data.createdAt.seconds * 1000).toISOString() : new Date().toISOString(),
              leadId: data.leadId
            } as ChatMessage
          })
          setMessages(chats)
        } else {
          // Fallback to LocalStorage for mock database runs
          const localHistory = localStorage.getItem(`chat_history_${selectedLead.id}`)
          if (localHistory) {
            setMessages(JSON.parse(localHistory))
          } else {
            // Seed a starter message
            const seed: ChatMessage[] = [
              {
                sender: 'client',
                text: `Hello, I'm interested in TekhPortal services. Can you help me?`,
                createdAt: new Date(Date.now() - 3600 * 1000).toISOString(),
                leadId: selectedLead.id
              }
            ]
            setMessages(seed)
            localStorage.setItem(`chat_history_${selectedLead.id}`, JSON.stringify(seed))
          }
        }
        setLoadingHistory(false)
      }, (err) => {
        // Firestore rules might prevent order-by without indexes, fallback
        console.warn('Firestore fallback active:', err)
        const localHistory = localStorage.getItem(`chat_history_${selectedLead.id}`)
        if (localHistory) {
          setMessages(JSON.parse(localHistory))
        }
        setLoadingHistory(false)
      })
      
      return unsub
    } catch (e) {
      setLoadingHistory(false)
    }
  }, [selectedLead, currentUser])

  // Scroll to bottom on new messages
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, botTyping])

  // ── Send message ─────────────────────────────────────────────────────────
  async function handleSend(senderOverride?: 'client' | 'agent') {
    if (!messageText.trim() || !selectedLead || !currentUser) return
    
    const sender = senderOverride || 'agent'
    const newMsg: ChatMessage = {
      sender,
      text: messageText.trim(),
      createdAt: new Date().toISOString(),
      leadId: selectedLead.id
    }
    
    // Save locally
    const currentList = [...messages, newMsg]
    setMessages(currentList)
    localStorage.setItem(`chat_history_${selectedLead.id}`, JSON.stringify(currentList))
    setMessageText('')
    
    // Attempt Firestore save
    try {
      await addDoc(collection(db, 'chats'), {
        ...newMsg,
        userId: currentUser.uid,
        createdAt: serverTimestamp()
      })
    } catch (err) {
      console.warn('Failed to save to Firestore, using local backup')
    }
  }

  // ── Edit & Delete Messages ────────────────────────────────────────────────
  async function saveEditedMessage(msgId: string) {
    if (!editMessageText.trim()) return
    try {
      await updateDoc(doc(db, 'chats', msgId), {
        text: editMessageText.trim()
      })
      
      // Update local state for immediate feedback or local storage fallback
      const updatedMessages = messages.map(m => m.id === msgId ? { ...m, text: editMessageText.trim() } : m)
      setMessages(updatedMessages)
      if (selectedLead) localStorage.setItem(`chat_history_${selectedLead.id}`, JSON.stringify(updatedMessages))
      
      setEditingMessageId(null)
      setEditMessageText('')
      toast.success('Message updated')
    } catch (err) {
      toast.error('Failed to update message')
    }
  }

  async function deleteMessage(msgId: string) {
    if (!confirm('Are you sure you want to delete this message?')) return
    try {
      await deleteDoc(doc(db, 'chats', msgId))
      
      const updatedMessages = messages.filter(m => m.id !== msgId)
      setMessages(updatedMessages)
      if (selectedLead) localStorage.setItem(`chat_history_${selectedLead.id}`, JSON.stringify(updatedMessages))
      
      toast.success('Message deleted')
    } catch (err) {
      toast.error('Failed to delete message')
    }
  }

  // Filter leads by search query and source
  const filteredLeads = leads.filter(l => {
    const matchesSearch = l.fullName.toLowerCase().includes(searchQuery.toLowerCase()) || l.phone.includes(searchQuery)
    const matchesSource = sourceFilter === 'All' 
      ? true 
      : sourceFilter === 'Meta' 
        ? (l.leadSource.includes('Meta') || l.leadSource.includes('Facebook') || l.leadSource.includes('Instagram')) 
        : l.leadSource === 'WhatsApp'
    return matchesSearch && matchesSource
  })

  return (
    <MainLayout>
      <div className="h-[calc(100vh-100px)] flex flex-col md:flex-row gap-5 animate-fade-in">
        
        {/* Left column — Lead Selector */}
        <div className="w-full md:w-[280px] lg:w-[320px] flex flex-col glass-card border-slate-200 overflow-hidden flex-shrink-0">
          <div className="p-4 border-b border-slate-200">
            <h2 className="text-base font-bold text-slate-900 flex items-center gap-2 mb-3">
              <MessageSquare className="text-blue-400" size={18} />
              Conversations
            </h2>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" size={14} />
              <input
                type="text"
                placeholder="Search leads..."
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                className="input-field pl-9 py-2 text-xs"
              />
            </div>
            <div className="flex gap-2 mt-3 px-1">
              <button onClick={() => setSourceFilter('All')} className={clsx('text-xs px-2.5 py-1 rounded-full font-medium transition-colors', sourceFilter === 'All' ? 'bg-slate-200 text-slate-800' : 'text-slate-500 hover:bg-slate-100')}>All</button>
              <button onClick={() => setSourceFilter('WhatsApp')} className={clsx('text-xs px-2.5 py-1 rounded-full font-medium transition-colors', sourceFilter === 'WhatsApp' ? 'bg-emerald-100 text-emerald-700' : 'text-slate-500 hover:bg-slate-100')}>WhatsApp</button>
              <button onClick={() => setSourceFilter('Meta')} className={clsx('text-xs px-2.5 py-1 rounded-full font-medium transition-colors', sourceFilter === 'Meta' ? 'bg-blue-100 text-blue-700' : 'text-slate-500 hover:bg-slate-100')}>Meta</button>
            </div>
          </div>
          
          <div className="flex-1 overflow-y-auto divide-y divide-slate-200 p-2 space-y-1">
            {filteredLeads.length === 0 ? (
              <div className="text-center py-10 text-slate-500 text-xs">
                No conversations found.
              </div>
            ) : (
              filteredLeads.map(lead => (
                <button
                  key={lead.id}
                  onClick={() => setSelectedLead(lead)}
                  className={clsx(
                    'w-full text-left p-3 rounded-xl transition-all flex items-center justify-between gap-3',
                    selectedLead?.id === lead.id
                      ? 'bg-blue-600/20 border border-blue-500/30'
                      : 'border border-transparent hover:bg-slate-50'
                  )}
                >
                  <div className="min-w-0 flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-500/20 to-indigo-500/20 border border-slate-200 flex items-center justify-center text-xs font-bold text-slate-700 flex-shrink-0">
                      {lead.fullName.charAt(0)}
                    </div>
                    <div className="min-w-0">
                      <p className="text-xs font-semibold text-slate-900 truncate">{lead.fullName}</p>
                      <p className="text-[10px] text-slate-500 truncate">{lead.phone}</p>
                    </div>
                  </div>
                  <span className={clsx(
                    "text-[9px] px-2 py-0.5 rounded-full font-semibold border",
                    lead.leadSource === 'WhatsApp' ? 'bg-emerald-50 text-emerald-600 border-emerald-200' :
                    (lead.leadSource.includes('Meta') || lead.leadSource.includes('Facebook') || lead.leadSource.includes('Instagram')) ? 'bg-blue-50 text-blue-600 border-blue-200' :
                    'bg-slate-50 text-slate-600 border-slate-200'
                  )}>
                    {lead.leadSource}
                  </span>
                </button>
              ))
            )}
          </div>
        </div>

        {/* Right column — Chat window */}
        <div className="flex-1 flex flex-col glass-card border-slate-200 overflow-hidden">
          {selectedLead ? (
            <>
              {/* Chat Header */}
              <div className="p-4 border-b border-slate-200 flex items-center justify-between flex-shrink-0 bg-white/30">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-9 h-9 rounded-full bg-gradient-to-br from-blue-500/20 to-indigo-500/20 border border-slate-200 flex items-center justify-center text-sm font-bold text-slate-200">
                    {selectedLead.fullName.charAt(0)}
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-bold text-slate-900 truncate">{selectedLead.fullName}</p>
                    <p className="text-xs text-slate-500 font-mono">{selectedLead.phone}</p>
                  </div>
                </div>
                
                {/* Chat Configs & Automation */}
                <div className="flex items-center gap-4 flex-wrap">
                  {/* Chat Mode Toggle */}
                  <div className="flex rounded-lg border border-slate-200 overflow-hidden text-xs bg-white/40">
                    <button
                      onClick={() => setChatMode('web')}
                      className={clsx('px-2.5 py-1.5 font-medium transition-colors', chatMode === 'web' ? 'bg-blue-600/20 text-blue-400' : 'text-slate-500 hover:text-slate-900')}
                    >
                      Web Chat
                    </button>
                    <button
                      onClick={() => setChatMode('whatsapp')}
                      className={clsx('px-2.5 py-1.5 font-medium transition-colors', chatMode === 'whatsapp' ? 'bg-emerald-600/20 text-emerald-400' : 'text-slate-500 hover:text-slate-900')}
                    >
                      WhatsApp Mock
                    </button>
                  </div>
                </div>
              </div>

              {/* Chat Feed */}
              <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-slate-950/20">
                {loadingHistory ? (
                  <div className="flex justify-center items-center h-full">
                    <RefreshCw size={24} className="animate-spin text-blue-500" />
                  </div>
                ) : (
                  <>
                    {messages.map((msg, index) => (
                      <div
                        key={index}
                        className={clsx(
                          'flex w-full group items-start',
                          msg.sender === 'client' ? 'justify-start' : 'justify-end'
                        )}
                      >
                        <div
                          className={clsx(
                            'max-w-[70%] rounded-2xl p-3 shadow-lg flex flex-col gap-1',
                            msg.sender === 'client' && 'bg-slate-50 text-slate-900 rounded-tl-none border border-slate-200',
                            msg.sender === 'agent' && 'bg-gradient-to-br from-blue-600 to-indigo-600 text-slate-900 rounded-tr-none border border-blue-200',
                            msg.sender === 'bot' && 'bg-gradient-to-br from-emerald-600/90 to-teal-600/90 text-slate-900 rounded-tl-none border border-emerald-500/20'
                          )}
                        >
                          <div className="flex items-center justify-between gap-6 text-[10px]">
                            <span className="font-semibold uppercase tracking-wider opacity-60 flex items-center gap-1">
                              {msg.sender === 'client' && <User size={9} />}
                              {msg.sender === 'agent' && 'Agent'}
                              {msg.sender === 'bot' && (
                                <>
                                  <Bot size={10} className="text-yellow-300" />
                                  AI Assistant
                                </>
                              )}
                              {msg.sender === 'client' && selectedLead.fullName}
                            </span>
                            <span className="opacity-45">
                              {new Date(msg.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                            </span>
                          </div>
                          {editingMessageId === msg.id ? (
                            <div className="mt-2 flex flex-col gap-2">
                              <textarea
                                value={editMessageText}
                                onChange={e => setEditMessageText(e.target.value)}
                                className="w-full text-xs p-2 rounded text-slate-900 border border-slate-300 resize-none"
                                rows={2}
                              />
                              <div className="flex gap-2 justify-end">
                                <button onClick={() => setEditingMessageId(null)} className="text-[10px] text-slate-500 hover:text-slate-700 font-medium bg-white px-2 py-1 rounded">Cancel</button>
                                <button onClick={() => msg.id && saveEditedMessage(msg.id)} className="text-[10px] text-blue-600 hover:text-blue-700 font-medium bg-blue-50 px-2 py-1 rounded">Save</button>
                              </div>
                            </div>
                          ) : (
                            <p className="text-xs leading-relaxed whitespace-pre-wrap">{msg.text}</p>
                          )}
                        </div>

                        {/* Hover Actions (Edit/Delete) */}
                        {msg.id && (msg.sender === 'agent' || msg.sender === 'client' || msg.sender === 'bot') && (
                          <div className={clsx(
                            'flex flex-col gap-1 mx-2 opacity-0 group-hover:opacity-100 transition-opacity',
                            msg.sender === 'client' ? 'order-last' : 'order-first'
                          )}>
                            <button onClick={() => { setEditingMessageId(msg.id!); setEditMessageText(msg.text) }} className="p-1.5 rounded-full text-slate-400 hover:bg-slate-200 hover:text-blue-600 transition-colors" title="Edit message">
                              <Edit2 size={12} />
                            </button>
                            <button onClick={() => msg.id && deleteMessage(msg.id)} className="p-1.5 rounded-full text-slate-400 hover:bg-slate-200 hover:text-red-500 transition-colors" title="Delete message">
                              <Trash2 size={12} />
                            </button>
                          </div>
                        )}
                      </div>
                    ))}
                    
                    {botTyping && (
                      <div className="flex justify-start items-center gap-2 text-slate-500 text-xs">
                        <Bot size={14} className="text-emerald-400 animate-bounce" />
                        <span className="animate-pulse">TekhPortal AI is typing...</span>
                      </div>
                    )}
                    <div ref={chatEndRef} />
                  </>
                )}
              </div>

              {/* Chat Input */}
              <div className="p-4 border-t border-slate-200 flex-shrink-0 bg-white/40">
                <div className="flex gap-2">
                  {/* Simulate customer client sending message */}
                  {chatMode === 'whatsapp' && (
                    <button
                      onClick={() => handleSend('client')}
                      disabled={!messageText.trim()}
                      className="btn-secondary px-3"
                      title="Simulate customer reply (Trigger AI Bot)"
                    >
                      <User size={15} className="text-slate-500" />
                    </button>
                  )}
                  
                  <input
                    type="text"
                    placeholder={
                      chatMode === 'whatsapp'
                        ? 'Simulate customer message (clicks left icon) or type agent reply...'
                        : 'Type customer message...'
                    }
                    value={messageText}
                    onChange={e => setMessageText(e.target.value)}
                    onKeyDown={e => {
                      if (e.key === 'Enter') handleSend('agent')
                    }}
                    className="input-field flex-1"
                  />
                  
                  <button
                    onClick={() => handleSend('agent')}
                    disabled={!messageText.trim()}
                    className="btn-primary"
                  >
                    <Send size={15} />
                    Send
                  </button>
                </div>
                
                {/* Mode notices / helpers */}
                <div className="flex items-center justify-between mt-2 text-[10px] text-slate-500">
                  {chatMode === 'whatsapp' ? (
                    <span className="text-emerald-400 flex items-center gap-1">
                      <AlertCircle size={10} />
                      WhatsApp Sandbox Simulator: Use client button (user icon) to simulate customer incoming chats!
                    </span>
                  ) : (
                    <span>Conversing as Agent</span>
                  )}
                </div>
              </div>
            </>
          ) : (
            <div className="flex-1 flex flex-col justify-center items-center text-slate-500 p-6 text-center">
              <MessageSquare size={48} className="mb-3 opacity-20" />
              <p className="font-semibold text-slate-900">No Lead Conversation Selected</p>
              <p className="text-xs text-slate-500 max-w-xs mt-1.5 leading-relaxed">
                Choose an active lead from the list on the left to start a web live chat or inspect WhatsApp history.
              </p>
            </div>
          )}
        </div>
        
      </div>
    </MainLayout>
  )
}
