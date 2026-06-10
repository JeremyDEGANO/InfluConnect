import { useEffect, useMemo, useState } from "react"
import { useTranslation } from "react-i18next"
import { Link } from "react-router-dom"
import api from "@/lib/api"
import { useToast } from "@/hooks/use-toast"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog"
import { Loader2, Copy, Plus, Trash2, ShieldCheck, Globe, KeyRound, Webhook, BookOpen, ExternalLink } from "lucide-react"

type Domain = { id: number; domain: string; status: string; record_name: string; record_value: string; verified_at: string | null; last_error: string }
type SSOConfig = { provider: string; enabled: boolean; tenant_id: string; client_id: string; has_client_secret: boolean; enforce_sso: boolean; allow_local_fallback_for_owner: boolean; auto_provision_users: boolean; default_role: string }
type ApiKey = { id: number; name: string; prefix: string; scopes: string[]; ip_allowlist: string[]; last_used_at: string | null; expires_at: string | null; revoked_at: string | null; created_at: string }
type Endpoint = { id: number; url: string; events: string[]; enabled: boolean; description: string; last_delivery_at: string | null; last_status: string; secret?: string }
type AuditEntry = { id: number; api_key: string | null; method: string; path: string; status_code: number; ip_address: string | null; latency_ms: number; created_at: string; error: string }
type Delivery = { id: number; event: string; status: string; attempts: number; response_status: number | null; error: string; created_at: string; delivered_at: string | null }

const SCOPES = [
  "campaigns:read", "campaigns:write", "proposals:read", "proposals:write",
  "influencers:read", "influencers:verify", "reporting:read", "contracts:read",
  "webhooks:manage",
]
const EVENTS = [
  "proposal.created", "proposal.accepted", "proposal.declined", "proposal.counter_offer",
  "content.submitted", "content.validated", "content.rejected",
  "contract.signed", "escrow.funded", "payment.released",
  "campaign.status_changed", "influencer.verified", "agency.delegation.accepted",
]

function docsUrl(path: string): string {
  const base = String(api.defaults.baseURL || "/api")
  if (base.startsWith("http://") || base.startsWith("https://")) {
    const root = base.replace(/\/api\/?$/, "")
    return `${root}${path}`
  }
  return path
}

function copy(t: string, toast: ReturnType<typeof useToast>["toast"]) {
  navigator.clipboard?.writeText(t).then(() => toast({ title: "Copied" }))
}

export default function Integrations() {
  const { t } = useTranslation()
  const { toast } = useToast()
  const docsToken = useMemo(() => localStorage.getItem("access_token") || "", [])
  const swaggerHref = useMemo(() => {
    const base = docsUrl("/api/partner/docs/")
    return docsToken ? `${base}?token=${encodeURIComponent(docsToken)}` : base
  }, [docsToken])

  return (
    <div className="container mx-auto p-6 max-w-6xl">
      <div className="mb-6">
        <h1 className="text-2xl font-semibold tracking-tight">{t("integrations.title", "Integrations")}</h1>
        <p className="text-aurora-ink-3 text-sm">{t("integrations.subtitle", "Single Sign-On, API keys, webhooks and audit log.")}</p>
        <div className="mt-2 flex flex-wrap items-center gap-3">
          <Link to="/docs/integrations" className="inline-flex items-center gap-1 text-aurora-blue hover:underline text-sm">
            <BookOpen className="h-4 w-4" /> {t("integrations.read_docs", "Read the integration docs")}
          </Link>
          <a href={swaggerHref} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-aurora-blue hover:underline text-sm">
            <ExternalLink className="h-4 w-4" /> {t("integrations.api_reference", "Open API reference (Swagger)")}
          </a>
        </div>
      </div>
      <Tabs defaultValue="sso" className="w-full">
        <TabsList>
          <TabsTrigger value="sso"><ShieldCheck className="h-4 w-4 mr-1.5" />{t("integrations.tab_sso", "SSO")}</TabsTrigger>
          <TabsTrigger value="domains"><Globe className="h-4 w-4 mr-1.5" />{t("integrations.tab_domains", "Domains")}</TabsTrigger>
          <TabsTrigger value="keys"><KeyRound className="h-4 w-4 mr-1.5" />{t("integrations.tab_keys", "API keys")}</TabsTrigger>
          <TabsTrigger value="webhooks"><Webhook className="h-4 w-4 mr-1.5" />{t("integrations.tab_webhooks", "Webhooks")}</TabsTrigger>
          <TabsTrigger value="audit">{t("integrations.tab_audit", "Audit")}</TabsTrigger>
        </TabsList>
        <TabsContent value="sso"><SSOPane toast={toast} t={t} /></TabsContent>
        <TabsContent value="domains"><DomainsPane toast={toast} t={t} /></TabsContent>
        <TabsContent value="keys"><ApiKeysPane toast={toast} t={t} /></TabsContent>
        <TabsContent value="webhooks"><WebhooksPane toast={toast} t={t} /></TabsContent>
        <TabsContent value="audit"><AuditPane t={t} /></TabsContent>
      </Tabs>
    </div>
  )
}

