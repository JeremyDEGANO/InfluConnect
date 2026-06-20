import { useEffect } from "react"
import { useNavigate } from "react-router-dom"
import { isNative, setupStatusBar, deepLinkToPath, closeInAppBrowser } from "@/lib/native"

/**
 * Pont entre le runtime Capacitor et le router React :
 * - deep links (retour SSO influconnect://login/sso?code=...)
 * - bouton retour Android (back navigation puis mise en arrière-plan)
 * - barre de statut
 * Monté une seule fois sous le Router, ne rend rien.
 */
export function NativeBridge() {
  const navigate = useNavigate()

  useEffect(() => {
    if (!isNative) return
    let disposed = false
    const subs: Array<{ remove: () => void }> = []

    setupStatusBar()
    ;(async () => {
      const { App: CapApp } = await import("@capacitor/app")

      const urlSub = await CapApp.addListener("appUrlOpen", async ({ url }) => {
        const path = deepLinkToPath(url)
        if (!path) return
        await closeInAppBrowser()
        navigate(path)
      })

      const backSub = await CapApp.addListener("backButton", ({ canGoBack }) => {
        if (canGoBack) window.history.back()
        else CapApp.minimizeApp()
      })

      if (disposed) {
        urlSub.remove()
        backSub.remove()
      } else {
        subs.push(urlSub, backSub)
      }
    })()

    return () => {
      disposed = true
      subs.forEach((s) => s.remove())
    }
  }, [navigate])

  return null
}
