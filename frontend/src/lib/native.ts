// Couche d'intégration Capacitor : tout ce qui touche au natif passe par ici.
// Les plugins sont importés dynamiquement pour ne rien peser sur le bundle web.
import { Capacitor } from "@capacitor/core"

export const isNative = Capacitor.isNativePlatform()
export const nativePlatform = Capacitor.getPlatform() as "ios" | "android" | "web"

if (isNative && typeof document !== "undefined") {
  document.documentElement.classList.add("native-app")
}

/** Style de la barre de statut aligné sur le header blanc de l'app. */
export async function setupStatusBar(): Promise<void> {
  if (!isNative) return
  try {
    const { StatusBar, Style } = await import("@capacitor/status-bar")
    await StatusBar.setStyle({ style: Style.Light })
    if (nativePlatform === "android") {
      await StatusBar.setBackgroundColor({ color: "#ffffff" })
    }
  } catch {
    // Plugin absent (ex: bundle web servi en natif avant cap update) : non bloquant
  }
}

/** Ouvre une URL dans le navigateur système (Custom Tab / SFSafariViewController). */
export async function openExternal(url: string): Promise<void> {
  if (isNative) {
    const { Browser } = await import("@capacitor/browser")
    await Browser.open({ url })
  } else {
    window.location.href = url
  }
}

/** Ferme le navigateur in-app ouvert par openExternal (retour deep link). */
export async function closeInAppBrowser(): Promise<void> {
  if (!isNative) return
  try {
    const { Browser } = await import("@capacitor/browser")
    await Browser.close()
  } catch {
    // Déjà fermé par l'utilisateur
  }
}

/** influconnect://login/sso?code=x → /login/sso?code=x (null si schéma inconnu). */
export function deepLinkToPath(url: string): string | null {
  const m = url.match(/^influconnect:\/\/(.+)$/i)
  if (!m) return null
  const path = "/" + m[1].replace(/^\/+/, "")
  // Garde-fou : uniquement des chemins internes
  return path.startsWith("//") ? null : path
}

const SCAN_CANCELLED = /cancel/i

/**
 * Scan d'un QR code plein écran via ML Kit (Google code scanner).
 * Retourne la valeur lue, ou null si l'utilisateur annule.
 */
export async function scanQrCode(): Promise<string | null> {
  if (!isNative) return null
  const { BarcodeScanner, BarcodeFormat } = await import("@capacitor-mlkit/barcode-scanning")

  if (nativePlatform === "android") {
    // Le scanner "prêt à l'emploi" dépend d'un module Play Services téléchargé à la demande.
    const { available } = await BarcodeScanner.isGoogleBarcodeScannerModuleAvailable()
    if (!available) {
      await BarcodeScanner.installGoogleBarcodeScannerModule()
      const deadline = Date.now() + 30_000
      while (Date.now() < deadline) {
        await new Promise((r) => setTimeout(r, 500))
        const check = await BarcodeScanner.isGoogleBarcodeScannerModuleAvailable()
        if (check.available) break
      }
    }
  }

  try {
    const { barcodes } = await BarcodeScanner.scan({ formats: [BarcodeFormat.QrCode] })
    return barcodes[0]?.rawValue?.trim() || null
  } catch (err) {
    if (err instanceof Error && SCAN_CANCELLED.test(err.message)) return null
    throw err
  }
}
