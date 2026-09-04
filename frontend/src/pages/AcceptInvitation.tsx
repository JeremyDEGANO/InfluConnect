import { useEffect, useState } from "react"
import { Link, useNavigate, useParams } from "react-router-dom"
import { useTranslation } from "react-i18next"
import { useAuth } from "@/lib/auth"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { useToast } from "@/hooks/use-toast"
import { Building2, Check, Globe, Loader2, ShieldAlert } from "lucide-react"
import {
  fetchPublicInvitation, acceptInvitation, registerViaInvitation,
  type PublicInvitation,
} from "@/lib/apiExtra"

export default function AcceptInvitation() {
  const { token = "" } = useParams()
  const { t } = useTranslation()
  const { toast } = useToast()
  const navigate = useNavigate()
  const { user, isAuthenticated, isLoading, logout, refreshUser } = useAuth()

  const [invitation, setInvitation] = useState<PublicInvitation | null>(null)
  const [loading, setLoading] = useState(true)
  const [notFound, setNotFound] = useState(false)
  const [accepting, setAccepting] = useState(false)
  const [accepted, setAccepted] = useState(false)

  // Registration form
  const [firstName, setFirstName] = useState("")
  const [lastName, setLastName] = useState("")
  const [password, setPassword] = useState("")
  const [registering, setRegistering] = useState(false)
  const [formError, setFormError] = useState("")

  useEffect(() => {
    if (!token) { setNotFound(true); setLoading(false); return }
    fetchPublicInvitation(token)
      .then(setInvitation)
      .catch(() => setNotFound(true))
      .finally(() => setLoading(false))
  }, [token])

  const emailMatches =
    isAuthenticated &&
    (user?.email || "").trim().toLowerCase() === (invitation?.invited_email || "").toLowerCase()

  const finishAndRedirect = async () => {
    setAccepted(true)
    await refreshUser()
    setTimeout(() => navigate("/brand/dashboard"), 1200)
  }

  const handleAccept = async () => {
    setAccepting(true)
    try {
      await acceptInvitation(token)
      toast({ title: t("team_invite.accepted") })
      await finishAndRedirect()
    } catch (e: any) {
      toast({
        variant: "destructive",
        title: t("common.error"),
        description: e?.response?.data?.detail ?? "",
      })
    } finally {
      setAccepting(false)
    }
  }

  const handleRegister = async () => {
    setFormError("")
    if (password.length < 8) {
      setFormError(t("team_invite.password_hint"))
      return
    }
    setRegistering(true)
    try {
      const data = await registerViaInvitation(token, {
        first_name: firstName.trim(),
        last_name: lastName.trim(),
        password,
      })
      if (data?.access) {
        sessionStorage.setItem("access_token", data.access)
        sessionStorage.setItem("refresh_token", data.refresh)
        if (data?.user?.active_brand_workspace_id) {
          localStorage.setItem("selected_brand_id", String(data.user.active_brand_workspace_id))
        }
      }
      toast({ title: t("team_invite.accepted") })
      await finishAndRedirect()
    } catch (e: any) {
      const data = e?.response?.data
      if (e?.response?.status === 409) {
        setFormError(t("team_invite.email_exists"))
      } else if (data?.password) {
        setFormError(Array.isArray(data.password) ? data.password.join(" ") : String(data.password))
      } else {
        setFormError(data?.detail ?? t("common.error"))
      }
    } finally {
      setRegistering(false)
    }
  }

  if (loading || isLoading) {
    return <div className="flex items-center justify-center min-h-[60vh] text-aurora-ink-3"><Loader2 className="h-6 w-6 animate-spin mr-2" />{t("common.loading")}</div>
  }

  if (notFound || !invitation || (invitation.status !== "pending" && !accepted)) {
    return (
      <div className="flex items-center justify-center min-h-[60vh] p-6">
        <Card className="card-base max-w-md w-full">
          <CardContent className="pt-8 pb-8 text-center space-y-3">
            <ShieldAlert className="h-10 w-10 text-amber-500 mx-auto" />
            <p className="text-aurora-ink font-medium">
              {invitation && invitation.status !== "pending"
                ? t("team_invite.no_longer_valid")
                : t("team_invite.not_found")}
            </p>
            <Button variant="outline" asChild><Link to="/">InfluConnect</Link></Button>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="flex items-center justify-center min-h-[70vh] p-6">
      <Card className="card-base max-w-lg w-full">
        <CardHeader className="text-center">
          <p className="text-sm text-aurora-ink-3">{t("team_invite.title")}</p>
          <CardTitle className="text-xl">
            {t("team_invite.invited_you", { name: invitation.invited_by_name || "InfluConnect" })}{" "}
            <span className="text-aurora-blue">{invitation.organization_name}</span>
          </CardTitle>
          <p className="text-sm text-aurora-ink-2">
            {t("team_invite.as_role", { role: t(`brand_team.role_${invitation.role}`) })}
          </p>
        </CardHeader>
        <CardContent className="space-y-5">
          <div className="rounded-xl bg-aurora-surface p-3.5">
            <p className="text-xs font-medium text-aurora-ink-3 mb-2">{t("team_invite.access_label")}</p>
            <div className="flex flex-wrap gap-1.5">
              {invitation.scope === "global" ? (
                <Badge variant="info" className="gap-1">
                  <Globe className="h-3 w-3" />{t("team_invite.all_environments")}
                </Badge>
              ) : (
                invitation.environments.map((env) => (
                  <Badge key={env.id} variant="secondary" className="gap-1">
                    <Building2 className="h-3 w-3" />{env.company_name}
                  </Badge>
                ))
              )}
            </div>
            {invitation.message && (
              <p className="text-sm text-aurora-ink-2 mt-3 italic">« {invitation.message} »</p>
            )}
          </div>

          <p className="text-xs text-aurora-ink-3 text-center">
            {t("team_invite.sent_to", { email: invitation.invited_email })}
          </p>

          {accepted ? (
            <div className="text-center py-2 text-emerald-600 font-medium flex items-center justify-center gap-2">
              <Check className="h-5 w-5" />{t("team_invite.accepted")}
            </div>
          ) : isAuthenticated ? (
            emailMatches ? (
              <Button variant="gradient" className="w-full" onClick={handleAccept} disabled={accepting}>
                {accepting ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Check className="h-4 w-4 mr-2" />}
                {t("team_invite.accept")}
              </Button>
            ) : (
              <div className="space-y-3">
                <p className="text-sm text-amber-600 text-center">{t("team_invite.wrong_account")}</p>
                <Button
                  variant="outline" className="w-full"
                  onClick={() => { logout(); }}
                >
                  {t("team_invite.logout_and_login")}
                </Button>
              </div>
            )
          ) : invitation.email_registered ? (
            <Button variant="gradient" className="w-full" asChild>
              <Link to={`/login?redirect=${encodeURIComponent(`/invitation/${token}`)}`}>
                {t("team_invite.login_to_accept")}
              </Link>
            </Button>
          ) : (
            <div className="space-y-3">
              <div className="text-center">
                <p className="font-medium text-aurora-ink text-sm">{t("team_invite.create_account")}</p>
                <p className="text-xs text-aurora-ink-3">{t("team_invite.create_account_desc")}</p>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>{t("team_invite.first_name")}</Label>
                  <Input value={firstName} onChange={(e) => setFirstName(e.target.value)} className="mt-1" />
                </div>
                <div>
                  <Label>{t("team_invite.last_name")}</Label>
                  <Input value={lastName} onChange={(e) => setLastName(e.target.value)} className="mt-1" />
                </div>
              </div>
              <div>
                <Label>{t("team_invite.password")}</Label>
                <Input
                  type="password" value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="mt-1"
                  placeholder={t("team_invite.password_hint")}
                />
              </div>
              {formError && <p className="text-sm text-red-600">{formError}</p>}
              <Button
                variant="gradient" className="w-full"
                onClick={handleRegister}
                disabled={registering || !password}
              >
                {registering ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : null}
                {t("team_invite.register_and_join")}
              </Button>
              <Button variant="ghost" className="w-full" asChild>
                <Link to={`/login?redirect=${encodeURIComponent(`/invitation/${token}`)}`}>
                  {t("team_invite.login_to_accept")}
                </Link>
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
