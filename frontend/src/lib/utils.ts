import { type ClassValue, clsx } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function resolveMediaUrl(url?: string | null): string | undefined {
  if (!url) return undefined
  if (/^https?:\/\//i.test(url)) return url

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
