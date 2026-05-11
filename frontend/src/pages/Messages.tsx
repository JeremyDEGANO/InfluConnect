import { useEffect, useState, useRef, useCallback } from "react"
import { useParams } from "react-router-dom"
import { useTranslation } from "react-i18next"
import api from "@/lib/api"
import { useAuth } from "@/lib/auth"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { useToast } from "@/hooks/use-toast"
import { MessageCircle, Send, Loader2, ArrowLeft, Paperclip, X, Smile } from "lucide-react"
import { cn } from "@/lib/utils"
import EmojiPicker, { EmojiClickData, Theme } from "emoji-picker-react"

interface Conversation {
  type: 'direct' | 'campaign'
  id: string
  other_user?: { id: number; username: string; avatar?: string }
  proposal_id?: number
  campaign?: string
  last_message: string
  created_at: string
  unread_count?: number
}

interface DirectMessage {
  id: number
  sender: number
  sender_username: string
  sender_avatar?: string
  recipient: number
  recipient_username: string
  content: string
  attachments?: string | null
  created_at: string
}

interface GiphyGif {
  id: string
  images: {
    fixed_width: { url: string }
    original: { url: string }
  }
  title: string
}

function normalizeList<T>(payload: unknown): T[] {
  if (Array.isArray(payload)) return payload as T[]
  if (payload && typeof payload === "object" && Array.isArray((payload as { results?: unknown[] }).results)) {
    return (payload as { results: T[] }).results
  }
  return []
}