// ----- SSO -----
function SSOPane({ toast, t }: { toast: ReturnType<typeof useToast>["toast"]; t: ReturnType<typeof useTranslation>["t"] }) {
  const [cfg, setCfg] = useState<SSOConfig | null>(null)
  const [secret, setSecret] = useState("")
  const [saving, setSaving] = useState(false)
  const load = async () => { const { data } = await api.get("/v1/brand/sso/"); setCfg(data) }
  useEffect(() => { load() }, [])
  if (!cfg) return <Loader />
  const save = async () => {
    setSaving(true)
    try {
      const payload: Record<string, unknown> = { ...cfg }
      if (secret) payload.client_secret = secret
      const { data } = await api.put("/v1/brand/sso/", payload)
      setCfg(data); setSecret("")
      toast({ title: t("common.saved", "Saved") })
    } catch (e) {
      const msg = (e as { response?: { data?: { detail?: string } } })?.response?.data?.detail
      toast({ variant: "destructive", title: t("common.error", "Error"), description: msg })
    } finally { setSaving(false) }
  }
  return (
    <Card className="mt-4">
      <CardHeader>
        <CardTitle>{t("sso.title", "Office 365 SSO")}</CardTitle>
        <CardDescription>{t("sso.desc", "Allow your team to log in with their Microsoft work account.")}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid sm:grid-cols-2 gap-4">
          <div><Label>{t("sso.tenant_id", "Tenant ID")}</Label><Input value={cfg.tenant_id} onChange={e => setCfg({ ...cfg, tenant_id: e.target.value })} placeholder="00000000-0000-0000-0000-000000000000" /></div>
          <div><Label>{t("sso.client_id", "Client ID")}</Label><Input value={cfg.client_id} onChange={e => setCfg({ ...cfg, client_id: e.target.value })} /></div>
          <div className="sm:col-span-2"><Label>{t("sso.client_secret", "Client secret")} {cfg.has_client_secret && <Badge variant="outline" className="ml-2">{t("sso.secret_set", "set")}</Badge>}</Label><Input value={secret} onChange={e => setSecret(e.target.value)} placeholder={cfg.has_client_secret ? "•••••••• (unchanged)" : ""} /></div>
        </div>
        <div className="flex flex-wrap gap-4 text-sm">
          <label className="flex items-center gap-2"><input type="checkbox" checked={cfg.enabled} onChange={e => setCfg({ ...cfg, enabled: e.target.checked })} />{t("sso.enable", "Enable SSO")}</label>
          <label className="flex items-center gap-2"><input type="checkbox" checked={cfg.enforce_sso} onChange={e => setCfg({ ...cfg, enforce_sso: e.target.checked })} />{t("sso.enforce", "Enforce (block password login)")}</label>
          <label className="flex items-center gap-2"><input type="checkbox" checked={cfg.allow_local_fallback_for_owner} onChange={e => setCfg({ ...cfg, allow_local_fallback_for_owner: e.target.checked })} />{t("sso.fallback_owner", "Allow owner fallback")}</label>
          <label className="flex items-center gap-2"><input type="checkbox" checked={cfg.auto_provision_users} onChange={e => setCfg({ ...cfg, auto_provision_users: e.target.checked })} />{t("sso.auto_provision", "Auto-provision users")}</label>
        </div>
        <p className="text-xs text-aurora-ink-3">{t("sso.redirect_hint", "Redirect URI to set in Azure:")} <code>{window.location.origin.replace("5173", "8000")}/api/auth/sso/office365/callback/</code></p>
        <Button onClick={save} disabled={saving}>{saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}{t("common.save", "Save")}</Button>
      </CardContent>
    </Card>
  )
}

