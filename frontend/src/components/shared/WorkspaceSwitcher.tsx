import { useState } from "react"
import { useNavigate } from "react-router-dom"
import { useTranslation } from "react-i18next"
import { useAuth } from "@/lib/auth"
import { Badge } from "@/components/ui/badge"
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { useToast } from "@/hooks/use-toast"
import { Building2, Check, ChevronsUpDown, Loader2, Plus, Settings2, Users } from "lucide-react"

export function WorkspaceSwitcher() {
  const { t } = useTranslation()
  const { user, switchBrandWorkspace, createBrandWorkspace } = useAuth()
  const { toast } = useToast()
  const navigate = useNavigate()
  const [switching, setSwitching] = useState(false)

  if (user?.user_type !== "brand") return null
  const environments = user?.brand_environments ?? []
  if (environments.length === 0) return null

  const active = environments.find((e) => e.id === user?.active_brand_workspace_id) ?? environments[0]
  const canManage = ["owner", "admin"].includes(user?.active_brand_role || "")

  const handleSwitch = async (brandId: number) => {
    if (brandId === active?.id || switching) return
    setSwitching(true)
    try {
      await switchBrandWorkspace(brandId)
      toast({ title: t("brand_environments.switched", "Environment switched") })
    } catch {
      toast({ variant: "destructive", title: t("brand_environments.switch_failed", "Unable to switch environment") })
    } finally {
      setSwitching(false)
    }
  }

  const handleCreate = async () => {
    const value = window.prompt(t("common.workspace_create_prompt", "Name of the new workspace"), "")
    const companyName = (value || "").trim()
    if (!companyName) return
    try {
      await createBrandWorkspace(companyName)
      toast({ title: t("brand_environments.created", "Environment created") })
    } catch {
      toast({ variant: "destructive", title: t("brand_environments.create_failed", "Unable to create environment") })
    }
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          className="flex items-center gap-2 max-w-[220px] px-3 py-1.5 rounded-full border border-aurora-line bg-aurora-surface/60 hover:bg-aurora-surface text-[13px] font-medium text-aurora-ink transition-all ease-aurora focus:outline-none focus:ring-2 focus:ring-indigo-400"
          aria-label={t("brand_environments.title", "Environments")}
        >
          {switching
            ? <Loader2 className="h-3.5 w-3.5 animate-spin shrink-0" />
            : <Building2 className="h-3.5 w-3.5 text-aurora-ink-2 shrink-0" />}
          <span className="truncate">{active?.company_name}</span>
          <ChevronsUpDown className="h-3.5 w-3.5 text-aurora-ink-3 shrink-0" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-64 rounded-2xl shadow-soft-lg border-aurora-line p-1.5">
        <DropdownMenuLabel className="px-3 py-2 text-xs text-aurora-ink-3">
          {t("brand_environments.title", "Environments")}
        </DropdownMenuLabel>
        {environments.map((env) => (
          <DropdownMenuItem
            key={env.id}
            onClick={() => handleSwitch(env.id)}
            className="flex items-center justify-between gap-2"
          >
            <span className={`truncate ${env.id === active?.id ? "font-semibold" : ""}`}>{env.company_name}</span>
            <span className="flex items-center gap-1.5 shrink-0">
              {env.role && (
                <Badge variant="secondary" className="text-[10px] px-1.5 py-0">
                  {t(`brand_team.role_${env.role}`, env.role)}
                </Badge>
              )}
              {env.id === active?.id && <Check className="h-3.5 w-3.5 text-aurora-blue" />}
            </span>
          </DropdownMenuItem>
        ))}
        <DropdownMenuSeparator />
        {canManage && (
          <DropdownMenuItem onClick={handleCreate}>
            <Plus className="h-4 w-4 mr-2" />{t("common.workspace_create", "Create workspace")}
          </DropdownMenuItem>
        )}
        <DropdownMenuItem onClick={() => navigate("/brand/environments")}>
          <Settings2 className="h-4 w-4 mr-2" />{t("brand_environments.list_title", "Your environments")}
        </DropdownMenuItem>
        {canManage && (
          <DropdownMenuItem onClick={() => navigate("/brand/team")}>
            <Users className="h-4 w-4 mr-2" />{t("brand_team.title", "Team")}
          </DropdownMenuItem>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
