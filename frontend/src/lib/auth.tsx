import {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  type ReactNode,
} from "react"
import api from "./api"

export interface User {
  id: number
  username: string
  email: string
  first_name: string
  last_name: string
  user_type: "influencer" | "brand" | "admin"
  language_preference: string
  avatar: string | null
  phone: string
  location: string
  totp_enabled?: boolean
  email_2fa_enabled?: boolean
  created_at: string
  updated_at: string
  influencer_profile?: Record<string, unknown>
  brand_profile?: Record<string, unknown>
  brand_environments?: Array<{ id: number; company_name: string; is_agency: boolean; role: string | null }>
  active_brand_workspace_id?: number | null
  active_brand_role?: string | null
  active_brand?: {
    id: number
    company_name: string
    is_agency: boolean
    validation_status: string
    subscription_plan: string | null
    subscription_active: boolean
  } | null
}

export type LoginResult =
  | { user: User; totp_required?: false; email_otp_required?: false }
  | { user: null; totp_required: true; email_otp_required?: false }
  | { user: null; email_otp_required: true; totp_required?: false }

interface AuthState {
  user: User | null
  isAuthenticated: boolean
  isLoading: boolean
  login: (username: string, password: string, totpCode?: string, emailOtpCode?: string) => Promise<LoginResult>
  register: (data: Record<string, string | boolean>) => Promise<User>
  switchBrandWorkspace: (brandId: number) => Promise<void>
  createBrandWorkspace: (companyName: string) => Promise<void>
  logout: () => void
  refreshUser: () => Promise<void>
}

const AuthContext = createContext<AuthState | undefined>(undefined)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  const fetchUser = useCallback(async () => {
    const token = localStorage.getItem("access_token")
    if (!token) {
      setUser(null)
      setIsLoading(false)
      return
    }
    try {
      const { data } = await api.get("/auth/me/")
      if (data?.active_brand_workspace_id) {
        localStorage.setItem("selected_brand_id", String(data.active_brand_workspace_id))
      } else {
        localStorage.removeItem("selected_brand_id")
      }
      setUser(data)
    } catch {
      localStorage.removeItem("access_token")
      localStorage.removeItem("refresh_token")
      setUser(null)
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchUser()
  }, [fetchUser])

  const login = async (username: string, password: string, totpCode?: string, emailOtpCode?: string): Promise<LoginResult> => {
    const payload: Record<string, string> = { username, password }
    if (totpCode) payload.totp_code = totpCode
    if (emailOtpCode) payload.email_otp_code = emailOtpCode
    const { data } = await api.post("/auth/login/", payload)
    if (data?.totp_required && !data.access) {
      return { user: null, totp_required: true }
    }
    if (data?.email_otp_required && !data.access) {
      return { user: null, email_otp_required: true }
    }
    localStorage.setItem("access_token", data.access)
    localStorage.setItem("refresh_token", data.refresh)
    if (data?.user?.active_brand_workspace_id) {
      localStorage.setItem("selected_brand_id", String(data.user.active_brand_workspace_id))
    } else {
      localStorage.removeItem("selected_brand_id")
    }
    setUser(data.user)
    return { user: data.user }
  }

  const register = async (payload: Record<string, string | boolean>): Promise<User> => {
    const { data } = await api.post("/auth/register/", payload)
    localStorage.setItem("access_token", data.access)
    localStorage.setItem("refresh_token", data.refresh)
    if (data?.user?.active_brand_workspace_id) {
      localStorage.setItem("selected_brand_id", String(data.user.active_brand_workspace_id))
    } else {
      localStorage.removeItem("selected_brand_id")
    }
    setUser(data.user)
    return data.user
  }

  const switchBrandWorkspace = async (brandId: number): Promise<void> => {
    await api.post("/brands/environments/switch/", { brand_id: brandId })
    localStorage.setItem("selected_brand_id", String(brandId))
    await fetchUser()
  }

  const createBrandWorkspace = async (companyName: string): Promise<void> => {
    const { data } = await api.post("/brands/environments/", { company_name: companyName })
    if (data?.id) {
      localStorage.setItem("selected_brand_id", String(data.id))
    }
    await fetchUser()
  }

  const logout = () => {
    localStorage.removeItem("access_token")
    localStorage.removeItem("refresh_token")
    localStorage.removeItem("selected_brand_id")
    setUser(null)
  }

  return (
    <AuthContext.Provider
      value={{
        user,
        isAuthenticated: !!user,
        isLoading,
        login,
        register,
        switchBrandWorkspace,
        createBrandWorkspace,
        logout,
        refreshUser: fetchUser,
      }}
    >
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error("useAuth must be used within AuthProvider")
  return ctx
}
