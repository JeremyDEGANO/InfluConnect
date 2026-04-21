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
  created_at: string
  updated_at: string
  influencer_profile?: Record<string, unknown>
  brand_profile?: Record<string, unknown>
}

export type LoginResult = { user: User; totp_required?: false } | { user: null; totp_required: true }

interface AuthState {
  user: User | null
  isAuthenticated: boolean
  isLoading: boolean
  login: (username: string, password: string, totpCode?: string) => Promise<LoginResult>
  register: (data: Record<string, string>) => Promise<User>
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

  const login = async (username: string, password: string, totpCode?: string): Promise<LoginResult> => {
    const payload: Record<string, string> = { username, password }
    if (totpCode) payload.totp_code = totpCode
    const { data } = await api.post("/auth/login/", payload)
    if (data?.totp_required && !data.access) {
      return { user: null, totp_required: true }
    }
    localStorage.setItem("access_token", data.access)
    localStorage.setItem("refresh_token", data.refresh)
    setUser(data.user)
    return { user: data.user }
  }

  const register = async (payload: Record<string, string>): Promise<User> => {
    const { data } = await api.post("/auth/register/", payload)
    localStorage.setItem("access_token", data.access)
    localStorage.setItem("refresh_token", data.refresh)
    setUser(data.user)
    return data.user
  }

  const logout = () => {
    localStorage.removeItem("access_token")
    localStorage.removeItem("refresh_token")
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
