import { useState } from "react"
import { useParams, useNavigate } from "react-router-dom"
import { useTranslation } from "react-i18next"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { useToast } from "@/hooks/use-toast"
import { ArrowLeft, CheckCircle, XCircle, ExternalLink } from "lucide-react"

export default function ValidateContent() {
  const { id, proposalId } = useParams<{ id: string; proposalId: string }>()
  const { t } = useTranslation()
  const navigate = useNavigate()
  const { toast } = useToast()
  const [decision, setDecision] = useState<"approved" | "rejected" | null>(null)
  const [feedback, setFeedback] = useState("")

  const handleDecision = (action: "approved" | "rejected") => {
    setDecision(action)
    toast({ title: action === "approved" ? "Content approved! Payment released." : "Content rejected. Influencer notified.", variant: action === "approved" ? "default" : "destructive" })
    setTimeout(() => navigate(`/brand/campaigns/${id}`), 1500)
  }

  return (
    <div className="p-6 max-w-3xl mx-auto space-y-6">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="sm" onClick={() => navigate(-1)}><ArrowLeft className="h-4 w-4 mr-1" />{t("common.back")}</Button>
        <h1 className="text-xl font-bold text-gray-900">Validate Content — Proposal #{proposalId}</h1>
      </div>

      <Card className="card-base">
        <CardHeader><CardTitle>Content Preview</CardTitle></CardHeader>
        <CardContent>
          <div className="bg-gray-100 rounded-xl aspect-video flex items-center justify-center mb-4">
            <div className="text-center text-gray-400">
              <ExternalLink className="h-12 w-12 mx-auto mb-2 opacity-50" />
              <p className="text-sm">Content preview would appear here</p>
              <a href="#" className="text-indigo-600 text-sm hover:underline mt-1 block">View on Instagram →</a>
            </div>
          </div>
          <div className="space-y-3">
            <div className="p-3 bg-gray-50 rounded-xl text-sm">
              <p className="font-semibold text-gray-700 mb-1">Caption</p>
              <p className="text-gray-600">✨ Summer vibes with @FashionBrand's new collection! Loving these sustainable pieces that are perfect for any occasion. Use code SOPHIE15 for 15% off! #SummerFashion #Sustainable #FashionBrand</p>
            </div>
            <div className="grid grid-cols-3 gap-3 text-sm">
              <div className="p-3 bg-gray-50 rounded-xl text-center"><p className="text-gray-500 text-xs">Platform</p><p className="font-semibold">Instagram</p></div>
              <div className="p-3 bg-gray-50 rounded-xl text-center"><p className="text-gray-500 text-xs">Type</p><p className="font-semibold">Post + Story</p></div>
              <div className="p-3 bg-gray-50 rounded-xl text-center"><p className="text-gray-500 text-xs">Submitted</p><p className="font-semibold">Mar 15, 2024</p></div>
            </div>
          </div>
        </CardContent>
      </Card>

      {!decision && (
        <Card className="card-base">
          <CardHeader><CardTitle className="text-base">Your Feedback</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <textarea
              className="w-full min-h-[100px] rounded-md border border-input bg-background px-3 py-2 text-sm resize-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              placeholder="Optional feedback for the influencer..."
              value={feedback}
              onChange={(e) => setFeedback(e.target.value)}
            />
            <div className="flex gap-3">
              <Button className="flex-1" variant="gradient" onClick={() => handleDecision("approved")}>
                <CheckCircle className="h-4 w-4 mr-2" />Approve & Release Payment
              </Button>
              <Button className="flex-1" variant="destructive" onClick={() => handleDecision("rejected")}>
                <XCircle className="h-4 w-4 mr-2" />Request Changes
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
      {decision && (
        <div className={`p-6 rounded-2xl text-center ${decision === "approved" ? "bg-green-50 border border-green-200" : "bg-red-50 border border-red-200"}`}>
          <p className={`text-lg font-semibold ${decision === "approved" ? "text-green-700" : "text-red-700"}`}>
            {decision === "approved" ? "✅ Content Approved — Payment Released!" : "❌ Revision Requested"}
          </p>
          <p className="text-sm text-gray-500 mt-1">Redirecting...</p>
        </div>
      )}
    </div>
  )
}
