import { useState } from "react"
import { Send } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { cn } from "@/lib/utils"

interface Message {
  id: number
  sender_name: string
  content: string
  created_at: string
  is_mine: boolean
}

interface MessageThreadProps {
  messages: Message[]
  onSend: (content: string) => void
}

export function MessageThread({ messages, onSend }: MessageThreadProps) {
  const [text, setText] = useState("")

  const handleSend = () => {
    if (!text.trim()) return
    onSend(text.trim())
    setText("")
  }

  return (
    <div className="flex flex-col h-96">
      <div className="flex-1 overflow-y-auto space-y-3 p-4">
        {messages.map((msg) => (
          <div key={msg.id} className={cn("flex gap-2", msg.is_mine && "flex-row-reverse")}>
            <Avatar className="h-8 w-8 shrink-0">
              <AvatarFallback className={cn("text-xs text-white font-semibold", msg.is_mine ? "bg-gradient-to-br from-indigo-500 to-violet-600" : "bg-gray-400")}>
                {msg.sender_name.slice(0, 2).toUpperCase()}
              </AvatarFallback>
            </Avatar>
            <div className={cn("max-w-[70%] rounded-2xl px-4 py-2", msg.is_mine ? "bg-gradient-to-r from-indigo-600 to-violet-600 text-white rounded-tr-sm" : "bg-gray-100 text-gray-900 rounded-tl-sm")}>
              <p className="text-sm">{msg.content}</p>
              <p className={cn("text-xs mt-1", msg.is_mine ? "text-indigo-200" : "text-gray-400")}>
                {new Date(msg.created_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
              </p>
            </div>
          </div>
        ))}
        {messages.length === 0 && (
          <div className="text-center text-gray-400 text-sm py-8">No messages yet. Start the conversation!</div>
        )}
      </div>
      <div className="border-t p-3 flex gap-2">
        <Input
          placeholder="Type a message..."
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && handleSend()}
          className="flex-1"
        />
        <Button size="icon" variant="gradient" onClick={handleSend} disabled={!text.trim()}>
          <Send className="h-4 w-4" />
        </Button>
      </div>
    </div>
  )
}