// ----- Domains -----
function DomainsPane({ toast, t }: { toast: ReturnType<typeof useToast>["toast"]; t: ReturnType<typeof useTranslation>["t"] }) {
  const [items, setItems] = useState<Domain[]>([])
  const [newDom, setNewDom] = useState("")
  const [loading, setLoading] = useState(true)
  const load = async () => { setLoading(true); const { data } = await api.get("/v1/brand/domains/"); setItems(data); setLoading(false) }
  useEffect(() => { load() }, [])
  const add = async () => {
    if (!newDom) return
    try { await api.post("/v1/brand/domains/", { domain: newDom }); setNewDom(""); await load() }
    catch (e) { toast({ variant: "destructive", title: t("common.error", "Error"), description: (e as { response?: { data?: { detail?: string } } })?.response?.data?.detail }) }
  }
  const verify = async (id: number) => { try { await api.post(`/v1/brand/domains/${id}/verify/`); await load(); toast({ title: t("domains.verify_started", "Verification ran") }) } catch (e) { toast({ variant: "destructive", title: t("common.error", "Error"), description: (e as { response?: { data?: { detail?: string } } })?.response?.data?.detail }) } }
  const remove = async (id: number) => { if (!confirm(t("domains.confirm_delete", "Delete this domain?"))) return; await api.delete(`/v1/brand/domains/${id}/`); await load() }
  return (
    <Card className="mt-4">
      <CardHeader>
        <CardTitle>{t("domains.title", "Verified domains")}</CardTitle>
        <CardDescription>{t("domains.desc", "Required to enable SSO — proves ownership via DNS TXT record.")}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex gap-2">
          <Input value={newDom} onChange={e => setNewDom(e.target.value)} placeholder="example.com" />
          <Button onClick={add}><Plus className="h-4 w-4 mr-1" />{t("common.add", "Add")}</Button>
        </div>
        {loading ? <Loader /> : items.length === 0 ? <p className="text-sm text-aurora-ink-3">{t("domains.empty", "No domains yet.")}</p> : (
          <div className="space-y-3">
            {items.map(d => (
              <div key={d.id} className="border border-aurora-line rounded-lg p-3 space-y-2">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="font-mono text-sm">{d.domain}</div>
                    <Badge variant={d.status === "verified" ? "default" : d.status === "failed" ? "destructive" : "outline"}>{d.status}</Badge>
                  </div>
                  <div className="flex gap-2">
                    <Button size="sm" variant="outline" onClick={() => verify(d.id)}>{t("domains.verify", "Verify")}</Button>
                    <Button size="sm" variant="ghost" onClick={() => remove(d.id)}><Trash2 className="h-4 w-4" /></Button>
                  </div>
                </div>
                {d.status !== "verified" && (
                  <div className="bg-aurora-bg-1 rounded p-2 text-xs space-y-1">
                    <div className="flex items-center gap-2"><span className="text-aurora-ink-3 w-20">Type:</span><code>TXT</code></div>
                    <div className="flex items-center gap-2"><span className="text-aurora-ink-3 w-20">Name:</span><code className="break-all">{d.record_name}</code><Button size="sm" variant="ghost" onClick={() => copy(d.record_name, toast)}><Copy className="h-3 w-3" /></Button></div>
                    <div className="flex items-center gap-2"><span className="text-aurora-ink-3 w-20">Value:</span><code className="break-all">{d.record_value}</code><Button size="sm" variant="ghost" onClick={() => copy(d.record_value, toast)}><Copy className="h-3 w-3" /></Button></div>
                  </div>
                )}
                {d.last_error && <p className="text-xs text-red-600">{d.last_error}</p>}
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  )
}

// ----- API keys -----
function ApiKeysPane({ toast, t }: { toast: ReturnType<typeof useToast>["toast"]; t: ReturnType<typeof useTranslation>["t"] }) {
  const [items, setItems] = useState<ApiKey[]>([])
  const [loading, setLoading] = useState(true)
  const [newOpen, setNewOpen] = useState(false)
  const [name, setName] = useState("")
  const [picked, setPicked] = useState<string[]>(["campaigns:read", "proposals:read"])
  const [ipAllow, setIpAllow] = useState("")
  const [expires, setExpires] = useState("")
  const [issued, setIssued] = useState<{ name: string; full_key: string } | null>(null)
  const load = async () => { setLoading(true); const { data } = await api.get("/v1/brand/api-keys/"); setItems(data); setLoading(false) }
  useEffect(() => { load() }, [])
  const create = async () => {
    try {
      const payload = {
        name, scopes: picked,
        ip_allowlist: ipAllow.split(",").map(s => s.trim()).filter(Boolean),
        expires_at: expires || null,
      }
      const { data } = await api.post("/v1/brand/api-keys/", payload)
      setIssued({ name: data.name, full_key: data.full_key })
      setName(""); setIpAllow(""); setExpires(""); setPicked(["campaigns:read", "proposals:read"])
      setNewOpen(false); await load()
    } catch (e) { toast({ variant: "destructive", title: t("common.error", "Error"), description: (e as { response?: { data?: { detail?: string } } })?.response?.data?.detail }) }
  }
  const revoke = async (id: number) => { if (!confirm(t("apikeys.confirm_revoke", "Revoke this key? Any client using it will stop working."))) return; await api.delete(`/v1/brand/api-keys/${id}/`); await load() }
  return (
    <Card className="mt-4">
      <CardHeader className="flex flex-row items-start justify-between">
        <div>
          <CardTitle>{t("apikeys.title", "API keys")}</CardTitle>
          <CardDescription>{t("apikeys.desc", "Create keys with the minimum scopes you need. Keys are shown only once.")}</CardDescription>
        </div>
        <Button onClick={() => setNewOpen(true)}><Plus className="h-4 w-4 mr-1" />{t("apikeys.new", "New key")}</Button>
      </CardHeader>
      <CardContent>
        {loading ? <Loader /> : items.length === 0 ? <p className="text-sm text-aurora-ink-3">{t("apikeys.empty", "No keys yet.")}</p> : (
          <div className="space-y-2">
            {items.map(k => (
              <div key={k.id} className="flex items-center justify-between border border-aurora-line rounded p-3">
                <div className="space-y-1">
                  <div className="font-medium text-sm">{k.name} {k.revoked_at && <Badge variant="destructive" className="ml-1">{t("apikeys.revoked", "revoked")}</Badge>}</div>
                  <div className="text-xs text-aurora-ink-3 font-mono">ic_live_{k.prefix}…</div>
                  <div className="flex flex-wrap gap-1 mt-1">{k.scopes.map(s => <Badge key={s} variant="outline" className="text-[10px]">{s}</Badge>)}</div>
                  <div className="text-[11px] text-aurora-ink-3">{t("apikeys.last_used", "Last used")}: {k.last_used_at || "—"} · {t("apikeys.expires", "Expires")}: {k.expires_at || "—"}</div>
                </div>
                {!k.revoked_at && <Button size="sm" variant="ghost" onClick={() => revoke(k.id)}><Trash2 className="h-4 w-4" /></Button>}
              </div>
            ))}
          </div>
        )}
      </CardContent>
      <Dialog open={newOpen} onOpenChange={setNewOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("apikeys.new", "New key")}</DialogTitle>
            <DialogDescription>{t("apikeys.new_desc", "Minimum privilege: only check scopes you really need.")}</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div><Label>{t("apikeys.name", "Label")}</Label><Input value={name} onChange={e => setName(e.target.value)} placeholder="Production backend" /></div>
            <div>
              <Label>{t("apikeys.scopes", "Scopes")}</Label>
              <div className="grid grid-cols-2 gap-1 text-sm mt-1">
                {SCOPES.map(s => (
                  <label key={s} className="flex items-center gap-2">
                    <input type="checkbox" checked={picked.includes(s)} onChange={e => setPicked(p => e.target.checked ? [...p, s] : p.filter(x => x !== s))} />
                    <code className="text-xs">{s}</code>
                  </label>
                ))}
              </div>
            </div>
            <div><Label>{t("apikeys.ip_allow", "IP allowlist (comma-separated CIDR)")}</Label><Input value={ipAllow} onChange={e => setIpAllow(e.target.value)} placeholder="203.0.113.0/24, 198.51.100.42" /></div>
            <div><Label>{t("apikeys.expires", "Expires")} ({t("common.optional", "optional")})</Label><Input type="datetime-local" value={expires} onChange={e => setExpires(e.target.value ? new Date(e.target.value).toISOString() : "")} /></div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setNewOpen(false)}>{t("common.cancel", "Cancel")}</Button>
            <Button onClick={create} disabled={!name || picked.length === 0}>{t("common.create", "Create")}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <Dialog open={!!issued} onOpenChange={() => setIssued(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("apikeys.copy_now", "Copy your key now")}</DialogTitle>
            <DialogDescription>{t("apikeys.copy_now_desc", "This is the only time we display the full key. Store it in a secret manager.")}</DialogDescription>
          </DialogHeader>
          {issued && (
            <div className="bg-aurora-bg-1 rounded p-3 font-mono text-xs break-all flex items-center gap-2">
              <span className="flex-1">{issued.full_key}</span>
              <Button size="sm" variant="outline" onClick={() => copy(issued.full_key, toast)}><Copy className="h-4 w-4" /></Button>
            </div>
          )}
          <DialogFooter><Button onClick={() => setIssued(null)}>{t("common.done", "Done")}</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  )
}

// ----- Webhooks -----
function WebhooksPane({ toast, t }: { toast: ReturnType<typeof useToast>["toast"]; t: ReturnType<typeof useTranslation>["t"] }) {
  const [items, setItems] = useState<Endpoint[]>([])
  const [loading, setLoading] = useState(true)
  const [open, setOpen] = useState(false)
  const [url, setUrl] = useState("")
  const [events, setEvents] = useState<string[]>(["proposal.accepted", "content.validated"])
  const [desc, setDesc] = useState("")
  const [issued, setIssued] = useState<Endpoint | null>(null)
  const [deliveriesFor, setDeliveriesFor] = useState<number | null>(null)
  const [deliveries, setDeliveries] = useState<Delivery[]>([])
  const load = async () => { setLoading(true); const { data } = await api.get("/v1/brand/webhooks/"); setItems(data); setLoading(false) }
  useEffect(() => { load() }, [])
  const create = async () => {
    try {
      const { data } = await api.post("/v1/brand/webhooks/", { url, events, description: desc })
      setIssued(data); setUrl(""); setDesc(""); setEvents(["proposal.accepted", "content.validated"]); setOpen(false); await load()
    } catch (e) { toast({ variant: "destructive", title: t("common.error", "Error"), description: (e as { response?: { data?: { detail?: string } } })?.response?.data?.detail }) }
  }
  const toggle = async (e: Endpoint) => { await api.patch(`/v1/brand/webhooks/${e.id}/`, { enabled: !e.enabled }); await load() }
  const rotate = async (e: Endpoint) => { if (!confirm(t("webhooks.confirm_rotate", "Rotate secret? Old signatures will stop validating."))) return; const { data } = await api.patch(`/v1/brand/webhooks/${e.id}/`, { rotate_secret: true }); setIssued(data); await load() }
  const remove = async (e: Endpoint) => { if (!confirm(t("webhooks.confirm_delete", "Delete this endpoint?"))) return; await api.delete(`/v1/brand/webhooks/${e.id}/`); await load() }
  const test = async (e: Endpoint) => { try { await api.post(`/v1/brand/webhooks/${e.id}/test/`); toast({ title: t("webhooks.test_sent", "Test event sent") }) } catch (err) { toast({ variant: "destructive", title: t("common.error", "Error"), description: (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail }) } }
  const openDeliveries = async (e: Endpoint) => { setDeliveriesFor(e.id); const { data } = await api.get(`/v1/brand/webhooks/${e.id}/deliveries/`); setDeliveries(data) }
  return (
    <Card className="mt-4">
      <CardHeader className="flex flex-row items-start justify-between">
        <div>
          <CardTitle>{t("webhooks.title", "Webhooks")}</CardTitle>
          <CardDescription>{t("webhooks.desc", "Receive HTTPS POSTs when InfluConnect events happen. Each request is signed with HMAC-SHA256.")}</CardDescription>
        </div>
        <Button onClick={() => setOpen(true)}><Plus className="h-4 w-4 mr-1" />{t("webhooks.new", "New endpoint")}</Button>
      </CardHeader>
      <CardContent>
        {loading ? <Loader /> : items.length === 0 ? <p className="text-sm text-aurora-ink-3">{t("webhooks.empty", "No endpoints yet.")}</p> : (
          <div className="space-y-2">
            {items.map(e => (
              <div key={e.id} className="border border-aurora-line rounded p-3 space-y-2">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="font-medium text-sm break-all">{e.url}</div>
                    <div className="flex flex-wrap gap-1 mt-1">{e.events.map(ev => <Badge key={ev} variant="outline" className="text-[10px]">{ev}</Badge>)}</div>
                    <div className="text-[11px] text-aurora-ink-3 mt-1">{t("webhooks.last_status", "Last status")}: {e.last_status || "—"} · {e.last_delivery_at || "—"}</div>
                  </div>
                  <div className="flex flex-wrap gap-1">
                    <Button size="sm" variant="outline" onClick={() => toggle(e)}>{e.enabled ? t("webhooks.disable", "Disable") : t("webhooks.enable", "Enable")}</Button>
                    <Button size="sm" variant="outline" onClick={() => test(e)}>{t("webhooks.test", "Test")}</Button>
                    <Button size="sm" variant="outline" onClick={() => openDeliveries(e)}>{t("webhooks.deliveries", "Deliveries")}</Button>
                    <Button size="sm" variant="outline" onClick={() => rotate(e)}>{t("webhooks.rotate", "Rotate")}</Button>
                    <Button size="sm" variant="ghost" onClick={() => remove(e)}><Trash2 className="h-4 w-4" /></Button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>{t("webhooks.new", "New endpoint")}</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div><Label>URL</Label><Input value={url} onChange={e => setUrl(e.target.value)} placeholder="https://yourapp.example.com/webhooks/influconnect" /></div>
            <div><Label>{t("webhooks.description", "Description")}</Label><Input value={desc} onChange={e => setDesc(e.target.value)} /></div>
            <div>
              <Label>{t("webhooks.events", "Events")}</Label>
              <div className="grid grid-cols-2 gap-1 text-sm mt-1 max-h-64 overflow-auto">
                {EVENTS.map(ev => (
                  <label key={ev} className="flex items-center gap-2">
                    <input type="checkbox" checked={events.includes(ev)} onChange={e => setEvents(p => e.target.checked ? [...p, ev] : p.filter(x => x !== ev))} />
                    <code className="text-xs">{ev}</code>
                  </label>
                ))}
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>{t("common.cancel", "Cancel")}</Button>
            <Button onClick={create} disabled={!url || events.length === 0}>{t("common.create", "Create")}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <Dialog open={!!issued} onOpenChange={() => setIssued(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("webhooks.copy_secret", "Copy your signing secret")}</DialogTitle>
            <DialogDescription>{t("webhooks.copy_secret_desc", "Use this secret to verify the X-InfluConnect-Signature header. Shown only once.")}</DialogDescription>
          </DialogHeader>
          {issued?.secret && (
            <div className="bg-aurora-bg-1 rounded p-3 font-mono text-xs break-all flex items-center gap-2">
              <span className="flex-1">{issued.secret}</span>
              <Button size="sm" variant="outline" onClick={() => copy(issued.secret!, toast)}><Copy className="h-4 w-4" /></Button>
            </div>
          )}
          <DialogFooter><Button onClick={() => setIssued(null)}>{t("common.done", "Done")}</Button></DialogFooter>
        </DialogContent>
      </Dialog>
      <Dialog open={deliveriesFor !== null} onOpenChange={() => setDeliveriesFor(null)}>
        <DialogContent className="max-w-3xl">
          <DialogHeader><DialogTitle>{t("webhooks.deliveries", "Deliveries")}</DialogTitle></DialogHeader>
          <div className="max-h-[60vh] overflow-auto space-y-1">
            {deliveries.length === 0 ? <p className="text-sm text-aurora-ink-3">{t("webhooks.no_deliveries", "No deliveries yet.")}</p> : deliveries.map(d => (
              <div key={d.id} className="border border-aurora-line rounded p-2 text-xs">
                <div className="flex items-center justify-between">
                  <code>{d.event}</code>
                  <Badge variant={d.status === "success" ? "default" : d.status === "failed" ? "destructive" : "outline"}>{d.status}</Badge>
                </div>
                <div className="text-aurora-ink-3 mt-1">HTTP {d.response_status ?? "—"} · {d.attempts} attempts · {d.created_at}</div>
                {d.error && <div className="text-red-600 mt-1">{d.error}</div>}
              </div>
            ))}
          </div>
        </DialogContent>
      </Dialog>
    </Card>
  )
}

// ----- Audit -----
function AuditPane({ t }: { t: ReturnType<typeof useTranslation>["t"] }) {
  const [items, setItems] = useState<AuditEntry[]>([])
  const [loading, setLoading] = useState(true)
  useEffect(() => { (async () => { const { data } = await api.get("/v1/brand/api-keys/audit-log/"); setItems(data); setLoading(false) })() }, [])
  const rows = useMemo(() => items, [items])
  if (loading) return <Loader />
  return (
    <Card className="mt-4">
      <CardHeader>
        <CardTitle>{t("audit.title", "API audit log")}</CardTitle>
        <CardDescription>{t("audit.desc", "Last 200 API calls authenticated with one of your keys.")}</CardDescription>
      </CardHeader>
      <CardContent>
        {rows.length === 0 ? <p className="text-sm text-aurora-ink-3">{t("audit.empty", "No API calls yet.")}</p> : (
          <div className="text-xs font-mono space-y-1 max-h-[60vh] overflow-auto">
            {rows.map(r => (
              <div key={r.id} className="flex items-center gap-2 border-b border-aurora-line py-1">
                <Badge variant={r.status_code < 400 ? "default" : "destructive"}>{r.status_code}</Badge>
                <span className="text-aurora-ink-3 w-16">{r.method}</span>
                <span className="flex-1 truncate">{r.path}</span>
                <span className="text-aurora-ink-3">{r.latency_ms}ms</span>
                <span className="text-aurora-ink-3">{r.ip_address}</span>
                <span className="text-aurora-ink-3">{r.api_key}</span>
                <span className="text-aurora-ink-3">{r.created_at}</span>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  )
}

function Loader() { return <div className="flex justify-center py-6"><Loader2 className="h-5 w-5 animate-spin text-aurora-ink-3" /></div> }
