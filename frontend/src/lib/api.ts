import axios from "axios"

// VITE_API_BASE_URL:
//   - unset            → http://localhost:8000/api  (dev default)
//   - "" or "/"        → /api                       (same origin, e.g. prod behind Caddy)
//   - "https://x.com"  → https://x.com/api
const rawBase = import.meta.env.VITE_API_BASE_URL
const resolvedBase =
  rawBase === undefined
    ? "http://localhost:8000/api"
    : rawBase === "" || rawBase === "/"
    ? "/api"
    : `${rawBase.replace(/\/$/, "")}/api`

const api = axios.create({
  baseURL: resolvedBase,
  headers: { "Content-Type": "application/json" },
})

api.interceptors.request.use((config) => {
  const token = localStorage.getItem("access_token")
  if (token && config.headers) {
    config.headers.Authorization = `Bearer ${token}`
  }
  return config
})

api.interceptors.response.use(
  (res) => res,
  async (error) => {
    const original = error.config
    if (
      error.response?.status === 401 &&
      !original._retry &&
      !original.url?.includes("/auth/")
    ) {
      original._retry = true
      const refresh = localStorage.getItem("refresh_token")
      if (refresh) {
        try {
          const { data } = await axios.post(
            `${api.defaults.baseURL}/auth/refresh/`,
            { refresh },
          )
          localStorage.setItem("access_token", data.access)
          if (original.headers) {
            original.headers.Authorization = `Bearer ${data.access}`
          }
          return api(original)
        } catch {
          localStorage.removeItem("access_token")
          localStorage.removeItem("refresh_token")
          window.location.href = "/login"
        }
      }
    }
    return Promise.reject(error)
  },
)

export default api
