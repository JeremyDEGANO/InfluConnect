import { useEffect, useRef, useState } from "react"
import { useTranslation } from "react-i18next"
import api from "@/lib/api"
import { fetchContractTemplates } from "@/lib/apiExtra"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { useToast } from "@/hooks/use-toast"
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter,
} from "@/components/ui/dialog"
import { ScrollText, Loader2, Plus, Trash2, Upload } from "lucide-react"
import TipTapEditor from "@/components/shared/TipTapEditor"

interface Template {
  id: number
  name: string
  description: string
  body_html: string
  is_default: boolean
  created_at: string
}

export default function ContractTemplates() {
  const { t, i18n } = useTranslation()
  const { toast } = useToast()
  const [items, setItems] = useState<Template[]>([])
  const [loading, setLoading] = useState(true)
  const [open, setOpen] = useState(false)
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState({ name: "", description: "", body_html: "", is_default: false })
  const [preview, setPreview] = useState<Template | null>(null)
  const [importing, setImporting] = useState(false)
  const fileInputRef = useRef<HTMLInputElement | null>(null)

  const load = () => {
    setLoading(true)
    fetchContractTemplates()
      .then((d) => setItems((d as any).results ?? d as Template[]))
      .catch(() => {})
      .finally(() => setLoading(false))
  }
  useEffect(load, [])

  const create = async () => {
    if (!form.name || !form.body_html) {
      toast({ variant: "destructive", title: t("contracts.required") })
      return
    }
    setSaving(true)
    try {
      await api.post("/contract-templates/", form)
      toast({ title: t("contracts.created") })
      setOpen(false)
      setForm({ name: "", description: "", body_html: "", is_default: false })
      load()
    } catch {
      toast({ variant: "destructive", title: t("contracts.error") })
    } finally {
      setSaving(false)
    }
  }

  const remove = async (id: number) => {
    if (!confirm(t("contracts.confirm_delete"))) return
    try {
      await api.delete(`/contract-templates/${id}/`)
      toast({ title: t("contracts.deleted") })
      load()
    } catch {
      toast({ variant: "destructive", title: t("contracts.error") })
    }
  }

  const handleImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    const ext = file.name.toLowerCase().split(".").pop()
    if (ext !== "docx" && ext !== "pdf") {
      toast({ variant: "destructive", title: t("contracts.import_unsupported") })
      if (fileInputRef.current) fileInputRef.current.value = ""
      return
    }
    setImporting(true)
    try {
      const fd = new FormData()
      fd.append("file", file)
      const { data } = await api.post("/contract-templates/import_document/", fd, {
        headers: { "Content-Type": "multipart/form-data" },
      })
      const html = (data as { body_html?: string }).body_html || ""
      setForm((f) => ({
        ...f,
        body_html: html,
        name: f.name || file.name.replace(/\.(docx|pdf)$/i, ""),
      }))
      toast({ title: t("contracts.import_success") })
    } catch {
      toast({ variant: "destructive", title: t("contracts.import_error") })
    } finally {
      setImporting(false)
      if (fileInputRef.current) fileInputRef.current.value = ""
    }
  }

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <ScrollText className="h-6 w-6 text-indigo-500" />{t("contracts.title")}
          </h1>
          <p className="text-sm text-gray-500 mt-1">{t("contracts.subtitle")}</p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button variant="gradient"><Plus className="h-4 w-4 mr-2" />{t("contracts.new")}</Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl">
            <DialogHeader><DialogTitle>{t("contracts.new_title")}</DialogTitle></DialogHeader>
            <div className="space-y-3">
              <div>
                <Label>{t("contracts.name_label")}</Label>
                <Input className="mt-1" placeholder={t("contracts.name_placeholder")} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
              </div>
              <div>
                <Label>{t("contracts.description_label")}</Label>
                <Input className="mt-1" placeholder={t("contracts.description_placeholder")} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
              </div>
              <div>
                <div className="flex items-center justify-between mb-1">
                  <Label>{t("contracts.body_label")}</Label>
                  <div>
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept=".pdf,.docx,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
                      className="hidden"
                      onChange={handleImport}
                    />
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => fileInputRef.current?.click()}
                      disabled={importing}
                    >
                      {importing ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" /> : <Upload className="h-3.5 w-3.5 mr-1" />}
                      {t("contracts.import_file")}
                    </Button>
                  </div>
                </div>
                <TipTapEditor
                  value={form.body_html}
                  onChange={(html) => setForm({ ...form, body_html: html })}
                  placeholder={t("contracts.editor_placeholder")}
                  minHeight="280px"
                />
                <p className="text-[11px] text-gray-400 mt-1">{t("contracts.body_hint")} <code>{"{{brand_name}}"}</code>, <code>{"{{influencer_name}}"}</code>, <code>{"{{price}}"}</code>, <code>{"{{deadline}}"}</code>, <code>{"{{deliverables}}"}</code>.</p>
              </div>
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" checked={form.is_default} onChange={(e) => setForm({ ...form, is_default: e.target.checked })} />
                {t("contracts.default_checkbox")}
              </label>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setOpen(false)}>{t("contracts.cancel")}</Button>
              <Button variant="gradient" onClick={create} disabled={saving}>
                {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : t("contracts.create")}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-20 text-gray-400"><Loader2 className="h-6 w-6 animate-spin mr-2" />{t("contracts.loading")}</div>
      ) : items.length === 0 ? (
        <Card className="card-base"><CardContent className="py-16 text-center text-gray-400">{t("contracts.empty")}</CardContent></Card>
      ) : (
        <div className="grid md:grid-cols-2 gap-4">
          {items.map((tpl) => (
            <Card key={tpl.id} className="card-base">
              <CardHeader>
                <div className="flex items-start justify-between gap-2">
                  <CardTitle className="text-base">{tpl.name}</CardTitle>
                  {tpl.is_default && <Badge variant="success">{t("contracts.default_badge")}</Badge>}
                </div>
                {tpl.description && <p className="text-xs text-gray-500">{tpl.description}</p>}
              </CardHeader>
              <CardContent className="space-y-3">
                <p className="text-xs text-gray-400">{t("contracts.created_at")} {new Date(tpl.created_at).toLocaleDateString(i18n.language)}</p>
                <div className="flex gap-2">
                  <Button size="sm" variant="outline" className="flex-1" onClick={() => setPreview(tpl)}>{t("contracts.preview")}</Button>
                  <Button size="sm" variant="ghost" onClick={() => remove(tpl.id)} className="text-red-600 hover:text-red-700 hover:bg-red-50">
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Dialog open={!!preview} onOpenChange={(o) => !o && setPreview(null)}>
        <DialogContent className="max-w-3xl max-h-[80vh] overflow-y-auto">
          <DialogHeader><DialogTitle>{preview?.name}</DialogTitle></DialogHeader>
          <div className="prose prose-sm max-w-none border rounded-lg p-4 bg-white" dangerouslySetInnerHTML={{ __html: preview?.body_html ?? "" }} />
        </DialogContent>
      </Dialog>
    </div>
  )
}