export default function Messages() {
  const { t } = useTranslation()
  const { user } = useAuth()
  const { toast } = useToast()
  const { conversation_id } = useParams()

  const [conversations, setConversations] = useState<Conversation[]>([])
  const [messages, setMessages] = useState<DirectMessage[]>([])
  const [loading, setLoading] = useState(false)
  const [messageLoading, setMessageLoading] = useState(false)
  const [currentMessage, setCurrentMessage] = useState('')
  const [sendingMessage, setSendingMessage] = useState(false)
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [selectedConversationId, setSelectedConversationId] = useState<string | null>(conversation_id ?? null)
  const [attachmentBlobUrls, setAttachmentBlobUrls] = useState<Record<number, { url: string; type: string }>>({})
  const [showEmojiPicker, setShowEmojiPicker] = useState(false)
  const [showGifPicker, setShowGifPicker] = useState(false)
  const [gifSearch, setGifSearch] = useState('')
  const [gifs, setGifs] = useState<GiphyGif[]>([])
  const [gifLoading, setGifLoading] = useState(false)

  const messagesEndRef = useRef<HTMLDivElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const emojiPickerRef = useRef<HTMLDivElement>(null)
  const gifPickerRef = useRef<HTMLDivElement>(null)

  const isImageBlob = (entry?: { url: string; type: string }) => {
    if (!entry) return false
    return entry.type.startsWith('image/')
  }

  const isGifMessage = (content: string) =>
    /^https?:\/\/.+\.giphy\.com\//i.test(content) || /^https?:\/\/media[0-9]*\.giphy\.com\//i.test(content)

  const formatConversationTime = (value?: string) => {
    if (!value) return ''
    const date = new Date(value)
    const diffMinutes = Math.max(0, Math.floor((Date.now() - date.getTime()) / 60000))
    if (diffMinutes <= 59) return `${diffMinutes} min`
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
  }

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }

  useEffect(() => {
    scrollToBottom()
  }, [messages])

  useEffect(() => {
    const previous = attachmentBlobUrls
    const next: Record<number, { url: string; type: string }> = {}
    let cancelled = false

    const load = async () => {
      const jobs = messages
        .filter((m) => !!m.attachments)
        .map(async (m) => {
          if (!m.attachments) return
          try {
            const res = await api.get(m.attachments, { responseType: 'blob' })
            const blob: Blob = res.data
            const objectUrl = window.URL.createObjectURL(blob)
            next[m.id] = { url: objectUrl, type: blob.type || 'application/octet-stream' }
          } catch {
            // Ignore per-attachment failures; message text remains visible.
          }
        })
      await Promise.all(jobs)
      if (cancelled) {
        Object.values(next).forEach((e) => window.URL.revokeObjectURL(e.url))
        return
      }
      setAttachmentBlobUrls(next)
      Object.values(previous).forEach((e) => window.URL.revokeObjectURL(e.url))
    }

    load()
    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [messages])

  useEffect(() => {
    return () => {
      Object.values(attachmentBlobUrls).forEach((e) => window.URL.revokeObjectURL(e.url))
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Close pickers on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (showEmojiPicker && emojiPickerRef.current && !emojiPickerRef.current.contains(e.target as Node)) {
        setShowEmojiPicker(false)
      }
      if (showGifPicker && gifPickerRef.current && !gifPickerRef.current.contains(e.target as Node)) {
        setShowGifPicker(false)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [showEmojiPicker, showGifPicker])

  const searchGifs = useCallback(async (query: string) => {
    setGifLoading(true)
    const key = (import.meta as { env: Record<string, string> }).env.VITE_GIPHY_API_KEY || 'dc6zaTOxFJmzC'
    const endpoint = query
      ? `https://api.giphy.com/v1/gifs/search?api_key=${key}&q=${encodeURIComponent(query)}&limit=24&rating=g`
      : `https://api.giphy.com/v1/gifs/trending?api_key=${key}&limit=24&rating=g`
    try {
      const res = await fetch(endpoint)
      const data = await res.json()
      setGifs(data.data || [])
    } catch { /* ignore */ } finally {
      setGifLoading(false)
    }
  }, [])

  // Load trending GIFs when panel opens
  useEffect(() => {
    if (showGifPicker) searchGifs(gifSearch)
  }, [showGifPicker]) // eslint-disable-line react-hooks/exhaustive-deps

  // Debounced GIF search
  useEffect(() => {
    if (!showGifPicker) return
    const t = setTimeout(() => searchGifs(gifSearch), 400)
    return () => clearTimeout(t)
  }, [gifSearch, showGifPicker, searchGifs])

  const sendGif = async (gifUrl: string) => {
    if (!activeConversationId) return
    setShowGifPicker(false)
    setSendingMessage(true)
    try {
      const formData = new FormData()
      formData.append('content', gifUrl)
      if (activeConversationId.startsWith('dm_')) {
        const other_user_id = parseInt(activeConversationId.slice(3))
        formData.append('recipient_id', String(other_user_id))
        await api.post('/direct-messages/send/', formData)
      } else if (activeConversationId.startsWith('campaign_')) {
        const proposal_id = activeConversationId.slice(9)
        await api.post(`/proposals/${proposal_id}/messages/send/`, formData)
      }
      // Reload messages
      if (activeConversationId.startsWith('dm_')) {
        const res = await api.get(`/direct-messages/${activeConversationId.slice(3)}/`)
        setMessages(normalizeList<DirectMessage>(res.data))
      } else if (activeConversationId.startsWith('campaign_')) {
        const res = await api.get(`/proposals/${activeConversationId.slice(9)}/messages/`)
        setMessages(normalizeList<DirectMessage>(res.data))
      }
    } catch {
      toast({ variant: 'destructive', title: t('common.error') })
    } finally {
      setSendingMessage(false)
    }
  }

  useEffect(() => {
    if (conversation_id) setSelectedConversationId(conversation_id)
  }, [conversation_id])

  // Load conversations list
  useEffect(() => {
    setLoading(true)
    api.get('/conversations/')
      .then(res => setConversations(normalizeList<Conversation>(res.data)))
      .catch(() => toast({ variant: 'destructive', title: t('common.error') }))
      .finally(() => setLoading(false))
  }, [t, toast])

  const activeConversationId = selectedConversationId

  // Load messages for selected conversation
  useEffect(() => {
    if (!activeConversationId) return

    setMessageLoading(true)
    if (activeConversationId.startsWith('dm_')) {
      const other_user_id = activeConversationId.slice(3)
      api.get(`/direct-messages/${other_user_id}/`)
        .then(res => {
          setMessages(normalizeList<DirectMessage>(res.data))
          setConversations((prev) => prev.map((c) => (
            c.id === activeConversationId ? { ...c, unread_count: 0 } : c
          )))
          window.dispatchEvent(new Event("messages:unread-refresh"))
        })
        .catch(() => toast({ variant: 'destructive', title: t('common.error') }))
        .finally(() => setMessageLoading(false))
    } else if (activeConversationId.startsWith('campaign_')) {
      const proposal_id = activeConversationId.slice(9)
      api.get(`/proposals/${proposal_id}/messages/`)
        .then(res => {
          setMessages(normalizeList<DirectMessage>(res.data))
          setConversations((prev) => prev.map((c) => (
            c.id === activeConversationId ? { ...c, unread_count: 0 } : c
          )))
          window.dispatchEvent(new Event("messages:unread-refresh"))
        })
        .catch(() => toast({ variant: 'destructive', title: t('common.error') }))
        .finally(() => setMessageLoading(false))
    } else {
      setMessages([])
      setMessageLoading(false)
    }
  }, [activeConversationId, t, toast])

  const handleSendMessage = async () => {
    if ((!currentMessage.trim() && !selectedFile) || !activeConversationId) return
    setSendingMessage(true)

    try {
      const formData = new FormData()
      formData.append('content', currentMessage.trim())
      if (selectedFile) {
        formData.append('attachments', selectedFile)
      }

      if (activeConversationId.startsWith('dm_')) {
        const other_user_id = parseInt(activeConversationId.slice(3))
        formData.append('recipient_id', String(other_user_id))
        await api.post('/direct-messages/send/', formData)
      } else if (activeConversationId.startsWith('campaign_')) {
        const proposal_id = activeConversationId.slice(9)
        await api.post(`/proposals/${proposal_id}/messages/send/`, formData)
      }

      setCurrentMessage('')
      setSelectedFile(null)
      // Reload messages
      if (activeConversationId.startsWith('dm_')) {
        const other_user_id = activeConversationId.slice(3)
        const res = await api.get(`/direct-messages/${other_user_id}/`)
        setMessages(normalizeList<DirectMessage>(res.data))
      } else if (activeConversationId.startsWith('campaign_')) {
        const proposal_id = activeConversationId.slice(9)
        const res = await api.get(`/proposals/${proposal_id}/messages/`)
        setMessages(normalizeList<DirectMessage>(res.data))
      }
    } catch (err) {
      toast({ variant: 'destructive', title: t('common.error') })
    } finally {
      setSendingMessage(false)
    }
  }

  const currentConversation = conversations.find(c => c.id === activeConversationId)

  return (
    <div className="h-screen flex flex-col max-w-6xl mx-auto">
      {/* Header */}
      <div className="border-b border-gray-200 p-4 sm:p-6">
        <div className="flex items-center gap-3">
          <MessageCircle className="h-6 w-6 text-indigo-600" />
          <h1 className="text-2xl font-bold text-gray-900">{t("messages.title", "Messages")}</h1>
        </div>
      </div>

      <div className="flex-1 flex overflow-hidden">
        {/* Conversations list */}
        <div className={cn(
          "w-full sm:w-96 border-r border-gray-200 flex flex-col",
          activeConversationId && "hidden sm:flex"
        )}>
          {loading ? (
            <div className="flex items-center justify-center py-8 text-gray-400">
              <Loader2 className="h-5 w-5 animate-spin mr-2" />
              {t("common.loading")}
            </div>
          ) : conversations.length === 0 ? (
            <div className="flex items-center justify-center py-8 text-gray-400 text-sm">
              {t("messages.no_conversations", "Aucune conversation")}
            </div>
          ) : (
            <div className="overflow-y-auto flex-1">
              {conversations.map(conv => (
                <button
                  key={conv.id}
                  onClick={() => setSelectedConversationId(conv.id)}
                  className={cn(
                    "w-full p-4 text-left border-b border-gray-100 hover:bg-gray-50 transition-colors",
                    activeConversationId === conv.id && "bg-indigo-50"
                  )}
                >
                  <div className="flex items-center gap-3">
                    {conv.other_user?.avatar ? (
                      <img src={conv.other_user.avatar} alt="" className="h-10 w-10 rounded-full" />
                    ) : (
                      <div className="h-10 w-10 rounded-full bg-gray-200 flex items-center justify-center text-sm font-semibold">
                        {(conv.other_user?.username || "U").slice(0, 1).toUpperCase()}
                      </div>
                    )}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <div className="font-semibold text-gray-900 truncate flex-1">
                          {conv.other_user?.username || conv.campaign}
                        </div>
                        <span className="text-[11px] text-gray-400 shrink-0">{formatConversationTime(conv.created_at)}</span>
                        {(conv.unread_count || 0) > 0 && (
                          <span className="inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-red-500 px-1.5 text-[11px] font-semibold text-white shrink-0">
                            {(conv.unread_count || 0) > 99 ? '99+' : conv.unread_count}
                          </span>
                        )}
                      </div>
                      {conv.campaign && (
                        <div className="text-xs text-gray-500 truncate">{conv.campaign}</div>
                      )}
                      <p className="text-xs text-gray-600 line-clamp-1">{conv.last_message}</p>
                    </div>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Messages area */}
        {activeConversationId ? (
          <div className="flex-1 flex flex-col">
            {/* Messages header */}
            <div className="border-b border-gray-200 p-4 sm:p-6 flex items-center gap-3">
              <button
                onClick={() => setSelectedConversationId(null)}
                className="sm:hidden p-2 hover:bg-gray-100 rounded-lg"
              >
                <ArrowLeft className="h-5 w-5" />
              </button>
              {currentConversation && (
                <>
                  {currentConversation.other_user?.avatar ? (
                    <img src={currentConversation.other_user.avatar} alt="" className="h-10 w-10 rounded-full" />
                  ) : (
                    <div className="h-10 w-10 rounded-full bg-gray-200 flex items-center justify-center text-sm font-semibold">
                      {(currentConversation.other_user?.username || "U").slice(0, 1).toUpperCase()}
                    </div>
                  )}
                  <div className="flex-1">
                    <div className="font-semibold text-gray-900">
                      {currentConversation.other_user?.username || currentConversation.campaign}
                    </div>
                    {currentConversation.campaign && (
                      <div className="text-sm text-gray-500">{currentConversation.campaign}</div>
                    )}
                  </div>
                </>
              )}
            </div>

            {/* Messages */}
            <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-4">
              {messageLoading ? (
                <div className="flex items-center justify-center h-full text-gray-400">
                  <Loader2 className="h-5 w-5 animate-spin mr-2" />
                </div>
              ) : messages.length === 0 ? (
                <div className="flex items-center justify-center h-full text-gray-400 text-sm">
                  {t("messages.no_messages", "Aucun message")}
                </div>
              ) : (
                messages.map(msg => (
                  <div
                    key={msg.id}
                    className={cn(
                      'flex gap-2',
                      msg.sender === user?.id ? 'justify-end' : 'justify-start'
                    )}
                  >
                    <div
                      className={cn(
                        'max-w-xs px-4 py-2 rounded-lg',
                        msg.sender === user?.id
                          ? 'bg-indigo-600 text-white'
                          : 'bg-gray-100 text-gray-900'
                      )}
                    >
                      {msg.content && (
                        isGifMessage(msg.content) ? (
                          <img
                            src={msg.content}
                            alt="GIF"
                            className="max-h-48 rounded-md"
                          />
                        ) : (
                          <p className="text-sm whitespace-pre-wrap">{msg.content}</p>
                        )
                      )}
                      {msg.attachments && (
                        <div className={cn(msg.content ? "mt-2" : "")}> 
                          {isImageBlob(attachmentBlobUrls[msg.id]) ? (
                            <a href={attachmentBlobUrls[msg.id]!.url} target="_blank" rel="noreferrer">
                              <img
                                src={attachmentBlobUrls[msg.id]!.url}
                                alt={t("messages.attachment_preview", "Attachment")}
                                className="max-h-56 max-w-xs rounded-md border border-black/10 object-cover"
                              />
                            </a>
                          ) : attachmentBlobUrls[msg.id] ? (
                            <a
                              href={attachmentBlobUrls[msg.id]!.url}
                              target="_blank"
                              rel="noreferrer"
                              download
                              className={cn(
                                "inline-flex items-center gap-1 text-xs underline",
                                msg.sender === user?.id ? "text-indigo-100" : "text-indigo-700"
                              )}
                            >
                              <Paperclip className="h-3 w-3" />
                              {t("messages.open_attachment", "Open attachment")}
                            </a>
                          ) : (
                            <span className={cn("text-xs", msg.sender === user?.id ? "text-indigo-100" : "text-gray-500")}>
                              {t("common.loading")}
                            </span>
                          )}
                        </div>
                      )}
                      <p className={cn(
                        'text-xs mt-1',
                        msg.sender === user?.id ? 'text-indigo-100' : 'text-gray-500'
                      )}>
                        {new Date(msg.created_at).toLocaleTimeString([], {
                          hour: '2-digit',
                          minute: '2-digit'
                        })}
                      </p>
                    </div>
                  </div>
                ))
              )}
              <div ref={messagesEndRef} />
            </div>

            {/* Message input */}
            <div className="border-t border-gray-200 p-4 sm:p-6 relative">
              {/* Emoji picker */}
              {showEmojiPicker && (
                <div
                  ref={emojiPickerRef}
                  className="absolute bottom-full left-4 mb-2 z-50 shadow-xl rounded-xl overflow-hidden"
                >
                  <EmojiPicker
                    theme={Theme.AUTO}
                    onEmojiClick={(data: EmojiClickData) => {
                      setCurrentMessage(prev => prev + data.emoji)
                      setShowEmojiPicker(false)
                    }}
                    searchPlaceholder={t('messages.search_emoji', 'Rechercher...')}
                    width={320}
                    height={380}
                  />
                </div>
              )}

              {/* GIF picker */}
              {showGifPicker && (
                <div
                  ref={gifPickerRef}
                  className="absolute bottom-full left-4 right-4 mb-2 z-50 bg-white dark:bg-gray-900 border border-gray-200 rounded-xl shadow-xl flex flex-col"
                  style={{ height: 340 }}
                >
                  <div className="p-2 border-b border-gray-100">
                    <input
                      type="text"
                      value={gifSearch}
                      onChange={e => setGifSearch(e.target.value)}
                      placeholder={t('messages.search_gif', 'Rechercher un GIF...')}
                      className="w-full rounded-lg border border-gray-200 px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400"
                      autoFocus
                    />
                  </div>
                  <div className="flex-1 overflow-y-auto p-2">
                    {gifLoading ? (
                      <div className="flex items-center justify-center h-full text-gray-400">
                        <Loader2 className="h-5 w-5 animate-spin" />
                      </div>
                    ) : gifs.length === 0 ? (
                      <div className="flex items-center justify-center h-full text-gray-400 text-sm">
                        {t('messages.no_gifs', 'Aucun GIF trouvé')}
                      </div>
                    ) : (
                      <div className="grid grid-cols-3 gap-1.5">
                        {gifs.map(gif => (
                          <button
                            key={gif.id}
                            onClick={() => sendGif(gif.images.original.url)}
                            className="rounded-md overflow-hidden hover:ring-2 hover:ring-indigo-400 transition-all"
                          >
                            <img
                              src={gif.images.fixed_width.url}
                              alt={gif.title}
                              className="w-full h-20 object-cover"
                              loading="lazy"
                            />
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                  <div className="px-3 py-1.5 border-t border-gray-100 text-xs text-gray-400 text-right">
                    Powered by GIPHY
                  </div>
                </div>
              )}

              {selectedFile && (
                <div className="mb-3 inline-flex items-center gap-2 rounded-md border border-gray-200 bg-gray-50 px-2 py-1 text-xs text-gray-700">
                  <Paperclip className="h-3 w-3" />
                  <span className="max-w-[220px] truncate">{selectedFile.name}</span>
                  <button
                    type="button"
                    className="rounded p-0.5 hover:bg-gray-200"
                    onClick={() => setSelectedFile(null)}
                    title={t("messages.remove_attachment", "Remove attachment")}
                  >
                    <X className="h-3 w-3" />
                  </button>
                </div>
              )}
              <div className="flex gap-2">
                <input
                  ref={fileInputRef}
                  type="file"
                  className="hidden"
                  onChange={(e) => setSelectedFile(e.target.files?.[0] ?? null)}
                />
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={sendingMessage}
                  title={t("messages.add_attachment", "Add attachment")}
                >
                  <Paperclip className="h-4 w-4" />
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => { setShowEmojiPicker(v => !v); setShowGifPicker(false) }}
                  disabled={sendingMessage}
                  title={t("messages.add_emoji", "Ajouter un emoji")}
                  className={cn(showEmojiPicker && "bg-indigo-50 border-indigo-300")}
                >
                  <Smile className="h-4 w-4" />
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => { setShowGifPicker(v => !v); setShowEmojiPicker(false) }}
                  disabled={sendingMessage}
                  title={t("messages.add_gif", "Ajouter un GIF")}
                  className={cn("text-xs font-bold", showGifPicker && "bg-indigo-50 border-indigo-300")}
                >
                  GIF
                </Button>
                <Input
                  placeholder={t("messages.type_message", "Écrire un message...")}
                  value={currentMessage}
                  onChange={e => setCurrentMessage(e.target.value)}
                  onKeyPress={e => e.key === 'Enter' && handleSendMessage()}
                  disabled={messageLoading || sendingMessage}
                  className="flex-1"
                />
                <Button
                  onClick={handleSendMessage}
                  disabled={(!currentMessage.trim() && !selectedFile) || sendingMessage}
                  className="gap-2"
                >
                  <Send className="h-4 w-4" />
                  <span className="hidden sm:inline">{t("common.send", "Envoyer")}</span>
                </Button>
              </div>
            </div>
          </div>
        ) : (
          <div className="hidden sm:flex flex-1 items-center justify-center text-gray-400">
            <p className="text-center">
              {t("messages.select_conversation", "Sélectionnez une conversation")}
            </p>
          </div>
        )}
      </div>
    </div>
  )
}
