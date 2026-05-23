import { useState } from "react"
import { Mail, MapPin, Phone, Send, CheckCircle2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"

export default function Contact() {
  const [submitted, setSubmitted] = useState(false)
  const [form, setForm] = useState({ name: "", email: "", subject: "", message: "" })

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    // TODO: brancher backend (POST /api/contact/) — pour l'instant : confirmation visuelle
    setSubmitted(true)
  }

  return (
    <div className="min-h-screen bg-white">
      <section className="hero-aurora-bg py-20 px-5">
        <div className="container max-w-4xl mx-auto text-center">
          <span className="text-[11px] font-semibold text-aurora-blue tracking-[0.18em] uppercase">Contact</span>
          <h1 className="text-5xl sm:text-6xl font-semibold text-aurora-ink mt-3 tracking-[-0.04em] text-balance">
            Discutons de votre projet.
          </h1>
          <p className="text-lg text-aurora-ink-2 mt-5 max-w-xl mx-auto text-pretty">
            Notre équipe vous répond sous 24 h ouvrées. Pour le support produit, consultez d'abord notre centre d'aide.
          </p>
        </div>
      </section>

      <section className="py-20 px-5">
        <div className="container max-w-5xl mx-auto grid md:grid-cols-3 gap-10">
          <div className="space-y-6">
            <div className="flex items-start gap-3">
              <div className="h-10 w-10 rounded-xl bg-aurora-blue/10 flex items-center justify-center shrink-0">
                <Mail className="h-4 w-4 text-aurora-blue-deep" />
              </div>
              <div>
                <h3 className="font-semibold text-aurora-ink text-sm">Email</h3>
                <a href="mailto:hello@influconnect.fr" className="text-[13px] text-aurora-ink-2 hover:text-aurora-blue">hello@influconnect.fr</a>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <div className="h-10 w-10 rounded-xl bg-aurora-blue/10 flex items-center justify-center shrink-0">
                <Phone className="h-4 w-4 text-aurora-blue-deep" />
              </div>
              <div>
                <h3 className="font-semibold text-aurora-ink text-sm">Téléphone</h3>
                <p className="text-[13px] text-aurora-ink-2">+33 1 86 65 00 00</p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <div className="h-10 w-10 rounded-xl bg-aurora-blue/10 flex items-center justify-center shrink-0">
                <MapPin className="h-4 w-4 text-aurora-blue-deep" />
              </div>
              <div>
                <h3 className="font-semibold text-aurora-ink text-sm">Adresse</h3>
                <p className="text-[13px] text-aurora-ink-2">12 rue Réaumur<br />75002 Paris, France</p>
              </div>
            </div>
          </div>

          <div className="md:col-span-2">
            {submitted ? (
              <div className="bg-aurora-surface rounded-3xl border border-aurora-line p-10 text-center">
                <div className="h-12 w-12 rounded-full bg-emerald-500/10 flex items-center justify-center mx-auto mb-4">
                  <CheckCircle2 className="h-6 w-6 text-emerald-600" />
                </div>
                <h3 className="text-xl font-semibold text-aurora-ink tracking-tight">Message envoyé</h3>
                <p className="text-aurora-ink-2 mt-2">Notre équipe vous recontacte sous 24 h ouvrées.</p>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="bg-aurora-surface rounded-3xl border border-aurora-line p-8 space-y-4">
                <div className="grid sm:grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs font-semibold text-aurora-ink mb-1.5 block">Nom complet</label>
                    <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required />
                  </div>
                  <div>
                    <label className="text-xs font-semibold text-aurora-ink mb-1.5 block">Email professionnel</label>
                    <Input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} required />
                  </div>
                </div>
                <div>
                  <label className="text-xs font-semibold text-aurora-ink mb-1.5 block">Sujet</label>
                  <Input value={form.subject} onChange={(e) => setForm({ ...form, subject: e.target.value })} required />
                </div>
                <div>
                  <label className="text-xs font-semibold text-aurora-ink mb-1.5 block">Message</label>
                  <textarea
                    rows={5}
                    value={form.message}
                    onChange={(e) => setForm({ ...form, message: e.target.value })}
                    required
                    className="flex w-full rounded-xl border border-aurora-line bg-white px-4 py-3 text-sm text-aurora-ink placeholder:text-aurora-ink-3 focus-visible:outline-none focus-visible:border-aurora-blue focus-visible:ring-4 focus-visible:ring-aurora-blue/15"
                  />
                </div>
                <Button type="submit" variant="gradient" className="w-full sm:w-auto">
                  <Send className="h-4 w-4" /> Envoyer le message
                </Button>
                <p className="text-[11px] text-aurora-ink-3">En soumettant ce formulaire, vous acceptez notre politique de confidentialité.</p>
              </form>
            )}
          </div>
        </div>
      </section>
    </div>
  )
}
