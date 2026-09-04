import { useEffect, useRef, useState } from "react"
import { useTranslation } from "react-i18next"
import api from "@/lib/api"
import { openProtectedFile } from "@/lib/apiExtra"
import { Button } from "@/components/ui/button"
import { useToast } from "@/hooks/use-toast"
import { FileText, Image as ImageIcon, Loader2, Paperclip, Trash2, Upload } from "lucide-react"

const MAX_DOCUMENTS = 5

export interface CampaignDocument {
  id: number
  file: string
  file_name: string
  label: string
  created_at: string
}

interface CampaignDocumentsProps {
  campaignId: number
  /** Brands can upload/delete; influencers get a read-only list. */
  canManage?: boolean
}

export function CampaignDocuments({ campaignId, canManage = false }: CampaignDocumentsProps) {
  const { t } = useTranslation()
  const { toast } = useToast()
  const inputRef = useRef<HTMLInputElement>(null)
  const [documents, setDocuments] = useState<CampaignDocument[]>([])
  const [loading, setLoading] = useState(true)
  const [uploading, setUploading] = useState(false)

  const load = async () => {
    try {
      const r = await api.get(`/campaigns/${campaignId}/documents/`)
      setDocuments(r.data as CampaignDocument[])
    } catch {
      setDocuments([])
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [campaignId])

  const handleUpload = async (file: File) => {
    setUploading(true)
    try {
      const formData = new FormData()
      formData.append("file", file)
      const r = await api.post(`/campaigns/${campaignId}/documents/`, formData)
      setDocuments((prev) => [...prev, r.data as CampaignDocument])
      toast({ title: t("campaign_documents.uploaded") })
    } catch (e: any) {
      toast({
        variant: "destructive",
        title: t("common.error"),
        description: e?.response?.data?.detail || e?.response?.data?.file,
      })
    } finally {
      setUploading(false)
      if (inputRef.current) inputRef.current.value = ""
    }
  }

  const handleDelete = async (id: number) => {
    try {
      await api.delete(`/campaigns/documents/${id}/`)
      setDocuments((prev) => prev.filter((d) => d.id !== id))
    } catch (e: any) {
      toast({ variant: "destructive", title: t("common.error"), description: e?.response?.data?.detail })
    }
  }

  const isImage = (name: string) => /\.(jpe?g|png|gif|webp)$/i.test(name)
  const atLimit = documents.length >= MAX_DOCUMENTS

  if (loading) {
    return <div className="flex items-center text-sm text-aurora-ink-3"><Loader2 className="h-4 w-4 animate-spin mr-2" />{t("common.loading")}</div>
  }

  if (!canManage && documents.length === 0) return null

  return (
    <div className="space-y-3">
      {documents.length === 0 ? (
        <p className="text-sm text-aurora-ink-3">{t("campaign_documents.empty")}</p>
      ) : (
        <ul className="space-y-2">
          {documents.map((doc) => (
            <li key={doc.id} className="flex items-center gap-2 rounded-xl border border-aurora-line px-3 py-2">
              {isImage(doc.file_name)
                ? <ImageIcon className="h-4 w-4 text-aurora-ink-3 shrink-0" />
                : <FileText className="h-4 w-4 text-aurora-ink-3 shrink-0" />}
              <button
                type="button"
                onClick={() => openProtectedFile(doc.file)}
                className="flex-1 min-w-0 truncate text-left text-sm text-aurora-blue hover:underline"
              >
                {doc.label || doc.file_name}
              </button>
              {canManage && (
                <Button variant="ghost" size="icon" onClick={() => handleDelete(doc.id)} aria-label={t("common.delete")}>
                  <Trash2 className="h-4 w-4 text-red-500" />
                </Button>
              )}
            </li>
          ))}
        </ul>
      )}

      {canManage && (
        <div className="flex items-center gap-3">
          <input
            ref={inputRef}
            type="file"
            accept=".pdf,.jpg,.jpeg,.png,.gif,.webp"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0]
              if (file) handleUpload(file)
            }}
          />
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={uploading || atLimit}
            onClick={() => inputRef.current?.click()}
          >
            {uploading ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Upload className="h-4 w-4 mr-2" />}
            {t("campaign_documents.add")}
          </Button>
          <span className="text-xs text-aurora-ink-3 flex items-center gap-1">
            <Paperclip className="h-3 w-3" />
            {t("campaign_documents.counter", { count: documents.length, max: MAX_DOCUMENTS })}
          </span>
        </div>
      )}
    </div>
  )
}
