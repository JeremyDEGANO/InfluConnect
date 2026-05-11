import { type ClassValue, clsx } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function resolveMediaUrl(url?: string | null): string | undefined {
  if (!url) return undefined
  if (/^https?:\/\//i.test(url)) {
    if (typeof window !== "undefined" && window.location.protocol === "https:") {
      try {
        const parsed = new URL(url)
        // Avoid mixed-content blocks when backend absolute URLs are emitted as http on same host.
        if (parsed.protocol === "http:" && parsed.hostname === window.location.hostname) {
          parsed.protocol = "https:"
          return parsed.toString()
        }
      } catch {
        // Keep original URL if parsing fails.
      }
    }
    return url
  }

  const rawBase = import.meta.env.VITE_API_BASE_URL as string | undefined
  if (rawBase === "" || rawBase === "/") {
    return url
  }

  const apiOrigin = rawBase === undefined
    ? "http://localhost:8000"
    : rawBase.replace(/\/$/, "")

  if (url.startsWith("/")) return `${apiOrigin}${url}`
  return `${apiOrigin}/${url}`
}
