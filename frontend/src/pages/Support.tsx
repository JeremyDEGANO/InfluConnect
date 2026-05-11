import { useEffect, useRef, useState } from "react"
import { useTranslation } from "react-i18next"
import {
  fetchSupportTickets,
  createSupportTicket,
  uploadSupportTicketImage,
  addSupportTicketFollowUp,
  rateSupportTicket,
  type SupportTicket,
} from "@/lib/apiExtra"
import api from "@/lib/api"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Loader2, LifeBuoy, ChevronDown, ChevronUp, Plus, ImagePlus, X } from "lucide-react"
import { useToast } from "@/hooks/use-toast"

const STATUS_COLOR: Record<SupportTicket["status"], string> = {
  open: "bg-blue-100 text-blue-700",
  in_progress: "bg-yellow-100 text-yellow-700",
  closed: "bg-green-100 text-green-700",
}

const PRIORITY_COLOR: Record<SupportTicket["priority"], string> = {
  normal: "bg-gray-100 text-gray-600",
  high: "bg-orange-100 text-orange-700",
  urgent: "bg-red-100 text-red-700",
}

function ProtectedImageThumb({ imageUrl }: { imageUrl: string }) {
  const [blobUrl, setBlobUrl] = useState<string | null>(null)

  useEffect(() => {
    let active = true
    let objectUrl: string | null = null

    api.get(imageUrl, { responseType: "blob" })
      .then((res) => {
        if (!active) return
        objectUrl = window.URL.createObjectURL(res.data)
        setBlobUrl(objectUrl)
      })
      .catch(() => setBlobUrl(null))

    return () => {
      active = false
      if (objectUrl) window.URL.revokeObjectURL(objectUrl)
    }
  }, [imageUrl])

  if (!blobUrl) return null

  return (
    <a href={blobUrl} target="_blank" rel="noopener noreferrer">
      <img src={blobUrl} alt="" className="h-20 w-20 object-cover rounded-lg border border-gray-200 hover:opacity-80 transition-opacity" />
    </a>
  )
}

