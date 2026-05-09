import { useEffect, useMemo, useState } from "react"
import { useParams } from "react-router-dom"
import { completeSignSession, getSignSession } from "@/lib/apiExtra"
import { SignaturePad } from "@/components/shared/SignaturePad"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { CheckCircle2, Loader2, PenTool, ShieldCheck } from "lucide-react"

export default function SignMobile() {
  const { token } = useParams<{ token: string }>()
  const [loading, setLoading] = useState(true)
  const [invalid, setInvalid] = useState(false)
  const [done, setDone] = useState(false)
  const [sessionInfo, setSessionInfo] = useState<any | null>(null)
  const [signature, setSignature] = useState<string | null>(null)
  const [accept, setAccept] = useState(false)
  const [mode, setMode] = useState<"draw" | "brand_name" | "person_name">("draw")
  const [sending, setSending] = useState(false)

  useEffect(() => {
    let mounted = true
    const load = async () => {
      if (!token) {
        setInvalid(true)
        setLoading(false)
        return
      }
      try {
        const session = await getSignSession(token)
        if (mounted) {
          setSessionInfo(session)
        }
        if (session.used) {
          if (mounted) {
            setDone(true)
            setLoading(false)
          }
          return
        }
        if (mounted) {
          setLoading(false)
        }
      } catch {
        if (mounted) {
          setInvalid(true)
          setLoading(false)
        }
      }
    }
    load()
    return () => {
      mounted = false
    }
  }, [token])

  const signAsLabel = useMemo(() => {
    return sessionInfo?.signer_label || "Signataire"
  }, [sessionInfo])

  const submit = async () => {
    if (!token) return
    if (mode === "draw" && !signature) return
    if (!accept) return
    setSending(true)
    try {
      await completeSignSession(token, {
        consent: accept,
        signature_mode: mode,
        signature_value: mode === "draw" ? undefined : signAsLabel,
        signature_data: mode === "draw" ? signature : null,
      })
      setDone(true)
    } catch {
      setInvalid(true)
    } finally {
      setSending(false)
    }
  }

  if (loading) {
    return <div className="min-h-screen flex items-center justify-center text-gray-500"><Loader2 className="h-5 w-5 animate-spin mr-2" />Chargement…</div>
  }

  if (invalid) {
    return (
      <div className="min-h-screen bg-gray-50 p-4 flex items-center justify-center">
        <Card className="w-full max-w-md">
          <CardHeader><CardTitle className="text-base">Lien invalide ou expiré</CardTitle></CardHeader>
          <CardContent className="text-sm text-gray-600">Ce lien de signature est invalide, expiré ou déjà utilisé.</CardContent>
        </Card>
      </div>
    )
  }

  if (done) {
    return (
      <div className="min-h-screen bg-gray-50 p-4 flex items-center justify-center">
        <Card className="w-full max-w-md">
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2"><CheckCircle2 className="h-5 w-5 text-emerald-600" />Signature enregistrée</CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-gray-600">Vous pouvez revenir sur votre ordinateur, la fenêtre de signature se met à jour automatiquement.</CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50 p-4">
      <div className="max-w-md mx-auto space-y-4">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Signature électronique</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex gap-2 items-start p-3 bg-blue-50 border border-blue-200 rounded-lg text-xs text-blue-800">
              <ShieldCheck className="h-4 w-4 shrink-0 mt-0.5" />
              <p>Votre signature, votre IP et l'horodatage seront enregistrés (eIDAS).</p>
            </div>

            <div className="space-y-2">
              <button type="button" className={`w-full text-left p-2 rounded-lg border ${mode === "draw" ? "border-indigo-500 bg-indigo-50" : "border-gray-200"}`} onClick={() => setMode("draw")}>Signature manuscrite</button>
              <button type="button" className={`w-full text-left p-2 rounded-lg border ${mode === "brand_name" ? "border-indigo-500 bg-indigo-50" : "border-gray-200"}`} onClick={() => setMode("brand_name")}>Signer avec {signAsLabel}</button>
              <button type="button" className={`w-full text-left p-2 rounded-lg border ${mode === "person_name" ? "border-indigo-500 bg-indigo-50" : "border-gray-200"}`} onClick={() => setMode("person_name")}>Signer en nom propre</button>
            </div>

            {mode === "draw" ? (
              <SignaturePad onChange={setSignature} />
            ) : (
              <div className="rounded-xl border border-gray-200 bg-gray-50 px-3 py-4 text-sm text-gray-700">
                Signature enregistrée sous : <span className="font-semibold text-gray-900">{signAsLabel}</span>
              </div>
            )}

            <label className="flex items-start gap-2 text-sm text-gray-700">
              <input type="checkbox" className="mt-1" checked={accept} onChange={(e) => setAccept(e.target.checked)} />
              <span>J'ai lu le contrat et j'accepte ses termes.</span>
            </label>

            <Button className="w-full" variant="gradient" onClick={submit} disabled={sending || !accept || (mode === "draw" && !signature)}>
              {sending ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <PenTool className="h-4 w-4 mr-2" />}
              Signer le contrat
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
