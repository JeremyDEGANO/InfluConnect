import { useState, FormEvent } from "react"
import { Link, useNavigate } from "react-router-dom"
import { useTranslation } from "react-i18next"
import { useAuth } from "@/lib/auth"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { useToast } from "@/hooks/use-toast"
import { Loader2, Eye, EyeOff } from "lucide-react"

export default function Login() {
  const { t } = useTranslation()
  const { login } = useAuth()
  const navigate = useNavigate()
  const { toast } = useToast()
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [showPw, setShowPw] = useState(false)
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setLoading(true)
    try {
      await login(email, password)
      const userStr = localStorage.getItem("user")
      const user = userStr ? JSON.parse(userStr) : null
      if (user?.user_type === "brand") navigate("/brand/dashboard")
      else if (user?.user_type === "admin") navigate("/admin")
      else navigate("/influencer/dashboard")
    } catch {
      toast({ variant: "destructive", title: "Login failed", description: "Invalid credentials. Please try again." })
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-purple-50 via-indigo-50 to-blue-50 px-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <Link to="/" className="text-2xl font-bold gradient-text">InfluConnect ✨</Link>
        </div>
        <Card className="card-base shadow-xl">
          <CardHeader className="text-center pb-2">
            <CardTitle className="text-2xl font-bold">{t("auth.login")}</CardTitle>
            <CardDescription>Welcome back! Enter your credentials</CardDescription>
          </CardHeader>
          <CardContent className="pt-4">
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <Label htmlFor="email">{t("auth.email")}</Label>
                <Input id="email" type="email" placeholder="you@example.com" value={email} onChange={(e) => setEmail(e.target.value)} required className="mt-1" />
              </div>
              <div>
                <div className="flex items-center justify-between mb-1">
                  <Label htmlFor="password">{t("auth.password")}</Label>
                  <a href="#" className="text-xs text-purple-600 hover:underline">{t("auth.forgot_password")}</a>
                </div>
                <div className="relative">
                  <Input id="password" type={showPw ? "text" : "password"} placeholder="••••••••" value={password} onChange={(e) => setPassword(e.target.value)} required />
                  <button type="button" onClick={() => setShowPw(!showPw)} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                    {showPw ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>
              <Button type="submit" variant="gradient" className="w-full" disabled={loading}>
                {loading ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" />{t("common.loading")}</> : t("auth.login")}
              </Button>
            </form>
            <p className="text-center text-sm text-gray-500 mt-4">
              {t("auth.no_account")}{" "}
              <Link to="/register" className="text-purple-600 font-medium hover:underline">{t("auth.register")}</Link>
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