export default function SupportPage() {
  const { t } = useTranslation()
  const { toast } = useToast()
  const fileInputRef = useRef<HTMLInputElement>(null)

  const [tickets, setTickets] = useState<SupportTicket[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [expandedId, setExpandedId] = useState<string | null>(null)

  const [subject, setSubject] = useState("")
  const [message, setMessage] = useState("")
  const [priority, setPriority] = useState<SupportTicket["priority"]>("normal")
  const [pendingFiles, setPendingFiles] = useState<File[]>([])
  const [previews, setPreviews] = useState<string[]>([])
  const [followUps, setFollowUps] = useState<Record<number, string>>({})
  const [ratingDrafts, setRatingDrafts] = useState<Record<number, string>>({})
  const imageInputRefs = useRef<Record<number, HTMLInputElement | null>>({})

  const load = () => {
    setLoading(true)
    fetchSupportTickets()
      .then(setTickets)
      .finally(() => setLoading(false))
  }

  useEffect(load, [])

  const handleFiles = (files: FileList | null) => {
    if (!files) return
    const current = pendingFiles.length
    const allowed = Math.min(files.length, 5 - current)
    if (allowed <= 0) return
    const added = Array.from(files).slice(0, allowed)
    setPendingFiles((prev) => [...prev, ...added])
    added.forEach((f) => {
      const reader = new FileReader()
      reader.onload = (e) => setPreviews((prev) => [...prev, e.target?.result as string])
      reader.readAsDataURL(f)
    })
  }

  const removeFile = (idx: number) => {
    setPendingFiles((prev) => prev.filter((_, i) => i !== idx))
    setPreviews((prev) => prev.filter((_, i) => i !== idx))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!subject.trim() || !message.trim()) return
    setSubmitting(true)
    try {
      const ticket = await createSupportTicket({ subject: subject.trim(), message: message.trim(), priority })
      let uploadFailures = 0
      // Upload images sequentially
      for (const file of pendingFiles) {
        try {
          await uploadSupportTicketImage(ticket.id, file)
        } catch {
          uploadFailures += 1
        }
      }
      if (uploadFailures > 0) {
        toast({
          variant: "destructive",
          title: t("support.submitted"),
          description: t("support.upload_partial_error", { failed: uploadFailures, total: pendingFiles.length }),
        })
      } else {
        toast({ title: t("support.submitted") })
      }
      setSubject("")
      setMessage("")
      setPriority("normal")
      setPendingFiles([])
      setPreviews([])
      setShowForm(false)
      load()
    } catch {
      toast({ variant: "destructive", title: t("common.error") })
    } finally {
      setSubmitting(false)
    }
  }

  const toggleExpanded = (ticketId: number) => {
    const nextId = String(ticketId)
    setExpandedId((current) => (current === nextId ? null : nextId))
  }

  const uploadMoreImages = async (ticketId: number, files: FileList | null) => {
    if (!files || files.length === 0) return
    let failures = 0
    for (const file of Array.from(files)) {
      try {
        await uploadSupportTicketImage(ticketId, file)
      } catch {
        failures += 1
      }
    }
    if (failures > 0) {
      toast({ variant: "destructive", title: t("common.error"), description: t("support.upload_partial_error", { failed: failures, total: files.length }) })
    } else {
      toast({ title: t("support.images_added", { count: files.length }) })
    }
    load()
  }

  const submitFollowUp = async (ticketId: number) => {
    const message = (followUps[ticketId] || "").trim()
    if (!message) return
    try {
      await addSupportTicketFollowUp(ticketId, message)
      setFollowUps((prev) => ({ ...prev, [ticketId]: "" }))
      toast({ title: t("support.followup_sent") })
      load()
    } catch {
      toast({ variant: "destructive", title: t("common.error") })
    }
  }

  const submitRating = async (ticketId: number) => {
    const value = Number(ratingDrafts[ticketId])
    if (!Number.isInteger(value) || value < 1 || value > 5) return
    try {
      await rateSupportTicket(ticketId, value)
      toast({ title: t("support.rating_saved") })
      load()
    } catch {
      toast({ variant: "destructive", title: t("common.error") })
    }
  }

  return (
    <div className="p-6 max-w-3xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <LifeBuoy className="h-6 w-6 text-indigo-500" />
          <h1 className="text-2xl font-bold text-gray-900">{t("support.title")}</h1>
        </div>
        <Button
          variant="gradient"
          size="sm"
          onClick={() => setShowForm((v) => !v)}
        >
          <Plus className="h-4 w-4 mr-1" />
          {t("support.new_ticket")}
        </Button>
      </div>

      {showForm && (
        <Card className="card-base">
          <CardHeader>
            <CardTitle className="text-base">{t("support.new_ticket")}</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">{t("support.subject")}</label>
                <Input
                  value={subject}
                  onChange={(e) => setSubject(e.target.value)}
                  placeholder={t("support.subject_placeholder")}
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">{t("support.message")}</label>
                <textarea
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  placeholder={t("support.message_placeholder")}
                  rows={5}
                  required
                  className="w-full rounded-md border border-gray-200 px-3 py-2 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">{t("support.priority")}</label>
                <select
                  value={priority}
                  onChange={(e) => setPriority(e.target.value as SupportTicket["priority"])}
                  className="h-9 rounded-md border border-gray-200 px-2 text-sm w-full"
                >
                  <option value="normal">{t("admin_support.priority_normal")}</option>
                  <option value="high">{t("admin_support.priority_high")}</option>
                  <option value="urgent">{t("admin_support.priority_urgent")}</option>
                </select>
              </div>

              {/* Image attachments */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">{t("support.attachments")} ({pendingFiles.length}/5)</label>
                {previews.length > 0 && (
                  <div className="flex flex-wrap gap-2 mb-2">
                    {previews.map((src, i) => (
                      <div key={i} className="relative group">
                        <img src={src} alt="" className="h-20 w-20 object-cover rounded-lg border border-gray-200" />
                        <button
                          type="button"
                          onClick={() => removeFile(i)}
                          className="absolute -top-1.5 -right-1.5 bg-white rounded-full border border-gray-200 p-0.5 shadow-sm opacity-0 group-hover:opacity-100 transition-opacity"
                        >
                          <X className="h-3 w-3 text-gray-600" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
                {pendingFiles.length < 5 && (
                  <>
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept="image/*"
                      multiple
                      className="hidden"
                      onChange={(e) => handleFiles(e.target.files)}
                    />
                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      className="flex items-center gap-2 text-sm text-indigo-600 border border-dashed border-indigo-300 rounded-lg px-4 py-2 hover:bg-indigo-50 transition-colors"
                    >
                      <ImagePlus className="h-4 w-4" />
                      {t("support.add_image")}
                    </button>
                  </>
                )}
              </div>

              <div className="flex justify-end gap-2">
                <Button type="button" variant="outline" size="sm" onClick={() => setShowForm(false)}>
                  {t("common.cancel")}
                </Button>
                <Button type="submit" variant="gradient" size="sm" disabled={submitting}>
                  {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : t("support.send")}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}

      {loading ? (
        <div className="flex items-center justify-center h-48 text-gray-400">
          <Loader2 className="h-6 w-6 animate-spin mr-2" />{t("common.loading")}
        </div>
      ) : tickets.length === 0 ? (
        <div className="text-center py-16 text-gray-400">
          <LifeBuoy className="h-10 w-10 mx-auto mb-3 opacity-30" />
          <p>{t("support.no_tickets")}</p>
          <p className="text-sm mt-1">{t("support.no_tickets_desc")}</p>
        </div>
      ) : (
        <div className="space-y-3">
          {tickets.map((ticket) => (
            <Card key={ticket.id} className="card-base">
              <button
                type="button"
                className="w-full text-left"
                onClick={() => toggleExpanded(ticket.id)}
              >
                <div className="p-4 flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-gray-900 truncate">{ticket.subject}</p>
                    <p className="text-xs text-gray-400 mt-0.5">
                      {new Date(ticket.created_at).toLocaleDateString()}
                    </p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${PRIORITY_COLOR[ticket.priority]}`}>
                      {t(`admin_support.priority_${ticket.priority}`)}
                    </span>
                    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_COLOR[ticket.status]}`}>
                      {t(`admin_support.status_${ticket.status}`)}
                    </span>
                    {expandedId === String(ticket.id)
                      ? <ChevronUp className="h-4 w-4 text-gray-400" />
                      : <ChevronDown className="h-4 w-4 text-gray-400" />
                    }
                  </div>
                </div>
              </button>

              {expandedId === String(ticket.id) && (
                <div className="border-t border-gray-100 px-4 pb-4 pt-3 space-y-3">
                  <div>
                    <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-1">{t("support.your_message")}</p>
                    <p className="text-sm text-gray-700 whitespace-pre-wrap">{ticket.message}</p>
                  </div>

                  {/* Images du ticket */}
                  {ticket.images && ticket.images.length > 0 && (
                    <div className="flex flex-wrap gap-2">
                      {ticket.images.map((img) => (
                        <ProtectedImageThumb key={img.id} imageUrl={img.image_url} />
                      ))}
                    </div>
                  )}

                  {/* Follow-up note + extra images */}
                  {ticket.status !== "closed" && (
                    <div className="space-y-3 rounded-lg border border-dashed border-indigo-200 bg-indigo-50/30 p-3">
                      <div>
                        <p className="text-xs font-medium text-indigo-600 uppercase tracking-wide mb-1">{t("support.followup_label")}</p>
                        <textarea
                          value={followUps[ticket.id] ?? ""}
                          onChange={(e) => setFollowUps((prev) => ({ ...prev, [ticket.id]: e.target.value }))}
                          rows={3}
                          placeholder={t("support.followup_placeholder")}
                          className="w-full rounded-md border border-indigo-200 bg-white px-3 py-2 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                        />
                        <div className="mt-2 flex justify-end">
                          <Button size="sm" variant="gradient" onClick={() => submitFollowUp(ticket.id)} disabled={!(followUps[ticket.id] || "").trim()}>
                            {t("support.followup_send")}
                          </Button>
                        </div>
                      </div>

                      <div>
                        <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-1">{t("support.extra_images")}</p>
                        <input
                          ref={(el) => { imageInputRefs.current[ticket.id] = el }}
                          type="file"
                          accept="image/*"
                          multiple
                          className="hidden"
                          onChange={(e) => uploadMoreImages(ticket.id, e.target.files)}
                        />
                        <Button type="button" variant="outline" size="sm" onClick={() => imageInputRefs.current[ticket.id]?.click()}>
                          <ImagePlus className="h-4 w-4 mr-1" />
                          {t("support.add_image")}
                        </Button>
                      </div>
                    </div>
                  )}

                  {/* Final rating */}
                  {ticket.status === "closed" && (
                    <div className="rounded-lg border border-amber-200 bg-amber-50/50 p-3 space-y-3">
                      <p className="text-xs font-medium text-amber-700 uppercase tracking-wide">{t("support.rating_title")}</p>
                      {ticket.rating ? (
                        <p className="text-sm text-gray-700">{t("support.rating_current", { rating: ticket.rating })}</p>
                      ) : (
                        <>
                          <select
                            className="h-9 rounded-md border border-amber-200 px-2 text-sm bg-white"
                            value={ratingDrafts[ticket.id] ?? ""}
                            onChange={(e) => setRatingDrafts((prev) => ({ ...prev, [ticket.id]: e.target.value }))}
                          >
                            <option value="">{t("support.rating_select")}</option>
                            <option value="1">1</option>
                            <option value="2">2</option>
                            <option value="3">3</option>
                            <option value="4">4</option>
                            <option value="5">5</option>
                          </select>
                          <div>
                            <Button size="sm" variant="gradient" onClick={() => submitRating(ticket.id)} disabled={!ratingDrafts[ticket.id]}>
                              {t("support.rating_send")}
                            </Button>
                          </div>
                        </>
                      )}
                    </div>
                  )}

                  {/* Réponse admin */}
                  {ticket.admin_reply ? (
                    <div className="rounded-lg bg-indigo-50 border border-indigo-100 p-3">
                      <p className="text-xs font-medium text-indigo-600 uppercase tracking-wide mb-1">{t("support.admin_reply")}</p>
                      <p className="text-sm text-gray-700 whitespace-pre-wrap">{ticket.admin_reply}</p>
                    </div>
                  ) : ticket.status !== "closed" ? (
                    <p className="text-xs text-gray-400 italic">{t("support.awaiting_reply")}</p>
                  ) : null}
                </div>
              )}
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}
