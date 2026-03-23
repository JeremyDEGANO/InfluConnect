import { useState } from "react"
import { useParams, useNavigate } from "react-router-dom"
import { useTranslation } from "react-i18next"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { StatusBadge } from "@/components/shared/StatusBadge"
import { MessageThread } from "@/components/shared/MessageThread"
import { useToast } from "@/hooks/use-toast"
import { ArrowLeft, CheckCircle, XCircle, MessageSquare } from "lucide-react"

interface Message {
  id: number
  sender_name: string
  content: string
  created_at: string
  is_mine: boolean
}

const MOCK_MESSAGES: Message[] = [
  { id: 1, sender_name: "FashionBrand", content: "Hi! We love your profile and would love to collaborate on our Summer Collection.", created_at: "2024-03-01T10:00:00", is_mine: false },
  { id: 2, sender_name: "You", content: "Thank you! I'd love to hear more about the campaign details.", created_at: "2024-03-01T10:15:00", is_mine: true },
  { id: 3, sender_name: "FashionBrand", content: "We're looking for 2 Instagram posts + 3 stories featuring our new summer line. Budget €250.", created_at: "2024-03-01T10:20:00", is_mine: false },
]

export default function ProposalDetail() {
  const { id } = useParams<{ id: string }>()
  const { t } = useTranslation()
  const navigate = useNavigate()
  const { toast } = useToast()
  const [messages, setMessages] = useState<Message[]>(MOCK_MESSAGES)
  const [status, setStatus] = useState<"pending" | "accepted" | "declined">("pending")

  const handleAction = (action: "accept" | "decline") => {
    setStatus(action === "accept" ? "accepted" : "declined")
    toast({ title: action === "accept" ? "Proposal accepted!" : "Proposal declined", variant: action === "accept" ? "default" : "destructive" })
  }

  const handleSend = (content: string) => {
    setMessages((prev) => [...prev, { id: Date.now(), sender_name: "You", content, created_at: new Date().toISOString(), is_mine: true }])
  }

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-6">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="sm" onClick={() => navigate(-1)}><ArrowLeft className="h-4 w-4 mr-1" />{t("common.back")}</Button>
        <h1 className="text-xl font-bold text-gray-900">Proposal #{id}</h1>
      </div>

      <div className="grid lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-4">
          <Card className="card-base">
            <CardHeader>
              <div className="flex items-start justify-between">
                <div>
                  <CardTitle>Summer Collection 2024</CardTitle>
                  <p className="text-sm text-gray-500 mt-1">by FashionBrand</p>
                </div>
                <StatusBadge status={status} />
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div>
                  <h4 className="font-semibold text-sm text-gray-700 mb-1">Campaign Brief</h4>
                  <p className="text-sm text-gray-600 leading-relaxed">
                    We're launching our Summer Collection 2024 and looking for fashion-forward influencers to showcase our latest pieces. We need authentic content that resonates with your audience.
                  </p>
                </div>
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div className="p-3 bg-gray-50 rounded-xl">
                    <p className="text-gray-500 text-xs">Deliverables</p>
                    <p className="font-semibold mt-1">2 Posts + 3 Stories</p>
                  </div>
                  <div className="p-3 bg-gray-50 rounded-xl">
                    <p className="text-gray-500 text-xs">Budget</p>
                    <p className="font-semibold mt-1 text-green-700">€250</p>
                  </div>
                  <div className="p-3 bg-gray-50 rounded-xl">
                    <p className="text-gray-500 text-xs">Deadline</p>
                    <p className="font-semibold mt-1">March 31, 2024</p>
                  </div>
                  <div className="p-3 bg-gray-50 rounded-xl">
                    <p className="text-gray-500 text-xs">Platform</p>
                    <p className="font-semibold mt-1">Instagram</p>
                  </div>
                </div>
                {status === "pending" && (
                  <div className="flex gap-3 pt-2">
                    <Button className="flex-1" variant="gradient" onClick={() => handleAction("accept")}>
                      <CheckCircle className="h-4 w-4 mr-2" />{t("proposals.accept")}
                    </Button>
                    <Button className="flex-1" variant="destructive" onClick={() => handleAction("decline")}>
                      <XCircle className="h-4 w-4 mr-2" />{t("proposals.decline")}
                    </Button>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          <Card className="card-base">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <MessageSquare className="h-4 w-4" />Messages
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <MessageThread messages={messages} onSend={handleSend} />
            </CardContent>
          </Card>
        </div>

        <div>
          <Card className="card-base">
            <CardHeader><CardTitle className="text-base">Brand Info</CardTitle></CardHeader>
            <CardContent>
              <div className="space-y-3 text-sm">
                <div className="h-12 w-12 rounded-xl bg-gradient-to-br from-blue-400 to-indigo-600 flex items-center justify-center text-white font-bold text-lg mb-3">F</div>
                <p className="font-semibold text-gray-900">FashionBrand</p>
                <p className="text-gray-500">Premium fashion brand focused on sustainable, modern clothing.</p>
                <div className="grid grid-cols-2 gap-2 mt-3">
                  <div className="p-2 bg-gray-50 rounded-lg text-center">
                    <div className="font-bold text-gray-900">4.9</div>
                    <div className="text-xs text-gray-500">Rating</div>
                  </div>
                  <div className="p-2 bg-gray-50 rounded-lg text-center">
                    <div className="font-bold text-gray-900">24</div>
                    <div className="text-xs text-gray-500">Campaigns</div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
