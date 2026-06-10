import { useEffect, useMemo, useState } from "react"
import { useTranslation } from "react-i18next"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog"
import { useToast } from "@/hooks/use-toast"
import { useAuth } from "@/lib/auth"
import {
  Building2, Globe, Loader2, Mail, MoreHorizontal, RefreshCw, Trash2, UserPlus, X,
} from "lucide-react"
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  fetchTeamOverview, sendTeamInvitation, teamInvitationAction,
  revokeBrandMember, updateBrandMemberRole, revokeGlobalMember, updateGlobalMemberRole,
  type TeamOverview, type TeamMember, type TeamInvitation,
} from "@/lib/apiExtra"

const roleVariant = (role: string | null) => {
  if (role === "owner") return "purple" as const
  if (role === "admin") return "info" as const
  return "secondary" as const
}

export default function BrandTeam() {
  const { t, i18n } = useTranslation()
  const { toast } = useToast()
  const { user } = useAuth()
  const [overview, setOverview] = useState<TeamOverview | null>(null)
  const [loading, setLoading] = useState(true)
  const [inviteOpen, setInviteOpen] = useState(false)

  // Invite form state
  const [email, setEmail] = useState("")
  const [role, setRole] = useState<"admin" | "member">("member")
  const [scope, setScope] = useState<"global" | "environments">("environments")
  const [selectedEnvs, setSelectedEnvs] = useState<number[]>([])
  const [message, setMessage] = useState("")
  const [submitting, setSubmitting] = useState(false)
  const [busyInvitationId, setBusyInvitationId] = useState<number | null>(null)

  const reload = () =>
    fetchTeamOverview()
      .then(setOverview)
      .catch(() => toast({ variant: "destructive", title: t("common.error") }))
      .finally(() => setLoading(false))

  useEffect(() => { reload() }, [])

  const envNameById = useMemo(() => {
    const map = new Map<number, string>()
    overview?.environments.forEach((e) => map.set(e.id, e.company_name))
    return map
  }, [overview])

  const manageable = useMemo(
    () => new Set(overview?.manageable_environment_ids ?? []),
    [overview],
  )
  const canInvite = (overview?.manageable_environment_ids.length ?? 0) > 0 || overview?.org_role === "admin"
  const isOrgAdmin = overview?.org_role === "admin"

  const openInvite = () => {
    setEmail("")
    setRole("member")
    setScope("environments")
    setSelectedEnvs(overview && overview.manageable_environment_ids.length === 1
      ? [...overview.manageable_environment_ids] : [])
    setMessage("")
    setInviteOpen(true)
  }

  const toggleEnv = (id: number) => {
    setSelectedEnvs((prev) => prev.includes(id) ? prev.filter((e) => e !== id) : [...prev, id])
  }

  const handleInvite = async () => {
    if (!email.trim()) return
    if (scope === "environments" && selectedEnvs.length === 0) {
      toast({ variant: "destructive", title: t("brand_team.select_at_least_one") })
      return
    }
    setSubmitting(true)
    try {
      await sendTeamInvitation({
        invited_email: email.trim().toLowerCase(),
        role,
        scope,
        environment_ids: scope === "environments" ? selectedEnvs : undefined,
        message: message.trim() || undefined,
      })
      toast({ title: t("brand_team.invited") })
      setInviteOpen(false)
      reload()
    } catch (e: any) {
      const status = e?.response?.status
      const detail = status === 409
        ? (String(e?.response?.data?.detail || "").includes("already has")
            ? t("brand_team.already_has_access")
            : t("brand_team.already_pending"))
        : e?.response?.data?.detail ?? ""
      toast({ variant: "destructive", title: t("common.error"), description: detail })
    } finally {
      setSubmitting(false)
    }
  }

  const handleInvitationAction = async (inv: TeamInvitation, action: "resend" | "cancel") => {
    setBusyInvitationId(inv.id)
    try {
      await teamInvitationAction(inv.id, action)
      toast({ title: action === "resend" ? t("brand_team.resent") : t("brand_team.invite_cancelled") })
      reload()
    } catch {
      toast({ variant: "destructive", title: t("common.error") })
    } finally {
      setBusyInvitationId(null)
    }
  }

  const handleRevokeEnv = async (membershipId: number) => {
    if (!confirm(t("brand_team.confirm_revoke"))) return
    try {
      await revokeBrandMember(membershipId)
      reload()
    } catch {
      toast({ variant: "destructive", title: t("common.error") })
    }
  }

  const handleEnvRoleChange = async (membershipId: number, newRole: "admin" | "member") => {
    try {
      await updateBrandMemberRole(membershipId, newRole)
      reload()
    } catch {
      toast({ variant: "destructive", title: t("common.error") })
    }
  }

  const handleRevokeGlobal = async (membershipId: number) => {
    if (!confirm(t("brand_team.confirm_revoke_global"))) return
    try {
      await revokeGlobalMember(membershipId)
      reload()
    } catch {
      toast({ variant: "destructive", title: t("common.error") })
    }
  }

  const handleGlobalRoleChange = async (membershipId: number, newRole: "admin" | "member") => {
    try {
      await updateGlobalMemberRole(membershipId, newRole)
      reload()
    } catch {
      toast({ variant: "destructive", title: t("common.error") })
    }
  }

  const formatDate = (iso: string) =>
    new Date(iso).toLocaleDateString(i18n.language === "fr" ? "fr-FR" : "en-US", {
      day: "numeric", month: "short", year: "numeric",
    })

  const memberCanBeManaged = (m: TeamMember) => m.user_id !== user?.id

  if (loading) {
    return <div className="flex items-center justify-center h-64 text-aurora-ink-3"><Loader2 className="h-6 w-6 animate-spin mr-2" />{t("common.loading")}</div>
  }

  const pendingInvitations = (overview?.invitations ?? []).filter((i) => i.status !== "cancelled")

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3">
        <div>
          <p className="text-sm text-aurora-ink-3">{overview?.organization.name}</p>
          <h1 className="text-3xl font-semibold tracking-tight text-aurora-ink mt-0.5">{t("brand_team.title")}</h1>
          <p className="text-sm text-aurora-ink-2 mt-1">{t("brand_team.subtitle")}</p>
        </div>
        {canInvite && (
          <Button variant="gradient" onClick={openInvite}>
            <UserPlus className="h-4 w-4 mr-2" />{t("brand_team.invite_title")}
          </Button>
        )}
      </div>

      {/* Pending invitations */}
      {canInvite && (
        <Card className="card-base">
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Mail className="h-4 w-4 text-aurora-ink-2" />
              {t("brand_team.pending_invitations")}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {pendingInvitations.length === 0 ? (
              <p className="text-sm text-aurora-ink-3 text-center py-4">{t("brand_team.no_pending")}</p>
            ) : (
              <div className="space-y-2">
                {pendingInvitations.map((inv) => (
                  <div key={inv.id} className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 p-3 rounded-xl hover:bg-aurora-surface">
                    <div className="min-w-0">
                      <p className="font-medium text-aurora-ink text-sm truncate">{inv.invited_email}</p>
                      <div className="mt-1 flex flex-wrap items-center gap-1.5">
                        <Badge variant={roleVariant(inv.role)}>{t(`brand_team.role_${inv.role}`)}</Badge>
                        {inv.scope === "global" ? (
                          <Badge variant="info" className="gap-1"><Globe className="h-3 w-3" />{t("brand_team.all_environments")}</Badge>
                        ) : (
                          inv.environments.map((env) => (
                            <Badge key={env.id} variant="secondary" className="gap-1"><Building2 className="h-3 w-3" />{env.company_name}</Badge>
                          ))
                        )}
                        <Badge variant={inv.status === "pending" ? "warning" : "destructive"}>
                          {t(`brand_team.status_${inv.status}`, inv.status)}
                        </Badge>
                      </div>
                      <p className="text-[11px] text-aurora-ink-3 mt-1">
                        {t("brand_team.invited_by", { name: inv.invited_by_name })} · {t("brand_team.expires_on", { date: formatDate(inv.expires_at) })}
                      </p>
                    </div>
                    <div className="flex items-center gap-1.5 shrink-0">
                      <Button
                        variant="outline" size="sm"
                        disabled={busyInvitationId === inv.id}
                        onClick={() => handleInvitationAction(inv, "resend")}
                      >
                        {busyInvitationId === inv.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5 mr-1.5" />}
                        {t("brand_team.resend")}
                      </Button>
                      <Button
                        variant="ghost" size="sm" className="text-red-500"
                        disabled={busyInvitationId === inv.id}
                        onClick={() => handleInvitationAction(inv, "cancel")}
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Members */}
      <Card className="card-base">
        <CardHeader><CardTitle className="text-base">{t("brand_team.members")}</CardTitle></CardHeader>
        <CardContent>
          {(overview?.members.length ?? 0) === 0 ? (
            <p className="text-sm text-aurora-ink-3 text-center py-4">{t("brand_team.empty")}</p>
          ) : (
            <div className="space-y-2">
              {overview!.members.map((m) => (
                <div key={m.user_id} className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 p-3 rounded-xl hover:bg-aurora-surface">
                  <div className="min-w-0">
                    <p className="font-medium text-aurora-ink text-sm">{m.name}</p>
                    <p className="text-xs text-aurora-ink-3 truncate">{m.email}</p>
                    <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                      {m.global_role && (
                        <Badge variant={m.global_role === "admin" ? "purple" : "info"} className="gap-1" title={t("brand_team.global_badge_desc")}>
                          <Globe className="h-3 w-3" />
                          {m.global_role === "admin" ? t("brand_team.global_admin") : t("brand_team.global_member")}
                        </Badge>
                      )}
                      {m.environment_roles.map((er) => (
                        <Badge key={`${er.brand_id}-${er.role}`} variant={roleVariant(er.role)} className="gap-1">
                          <Building2 className="h-3 w-3" />
                          {envNameById.get(er.brand_id) ?? `#${er.brand_id}`} · {t(`brand_team.role_${er.role}`)}
                        </Badge>
                      ))}
                    </div>
                  </div>
                  {memberCanBeManaged(m) && (isOrgAdmin || m.environment_roles.some((er) => er.membership_id && manageable.has(er.brand_id))) && (
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="sm"><MoreHorizontal className="h-4 w-4" /></Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className="w-72">
                        {isOrgAdmin && m.global_membership_id && (
                          <>
                            <DropdownMenuItem onClick={() => handleGlobalRoleChange(m.global_membership_id!, m.global_role === "admin" ? "member" : "admin")}>
                              <Globe className="h-4 w-4 mr-2" />
                              {m.global_role === "admin" ? t("brand_team.global_member") : t("brand_team.global_admin")}
                            </DropdownMenuItem>
                            <DropdownMenuItem className="text-red-600" onClick={() => handleRevokeGlobal(m.global_membership_id!)}>
                              <Trash2 className="h-4 w-4 mr-2" />
                              {t("brand_team.revoke_global")}
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                          </>
                        )}
                        {m.environment_roles
                          .filter((er) => er.membership_id && (isOrgAdmin || manageable.has(er.brand_id)) && er.role !== "owner")
                          .map((er) => (
                            <div key={er.membership_id}>
                              <DropdownMenuItem onClick={() => handleEnvRoleChange(er.membership_id!, er.role === "admin" ? "member" : "admin")}>
                                <Building2 className="h-4 w-4 mr-2" />
                                {envNameById.get(er.brand_id)} → {er.role === "admin" ? t("brand_team.role_member") : t("brand_team.role_admin")}
                              </DropdownMenuItem>
                              <DropdownMenuItem className="text-red-600" onClick={() => handleRevokeEnv(er.membership_id!)}>
                                <Trash2 className="h-4 w-4 mr-2" />
                                {envNameById.get(er.brand_id)} — {t("brand_team.revoke_access")}
                              </DropdownMenuItem>
                            </div>
                          ))}
                      </DropdownMenuContent>
                    </DropdownMenu>
                  )}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Invite dialog */}
      <Dialog open={inviteOpen} onOpenChange={setInviteOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{t("brand_team.invite_title")}</DialogTitle>
            <DialogDescription>{t("brand_team.invite_desc")}</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>{t("brand_team.email")}</Label>
              <Input
                type="email" value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="collaborateur@entreprise.com"
                className="mt-1"
              />
            </div>
            <div>
              <Label>{t("brand_team.role")}</Label>
              <select
                className="mt-1 w-full rounded-md border border-input px-3 py-2 text-sm bg-white"
                value={role}
                onChange={(e) => setRole(e.target.value as "admin" | "member")}
              >
                <option value="member">{t("brand_team.role_member")}</option>
                <option value="admin">{t("brand_team.role_admin")}</option>
              </select>
              <p className="text-[11px] text-aurora-ink-3 mt-1">
                {role === "admin" ? t("brand_team.rights_admin") : t("brand_team.rights_member")}
              </p>
            </div>
            <div>
              <Label>{t("brand_team.scope")}</Label>
              <div className="mt-1.5 space-y-2">
                {overview?.can_invite_global && (
                  <label className="flex items-start gap-2.5 p-2.5 rounded-lg border border-aurora-line cursor-pointer hover:bg-aurora-surface">
                    <input
                      type="radio" name="scope" className="mt-0.5"
                      checked={scope === "global"}
                      onChange={() => setScope("global")}
                    />
                    <span>
                      <span className="text-sm font-medium text-aurora-ink flex items-center gap-1.5">
                        <Globe className="h-3.5 w-3.5" />{t("brand_team.scope_global")}
                      </span>
                      <span className="block text-[11px] text-aurora-ink-3">{t("brand_team.scope_global_desc")}</span>
                    </span>
                  </label>
                )}
                <label className="flex items-start gap-2.5 p-2.5 rounded-lg border border-aurora-line cursor-pointer hover:bg-aurora-surface">
                  <input
                    type="radio" name="scope" className="mt-0.5"
                    checked={scope === "environments"}
                    onChange={() => setScope("environments")}
                  />
                  <span>
                    <span className="text-sm font-medium text-aurora-ink flex items-center gap-1.5">
                      <Building2 className="h-3.5 w-3.5" />{t("brand_team.scope_envs")}
                    </span>
                    <span className="block text-[11px] text-aurora-ink-3">{t("brand_team.scope_envs_desc")}</span>
                  </span>
                </label>
              </div>
              {scope === "environments" && (
                <div className="mt-2 ml-1 space-y-1.5 max-h-40 overflow-y-auto">
                  {(overview?.environments ?? [])
                    .filter((env) => isOrgAdmin || manageable.has(env.id))
                    .map((env) => (
                      <label key={env.id} className="flex items-center gap-2 text-sm text-aurora-ink cursor-pointer">
                        <input
                          type="checkbox"
                          checked={selectedEnvs.includes(env.id)}
                          onChange={() => toggleEnv(env.id)}
                        />
                        {env.company_name}
                      </label>
                    ))}
                </div>
              )}
            </div>
            <div>
              <Label>{t("brand_team.message_label")}</Label>
              <Input
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                placeholder={t("brand_team.message_placeholder")}
                className="mt-1"
                maxLength={500}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setInviteOpen(false)}>{t("common.cancel", "Annuler")}</Button>
            <Button variant="gradient" onClick={handleInvite} disabled={submitting || !email.trim()}>
              {submitting ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Mail className="h-4 w-4 mr-2" />}
              {t("brand_team.send_invitation")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
