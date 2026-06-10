import { useEffect, useState } from "react"
import { useTranslation } from "react-i18next"
import api from "@/lib/api"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Loader2, Building2, Plus } from "lucide-react"
import { useToast } from "@/hooks/use-toast"
import { useAuth } from "@/lib/auth"

interface BrandEnvironment {
  id: number
  company_name: string
  is_agency: boolean
  role: "owner" | "admin" | "member" | null
  is_active: boolean
}

const roleVariant = (role: BrandEnvironment["role"]) => {
  if (role === "owner") return "purple" as const
  if (role === "admin") return "info" as const
  return "secondary" as const
}

export default function BrandEnvironments() {
  const { t } = useTranslation()
  const { toast } = useToast()
  const { refreshUser } = useAuth()
  const [loading, setLoading] = useState(true)
  const [environments, setEnvironments] = useState<BrandEnvironment[]>([])
  const [newName, setNewName] = useState("")
  const [creating, setCreating] = useState(false)
  const [switchingId, setSwitchingId] = useState<number | null>(null)

  const load = async () => {
    try {
      const res = await api.get("/brands/environments/")
      setEnvironments(res.data?.results ?? [])
    } catch {
      toast({ variant: "destructive", title: t("common.error") })
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
  }, [])

  const createEnvironment = async () => {
    const companyName = newName.trim()
    if (!companyName) return
    setCreating(true)
    try {
      await api.post("/brands/environments/", { company_name: companyName })
      setNewName("")
      await refreshUser()
      await load()
      toast({ title: t("brand_environments.created", "Environment created") })
    } catch {
      toast({ variant: "destructive", title: t("brand_environments.create_failed", "Unable to create environment") })
    } finally {
      setCreating(false)
    }
  }

  const switchEnvironment = async (brandId: number) => {
    setSwitchingId(brandId)
    try {
      await api.post("/brands/environments/switch/", { brand_id: brandId })
      await refreshUser()
      await load()
      toast({ title: t("brand_environments.switched", "Environment switched") })
    } catch {
      toast({ variant: "destructive", title: t("brand_environments.switch_failed", "Unable to switch environment") })
    } finally {
      setSwitchingId(null)
    }
  }

  if (loading) {
    return <div className="flex items-center justify-center h-64 text-aurora-ink-3"><Loader2 className="h-6 w-6 animate-spin mr-2" />{t("common.loading")}</div>
  }

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-6">
      <p className="text-sm text-aurora-ink-3">{t("brand_environments.eyebrow", "Brand workspace")}</p>
      <h1 className="text-3xl font-semibold tracking-tight text-aurora-ink mt-0.5">{t("brand_environments.title", "Environments")}</h1>

      <Card className="card-base">
        <CardHeader>
          <CardTitle className="text-base">{t("brand_environments.create_title", "Create a new environment")}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-sm text-aurora-ink-2">
            {t("brand_environments.create_desc", "Create a dedicated workspace for another company entity and switch instantly between them.")}
          </p>
          <div className="flex flex-col sm:flex-row gap-2">
            <Input
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder={t("brand_environments.name_placeholder", "Workspace name")}
            />
            <Button type="button" onClick={createEnvironment} disabled={creating || !newName.trim()}>
              {creating ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Plus className="h-4 w-4 mr-2" />}
              {t("brand_environments.create", "Create")}
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card className="card-base">
        <CardHeader>
          <CardTitle className="text-base">{t("brand_environments.list_title", "Your environments")}</CardTitle>
        </CardHeader>
        <CardContent>
          {environments.length === 0 ? (
            <p className="text-sm text-aurora-ink-3 text-center py-4">{t("brand_environments.empty", "No environments available.")}</p>
          ) : (
            <div className="space-y-2">
              {environments.map((env) => (
                <div key={env.id} className="flex items-center justify-between p-3 rounded-xl hover:bg-aurora-surface">
                  <div className="flex items-center gap-3">
                    <div className="h-9 w-9 rounded-lg bg-aurora-surface border border-aurora-line flex items-center justify-center">
                      <Building2 className="h-4 w-4 text-aurora-ink-2" />
                    </div>
                    <div>
                      <p className="font-medium text-aurora-ink text-sm">{env.company_name}</p>
                      <div className="mt-1 flex items-center gap-2">
                        <Badge variant={roleVariant(env.role)}>{t(`brand_team.role_${env.role ?? "member"}`, env.role ?? "member")}</Badge>
                        {env.is_active && <Badge variant="success">{t("brand_environments.active", "Active")}</Badge>}
                      </div>
                    </div>
                  </div>
                  {!env.is_active && (
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      disabled={switchingId === env.id}
                      onClick={() => switchEnvironment(env.id)}
                    >
                      {switchingId === env.id ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : null}
                      {t("brand_environments.switch", "Switch")}
                    </Button>
                  )}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}