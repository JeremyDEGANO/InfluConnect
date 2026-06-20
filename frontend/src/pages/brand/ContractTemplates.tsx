import { useEffect, useRef, useState } from "react"
import { useTranslation } from "react-i18next"
import type { Editor } from "@tiptap/react"
import api, { apiErrorMessage } from "@/lib/api"
import { fetchContractTemplates } from "@/lib/apiExtra"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { useToast } from "@/hooks/use-toast"
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog"
import {
  ScrollText, Loader2, Plus, Trash2, Upload, Pencil, FileText, Gift,
  Crown, Eye, EyeOff, Sparkles,
} from "lucide-react"
import TipTapEditor from "@/components/shared/TipTapEditor"

interface Template {
  id: number
  name: string
  description: string
  body_html: string
  is_default: boolean
  created_at: string
}

// ---------------------------------------------------------------------------
// Merge variables (DocuSign-style merge fields) + sample values for preview
// ---------------------------------------------------------------------------
const VARIABLES: { code: string; labelKey: string; fallback: string; sample: string }[] = [
  { code: "brand_name", labelKey: "contracts.var_brand", fallback: "Marque", sample: "Maison Lumière" },
  { code: "influencer_name", labelKey: "contracts.var_influencer", fallback: "Influenceur", sample: "Léa Martin (@lea.glow)" },
  { code: "campaign_title", labelKey: "contracts.var_campaign", fallback: "Campagne", sample: "Lancement été 2026" },
  { code: "price", labelKey: "contracts.var_price", fallback: "Rémunération", sample: "850,00 €" },
  { code: "deadline", labelKey: "contracts.var_deadline", fallback: "Échéance", sample: "30/08/2026" },
  { code: "deliverables", labelKey: "contracts.var_deliverables", fallback: "Livrables", sample: "1 Reel Instagram + 3 stories" },
  { code: "rights", labelKey: "contracts.var_rights", fallback: "Droits d'image", sample: "Réutilisation organique 12 mois" },
  { code: "proposal_reference", labelKey: "contracts.var_reference", fallback: "Référence", sample: "IC-2026-00314" },
  { code: "signature1", labelKey: "contracts.var_signature1", fallback: "Signature marque", sample: "________________ (Marque)" },
  { code: "signature2", labelKey: "contracts.var_signature2", fallback: "Signature influenceur", sample: "________________ (Influenceur)" },
]

const fillSample = (html: string) =>
  VARIABLES.reduce(
    (acc, v) => acc.replaceAll(`{{${v.code}}}`, `<mark style="background:#eef2ff;color:#3730a3;border-radius:3px;padding:0 3px;">${v.sample}</mark>`),
    html,
  )

// ---------------------------------------------------------------------------
// Ready-to-use starter templates (adapt then save — like the DocuSign gallery)
// ---------------------------------------------------------------------------
const STARTERS: { key: string; nameKey: string; nameFallback: string; descKey: string; descFallback: string; icon: typeof FileText; body: string }[] = [
  {
    key: "paid",
    nameKey: "contracts.starter_paid", nameFallback: "Collaboration rémunérée",
    descKey: "contracts.starter_paid_desc", descFallback: "Contrat complet conforme à la loi influence du 9 juin 2023 : livrables, validation, cession de droits, rémunération.",
    icon: FileText,
    body: `<h1>Contrat de collaboration commerciale d'influence</h1>
<p><strong>Campagne :</strong> {{campaign_title}} — <strong>Référence :</strong> {{proposal_reference}}</p>
<h2>Entre les soussignés</h2>
<p><strong>{{brand_name}}</strong>, [forme sociale, capital social, siège social, n° SIREN, représentée par — qualité], ci-après « l'Annonceur »,</p>
<p>et <strong>{{influencer_name}}</strong>, [statut juridique, adresse, n° SIREN/SIRET le cas échéant], exerçant l'activité d'influence commerciale au sens de l'article 1er de la loi n° 2023-451 du 9 juin 2023, ci-après « le Créateur »,</p>
<p>ci-après désignés ensemble « les Parties ».</p>
<h2>Préambule</h2>
<p>L'Annonceur souhaite promouvoir ses produits ou services dans le cadre de la campagne « {{campaign_title}} ». Le Créateur dispose d'une audience sur les réseaux sociaux et accepte de réaliser, en toute indépendance, une prestation de création et de publication de contenus. Le présent contrat est conclu par écrit conformément à l'article 8 de la loi n° 2023-451 du 9 juin 2023.</p>
<h2>Article 1 — Objet</h2>
<p>Le présent contrat a pour objet de définir les conditions dans lesquelles le Créateur produit et publie, pour le compte de l'Annonceur, les contenus décrits à l'article 2, ainsi que l'étendue des droits cédés et la rémunération correspondante.</p>
<h2>Article 2 — Livrables et calendrier</h2>
<p>Le Créateur s'engage à concevoir, produire et publier les livrables suivants : <strong>{{deliverables}}</strong>.</p>
<p>L'intégralité des livrables devra être publiée au plus tard le <strong>{{deadline}}</strong>, sur les comptes et plateformes convenus entre les Parties. Tout report devra faire l'objet d'un accord écrit préalable.</p>
<h2>Article 3 — Brief et validation préalable</h2>
<p>L'Annonceur communique au Créateur un brief précisant les messages clés, les éléments imposés et les interdits. Chaque contenu est soumis à l'Annonceur pour validation avant publication via la plateforme InfluConnect. L'Annonceur dispose de cinq (5) jours ouvrés pour valider ou formuler des demandes de modification raisonnables ; à défaut de réponse dans ce délai, le contenu est réputé validé. Le Créateur conserve sa liberté éditoriale quant au ton et à la forme, dans le respect du brief.</p>
<h2>Article 4 — Rémunération et modalités de paiement</h2>
<p>En contrepartie de la prestation et de la cession de droits visée à l'article 5, l'Annonceur versera au Créateur la somme forfaitaire de <strong>{{price}}</strong> hors taxes, le cas échéant majorée de la TVA au taux en vigueur.</p>
<p>Cette somme est déposée sous séquestre sur la plateforme InfluConnect à la signature du présent contrat et libérée au profit du Créateur après validation définitive des contenus par l'Annonceur. Le Créateur émet une facture conforme aux exigences légales.</p>
<h2>Article 5 — Cession de droits de propriété intellectuelle</h2>
<p>Le Créateur cède à l'Annonceur les droits de reproduction, de représentation et d'adaptation des contenus, dans les conditions suivantes, conformément à l'article L. 131-3 du Code de la propriété intellectuelle :</p>
<ul>
<li><strong>Étendue et destination :</strong> {{rights}} ;</li>
<li><strong>Territoire :</strong> [monde entier / France / à préciser] ;</li>
<li><strong>Durée :</strong> [à préciser — ex. douze (12) mois à compter de la première publication].</li>
</ul>
<p>Toute exploitation excédant le périmètre ci-dessus (notamment publicité payante / « paid media », affichage, télévision) fera l'objet d'un avenant et d'une rémunération complémentaire. Le Créateur garantit être titulaire des droits sur les contenus livrés et que ceux-ci ne portent pas atteinte aux droits de tiers (musiques, marques, images, personnes identifiables).</p>
<h2>Article 6 — Obligations de transparence du Créateur</h2>
<p>Le Créateur s'engage à :</p>
<ul>
<li>faire figurer, de manière claire, lisible et identifiable pendant l'intégralité de chaque publication, la mention « <strong>Collaboration commerciale</strong> » ou « Publicité », conformément à l'article 5 de la loi n° 2023-451 du 9 juin 2023 et aux recommandations de l'ARPP ;</li>
<li>indiquer, le cas échéant, si les images ont été retouchées ou produites par intelligence artificielle ;</li>
<li>ne diffuser aucune allégation trompeuse au sens des articles L. 121-1 et suivants du Code de la consommation ;</li>
<li>respecter les interdictions et restrictions sectorielles applicables (notamment chirurgie et médecine esthétiques, produits financiers et crypto-actifs, jeux d'argent et de hasard, produits de santé, boissons alcooliques — loi Évin) ;</li>
<li>respecter les conditions d'utilisation des plateformes concernées.</li>
</ul>
<h2>Article 7 — Obligations de l'Annonceur</h2>
<p>L'Annonceur s'engage à fournir au Créateur, en temps utile, le brief, les éléments (produits, visuels, accès) et les informations légales nécessaires à la réalisation de la prestation, à procéder à la validation des contenus dans les délais convenus et à payer le prix selon les modalités de l'article 4. L'Annonceur est responsable de la conformité réglementaire des messages qu'il impose au Créateur.</p>
<h2>Article 8 — Indépendance des Parties</h2>
<p>Le Créateur exécute la prestation en qualité de professionnel indépendant. Le présent contrat n'emporte aucun lien de subordination, ni mandat, ni société entre les Parties. Le Créateur fait son affaire de ses obligations sociales, fiscales et déclaratives.</p>
<h2>Article 9 — Confidentialité</h2>
<p>Chaque Partie s'interdit de divulguer les informations confidentielles de l'autre Partie (brief, conditions financières, produits non commercialisés) pendant la durée du contrat et deux (2) ans après son terme.</p>
<h2>Article 10 — Données personnelles</h2>
<p>Chaque Partie traite les données personnelles de l'autre dans le respect du Règlement (UE) 2016/679 (RGPD) et de la loi Informatique et Libertés, aux seules fins de l'exécution du présent contrat.</p>
<h2>Article 11 — Résiliation</h2>
<p>En cas de manquement grave de l'une des Parties non réparé dans un délai de huit (8) jours suivant mise en demeure écrite, l'autre Partie pourra résilier le contrat de plein droit. Les contenus déjà validés et publiés restent régis par l'article 5 ; les sommes correspondant aux prestations réalisées restent dues.</p>
<h2>Article 12 — Droit applicable et juridiction</h2>
<p>Le présent contrat est soumis au droit français. À défaut de résolution amiable dans un délai de trente (30) jours, tout litige sera porté devant les tribunaux compétents de [ville], sans préjudice des règles protectrices applicables.</p>
<h2>Signatures</h2>
<p>Fait en deux exemplaires originaux, le [date].</p>
<p>{{signature1}}</p>
<p>{{signature2}}</p>`,
  },
  {
    key: "gifting",
    nameKey: "contracts.starter_gifting", nameFallback: "Gifting (dotation produits)",
    descKey: "contracts.starter_gifting_desc", descFallback: "Accord de dotation produits : valeur, contrepartie éventuelle, transparence et fiscalité de l'avantage en nature.",
    icon: Gift,
    body: `<h1>Accord de dotation produits (gifting)</h1>
<p><strong>Campagne :</strong> {{campaign_title}} — <strong>Référence :</strong> {{proposal_reference}}</p>
<h2>Entre les soussignés</h2>
<p><strong>{{brand_name}}</strong>, [forme sociale, siège social, n° SIREN, représentée par — qualité], ci-après « l'Annonceur »,</p>
<p>et <strong>{{influencer_name}}</strong>, [statut juridique, adresse], ci-après « le Créateur »,</p>
<p>ci-après désignés ensemble « les Parties ».</p>
<h2>Article 1 — Objet et dotation</h2>
<p>L'Annonceur remet au Créateur, à titre gratuit, les produits décrits dans le brief de campagne, d'une valeur commerciale indicative de [montant] € TTC. Cette dotation constitue un avantage en nature ; aucune rémunération en numéraire n'est due au titre du présent accord.</p>
<h2>Article 2 — Contrepartie de contenu</h2>
<p>[Option A — avec contrepartie] Le Créateur s'engage à produire et publier : <strong>{{deliverables}}</strong>, au plus tard le <strong>{{deadline}}</strong>. Les contenus sont soumis à validation préalable de l'Annonceur via la plateforme InfluConnect.</p>
<p>[Option B — sans contrepartie] La remise des produits n'est assortie d'aucune obligation de publication ; toute publication relève de la seule initiative éditoriale du Créateur.</p>
<h2>Article 3 — Transparence et conformité</h2>
<p>Dès lors qu'une publication est réalisée en contrepartie de la dotation, elle constitue une collaboration commerciale au sens de la loi n° 2023-451 du 9 juin 2023. Le Créateur s'engage en conséquence à :</p>
<ul>
<li>faire figurer de manière claire, lisible et identifiable, pendant l'intégralité de la publication, la mention « <strong>Collaboration commerciale</strong> » (ou, à défaut de contrepartie convenue, « Produit offert ») ;</li>
<li>ne diffuser aucune allégation trompeuse sur les produits (articles L. 121-1 et suivants du Code de la consommation) ;</li>
<li>respecter les restrictions sectorielles applicables ainsi que les conditions d'utilisation des plateformes.</li>
</ul>
<h2>Article 4 — Droits d'utilisation des contenus</h2>
<p>Le Créateur autorise l'Annonceur à repartager les contenus publiés dans les conditions suivantes : {{rights}}. Toute autre exploitation (publicité payante, supports hors plateformes sociales) fera l'objet d'un accord écrit distinct et, le cas échéant, d'une rémunération complémentaire.</p>
<h2>Article 5 — Fiscalité</h2>
<p>Le Créateur est informé que la valeur des produits reçus peut constituer un avantage imposable. Il fait son affaire de ses obligations fiscales, sociales et déclaratives.</p>
<h2>Article 6 — Indépendance des Parties</h2>
<p>Le présent accord n'emporte aucun lien de subordination entre les Parties ; le Créateur conserve son entière liberté éditoriale dans le respect de l'article 3.</p>
<h2>Article 7 — Droit applicable et juridiction</h2>
<p>Le présent accord est soumis au droit français. À défaut de résolution amiable, tout litige sera porté devant les tribunaux compétents de [ville].</p>
<h2>Signatures</h2>
<p>Fait en deux exemplaires originaux, le [date].</p>
<p>{{signature1}}</p>
<p>{{signature2}}</p>`,
  },
  {
    key: "ambassador",
    nameKey: "contracts.starter_ambassador", nameFallback: "Programme ambassadeur",
    descKey: "contracts.starter_ambassador_desc", descFallback: "Partenariat long terme : engagements mensuels, exclusivité encadrée, rémunération récurrente, résiliation avec préavis.",
    icon: Crown,
    body: `<h1>Contrat de partenariat — Programme ambassadeur</h1>
<p><strong>Programme :</strong> {{campaign_title}} — <strong>Référence :</strong> {{proposal_reference}}</p>
<h2>Entre les soussignés</h2>
<p><strong>{{brand_name}}</strong>, [forme sociale, capital social, siège social, n° SIREN, représentée par — qualité], ci-après « l'Annonceur »,</p>
<p>et <strong>{{influencer_name}}</strong>, [statut juridique, adresse, n° SIREN/SIRET le cas échéant], ci-après « l'Ambassadeur »,</p>
<p>ci-après désignés ensemble « les Parties ».</p>
<h2>Article 1 — Objet</h2>
<p>L'Annonceur confie à l'Ambassadeur, qui l'accepte, une mission de représentation et de promotion de la marque dans la durée, dans les conditions du présent contrat, conclu par écrit conformément à la loi n° 2023-451 du 9 juin 2023.</p>
<h2>Article 2 — Mission et livrables mensuels</h2>
<p>L'Ambassadeur s'engage à produire et publier chaque mois : <strong>{{deliverables}}</strong>, selon le calendrier éditorial convenu entre les Parties. Chaque contenu est soumis à validation préalable de l'Annonceur via la plateforme InfluConnect ; l'absence de réponse sous cinq (5) jours ouvrés vaut validation.</p>
<h2>Article 3 — Durée et renouvellement</h2>
<p>Le présent contrat prend effet à sa signature et court jusqu'au <strong>{{deadline}}</strong>. Il est renouvelable par avenant écrit signé des deux Parties. Le renouvellement n'est jamais tacite.</p>
<h2>Article 4 — Rémunération</h2>
<p>L'Annonceur versera à l'Ambassadeur une rémunération mensuelle forfaitaire de <strong>{{price}}</strong> hors taxes, le cas échéant majorée de la TVA, payable après validation des livrables du mois et sur présentation d'une facture conforme. Les sommes transitent par le séquestre de la plateforme InfluConnect.</p>
<h2>Article 5 — Exclusivité</h2>
<p>Pendant la durée du contrat, l'Ambassadeur s'interdit de promouvoir, à titre onéreux ou gratuit, des produits ou services directement concurrents de ceux de l'Annonceur dans la catégorie suivante : [catégorie précise — ex. cosmétiques de soin]. Cette exclusivité, strictement limitée à la catégorie définie et à la durée du contrat, est rémunérée par la rémunération forfaitaire de l'article 4.</p>
<h2>Article 6 — Cession de droits de propriété intellectuelle</h2>
<p>L'Ambassadeur cède à l'Annonceur les droits de reproduction, de représentation et d'adaptation des contenus produits au titre du programme, conformément à l'article L. 131-3 du Code de la propriété intellectuelle :</p>
<ul>
<li><strong>Étendue et destination :</strong> {{rights}} ;</li>
<li><strong>Territoire :</strong> [à préciser] ;</li>
<li><strong>Durée :</strong> [à préciser].</li>
</ul>
<p>Toute exploitation excédant ce périmètre fera l'objet d'un avenant et d'une rémunération complémentaire.</p>
<h2>Article 7 — Transparence et conformité</h2>
<p>L'Ambassadeur fera figurer sur chaque publication, de manière claire, lisible et identifiable pendant toute sa durée, la mention « <strong>Collaboration commerciale</strong> », conformément à la loi n° 2023-451 du 9 juin 2023 et aux recommandations de l'ARPP, et s'interdit toute allégation trompeuse ainsi que toute promotion relevant des secteurs interdits ou restreints par la réglementation.</p>
<h2>Article 8 — Image et non-dénigrement</h2>
<p>Chaque Partie s'interdit, pendant la durée du contrat et deux (2) ans après son terme, tout propos public de nature à porter atteinte à l'image ou à la réputation de l'autre Partie. L'Ambassadeur veille à ce que son comportement public ne porte pas un préjudice manifeste à la marque.</p>
<h2>Article 9 — Indépendance des Parties</h2>
<p>L'Ambassadeur exécute sa mission en qualité de professionnel indépendant, sans lien de subordination. Il fait son affaire de ses obligations sociales, fiscales et déclaratives.</p>
<h2>Article 10 — Confidentialité et données personnelles</h2>
<p>Les Parties s'engagent à la confidentialité sur les informations non publiques échangées (conditions financières, lancements à venir) pendant la durée du contrat et deux (2) ans après son terme, et traitent les données personnelles conformément au RGPD.</p>
<h2>Article 11 — Résiliation</h2>
<p>Chaque Partie peut résilier le contrat : (i) pour manquement grave non réparé dans les huit (8) jours suivant mise en demeure écrite, avec effet immédiat ; (ii) sans motif, moyennant un préavis écrit de trente (30) jours. Les livrables validés avant la prise d'effet de la résiliation restent dus et payés ; les articles 6, 8 et 10 survivent au contrat.</p>
<h2>Article 12 — Droit applicable et juridiction</h2>
<p>Le présent contrat est soumis au droit français. À défaut de résolution amiable dans un délai de trente (30) jours, tout litige sera porté devant les tribunaux compétents de [ville].</p>
<h2>Signatures</h2>
<p>Fait en deux exemplaires originaux, le [date].</p>
<p>{{signature1}}</p>
<p>{{signature2}}</p>`,
  },
]

export default function ContractTemplates() {
  const { t, i18n } = useTranslation()
  const { toast } = useToast()
  const [items, setItems] = useState<Template[]>([])
  const [loading, setLoading] = useState(true)
  const [open, setOpen] = useState(false)
  const [mode, setMode] = useState<"gallery" | "edit">("gallery")
  const [saving, setSaving] = useState(false)
  const [editingId, setEditingId] = useState<number | null>(null)
  const [form, setForm] = useState({ name: "", description: "", body_html: "", is_default: false })
  const [preview, setPreview] = useState<Template | null>(null)
  const [showSamplePreview, setShowSamplePreview] = useState(false)
  const [importing, setImporting] = useState(false)
  const fileInputRef = useRef<HTMLInputElement | null>(null)
  const editorRef = useRef<Editor | null>(null)

  const load = () => {
    setLoading(true)
    fetchContractTemplates()
      .then((d) => setItems((d as any).results ?? d as Template[]))
      .catch(() => {})
      .finally(() => setLoading(false))
  }
  useEffect(load, [])

  const resetForm = () => {
    setForm({ name: "", description: "", body_html: "", is_default: false })
    setEditingId(null)
    setShowSamplePreview(false)
  }

  const openCreate = () => {
    resetForm()
    setMode("gallery")
    setOpen(true)
  }

  const openEdit = (tpl: Template) => {
    setEditingId(tpl.id)
    setForm({
      name: tpl.name,
      description: tpl.description || "",
      body_html: tpl.body_html || "",
      is_default: tpl.is_default,
    })
    setShowSamplePreview(false)
    setMode("edit")
    setOpen(true)
  }

  const startFromBlank = () => {
    setForm((f) => ({ ...f, body_html: "" }))
    setMode("edit")
  }

  const startFromStarter = (starter: typeof STARTERS[number]) => {
    setForm((f) => ({
      ...f,
      name: f.name || t(starter.nameKey, starter.nameFallback),
      body_html: starter.body,
    }))
    setMode("edit")
  }

  const insertVariable = (code: string) => {
    const editor = editorRef.current
    if (editor) {
      editor.chain().focus().insertContent(`{{${code}}}`).run()
    } else {
      setForm((f) => ({ ...f, body_html: f.body_html + `{{${code}}}` }))
    }
  }

  const save = async () => {
    if (!form.name || !form.body_html) {
      toast({ variant: "destructive", title: t("contracts.required") })
      return
    }
    setSaving(true)
    try {
      if (editingId != null) {
        await api.patch(`/contract-templates/${editingId}/`, form)
        toast({ title: t("contracts.updated") })
      } else {
        await api.post("/contract-templates/", form)
        toast({ title: t("contracts.created") })
      }
      setOpen(false)
      resetForm()
      load()
    } catch (e) {
      toast({ variant: "destructive", title: t("contracts.error"), description: apiErrorMessage(e) })
    } finally {
      setSaving(false)
    }
  }

  const remove = async (id: number) => {
    if (!confirm(t("contracts.confirm_delete"))) return
    try {
      await api.delete(`/contract-templates/${id}/`)
      toast({ title: t("contracts.deleted") })
      load()
    } catch (e) {
      toast({ variant: "destructive", title: t("contracts.error"), description: apiErrorMessage(e) })
    }
  }

  const handleImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    const ext = file.name.toLowerCase().split(".").pop()
    if (ext !== "docx" && ext !== "pdf") {
      toast({ variant: "destructive", title: t("contracts.import_unsupported") })
      if (fileInputRef.current) fileInputRef.current.value = ""
      return
    }
    setImporting(true)
    try {
      const fd = new FormData()
      fd.append("file", file)
      const { data } = await api.post("/contract-templates/import_document/", fd, {
        headers: { "Content-Type": "multipart/form-data" },
      })
      const html = (data as { body_html?: string }).body_html || ""
      setForm((f) => ({
        ...f,
        body_html: html,
        name: f.name || file.name.replace(/\.(docx|pdf)$/i, ""),
      }))
      setMode("edit")
      toast({ title: t("contracts.import_success") })
    } catch (e: any) {
      const detail = e?.response?.data?.file || e?.response?.data?.detail
      toast({
        variant: "destructive",
        title: t("contracts.import_error"),
        description: Array.isArray(detail) ? detail.join(" ") : detail,
      })
    } finally {
      setImporting(false)
      if (fileInputRef.current) fileInputRef.current.value = ""
    }
  }

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm text-aurora-ink-3">{t("brand_dashboard.eyebrow", "Espace marque")}</p>
          <h1 className="text-3xl font-semibold tracking-tight text-aurora-ink mt-0.5 flex items-center gap-2">
            <ScrollText className="h-6 w-6 text-indigo-500" />{t("contracts.title")}
          </h1>
          <p className="text-sm text-aurora-ink-3 mt-1">{t("contracts.subtitle")}</p>
        </div>
        <Button variant="gradient" onClick={openCreate}><Plus className="h-4 w-4 mr-2" />{t("contracts.new")}</Button>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-20 text-aurora-ink-3"><Loader2 className="h-6 w-6 animate-spin mr-2" />{t("contracts.loading")}</div>
      ) : items.length === 0 ? (
        <Card className="card-base">
          <CardContent className="py-12 text-center space-y-3">
            <p className="text-aurora-ink-3">{t("contracts.empty")}</p>
            <Button variant="outline" onClick={openCreate}>
              <Sparkles className="h-4 w-4 mr-2" />{t("contracts.empty_cta", "Partir d'un modèle prêt à l'emploi")}
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid md:grid-cols-2 gap-4">
          {items.map((tpl) => (
            <Card key={tpl.id} className="card-base">
              <CardHeader>
                <div className="flex items-start justify-between gap-2">
                  <CardTitle className="text-base">{tpl.name}</CardTitle>
                  {tpl.is_default && <Badge variant="success">{t("contracts.default_badge")}</Badge>}
                </div>
                {tpl.description && <p className="text-xs text-aurora-ink-3">{tpl.description}</p>}
              </CardHeader>
              <CardContent className="space-y-3">
                <p className="text-xs text-aurora-ink-3">{t("contracts.created_at")} {new Date(tpl.created_at).toLocaleDateString(i18n.language)}</p>
                <div className="flex gap-2">
                  <Button size="sm" variant="outline" className="flex-1" onClick={() => setPreview(tpl)}>{t("contracts.preview")}</Button>
                  <Button size="sm" variant="outline" onClick={() => openEdit(tpl)} title={t("contracts.edit")}>
                    <Pencil className="h-3.5 w-3.5" />
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => remove(tpl.id)} className="text-red-600 hover:text-red-700 hover:bg-red-50">
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Create / edit dialog */}
      <Dialog open={open} onOpenChange={(o) => { setOpen(o); if (!o) resetForm() }}>
        <DialogContent className="max-w-4xl max-h-[92vh] flex flex-col">
          <DialogHeader>
            <DialogTitle>
              {editingId != null
                ? t("contracts.edit_title")
                : mode === "gallery"
                  ? t("contracts.gallery_title", "Comment voulez-vous démarrer ?")
                  : t("contracts.new_title")}
            </DialogTitle>
          </DialogHeader>

          <input
            ref={fileInputRef}
            type="file"
            accept=".pdf,.docx,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
            className="hidden"
            onChange={handleImport}
          />

          {mode === "gallery" ? (
            <div className="space-y-3 overflow-y-auto">
              <div className="grid sm:grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={importing}
                  className="p-4 rounded-xl border-2 border-dashed border-aurora-line hover:border-indigo-400 hover:bg-indigo-50/40 text-left transition-all"
                >
                  {importing ? <Loader2 className="h-5 w-5 mb-2 animate-spin text-aurora-blue" /> : <Upload className="h-5 w-5 mb-2 text-aurora-blue" />}
                  <p className="font-semibold text-sm text-aurora-ink">{t("contracts.gallery_import", "Importer mon contrat (Word / PDF)")}</p>
                  <p className="text-xs text-aurora-ink-3 mt-1">{t("contracts.gallery_import_desc", "Votre document est converti en modèle éditable ; ajoutez ensuite les variables.")}</p>
                </button>
                <button
                  type="button"
                  onClick={startFromBlank}
                  className="p-4 rounded-xl border-2 border-aurora-line hover:border-indigo-400 hover:bg-indigo-50/40 text-left transition-all"
                >
                  <Pencil className="h-5 w-5 mb-2 text-aurora-ink-3" />
                  <p className="font-semibold text-sm text-aurora-ink">{t("contracts.gallery_blank", "Partir de zéro")}</p>
                  <p className="text-xs text-aurora-ink-3 mt-1">{t("contracts.gallery_blank_desc", "Page blanche avec l'éditeur et les variables.")}</p>
                </button>
              </div>
              <p className="text-xs font-medium uppercase tracking-wide text-aurora-ink-3 pt-1">
                {t("contracts.gallery_starters", "Ou partez d'un modèle prêt à l'emploi")}
              </p>
              <div className="grid sm:grid-cols-3 gap-3">
                {STARTERS.map((s) => {
                  const Icon = s.icon
                  return (
                    <button
                      key={s.key}
                      type="button"
                      onClick={() => startFromStarter(s)}
                      className="p-4 rounded-xl border-2 border-aurora-line hover:border-indigo-400 hover:bg-indigo-50/40 text-left transition-all"
                    >
                      <Icon className="h-5 w-5 mb-2 text-indigo-500" />
                      <p className="font-semibold text-sm text-aurora-ink">{t(s.nameKey, s.nameFallback)}</p>
                      <p className="text-xs text-aurora-ink-3 mt-1">{t(s.descKey, s.descFallback)}</p>
                    </button>
                  )
                })}
              </div>
              <p className="text-[11px] text-aurora-ink-3">
                {t(
                  "contracts.starters_disclaimer",
                  "Modèles rédigés selon le droit français (loi influence du 9 juin 2023, Code de la propriété intellectuelle). Complétez les champs entre [crochets] et faites valider la version finale par votre conseil juridique.",
                )}
              </p>
            </div>
          ) : (
            <div className="flex flex-col gap-3 overflow-y-auto pr-1 flex-1 min-h-0">
              <div className="grid sm:grid-cols-2 gap-3">
                <div>
                  <Label>{t("contracts.name_label")}</Label>
                  <Input className="mt-1" placeholder={t("contracts.name_placeholder")} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
                </div>
                <div>
                  <Label>{t("contracts.description_label")}</Label>
                  <Input className="mt-1" placeholder={t("contracts.description_placeholder")} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
                </div>
              </div>

              <div className="grid lg:grid-cols-[1fr_220px] gap-3 flex-1 min-h-0">
                <div className="min-w-0">
                  <div className="flex items-center justify-between mb-1">
                    <Label>{t("contracts.body_label")}</Label>
                    <div className="flex items-center gap-1.5">
                      <Button type="button" variant="ghost" size="sm" onClick={() => setShowSamplePreview((v) => !v)}>
                        {showSamplePreview ? <EyeOff className="h-3.5 w-3.5 mr-1" /> : <Eye className="h-3.5 w-3.5 mr-1" />}
                        {showSamplePreview
                          ? t("contracts.preview_off", "Retour à l'édition")
                          : t("contracts.preview_sample", "Aperçu avec exemple")}
                      </Button>
                      <Button type="button" variant="outline" size="sm" onClick={() => fileInputRef.current?.click()} disabled={importing}>
                        {importing ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" /> : <Upload className="h-3.5 w-3.5 mr-1" />}
                        {t("contracts.import_file")}
                      </Button>
                    </div>
                  </div>
                  {showSamplePreview ? (
                    <div
                      className="prose prose-sm max-w-none border rounded-md p-4 bg-white max-h-[50vh] overflow-y-auto"
                      dangerouslySetInnerHTML={{ __html: fillSample(form.body_html) }}
                    />
                  ) : (
                    <TipTapEditor
                      value={form.body_html}
                      onChange={(html) => setForm({ ...form, body_html: html })}
                      placeholder={t("contracts.editor_placeholder")}
                      minHeight="300px"
                      onEditorReady={(editor) => { editorRef.current = editor }}
                    />
                  )}
                </div>

                {/* Variables panel — click to insert at the caret */}
                <div className="shrink-0">
                  <Label className="text-xs">{t("contracts.variables_title", "Variables du contrat")}</Label>
                  <p className="text-[11px] text-aurora-ink-3 mt-0.5 mb-2">
                    {t("contracts.variables_hint", "Cliquez pour insérer à l'endroit du curseur. Elles seront remplacées par les vraies valeurs à la génération.")}
                  </p>
                  <div className="space-y-1.5 max-h-[46vh] overflow-y-auto pr-1">
                    {VARIABLES.map((v) => (
                      <button
                        key={v.code}
                        type="button"
                        onClick={() => insertVariable(v.code)}
                        className="w-full text-left px-2.5 py-1.5 rounded-lg border border-aurora-line hover:border-indigo-300 hover:bg-indigo-50/50 transition-colors"
                        title={`{{${v.code}}}`}
                      >
                        <span className="block text-xs font-medium text-aurora-ink">{t(v.labelKey, v.fallback)}</span>
                        <span className="block text-[10px] font-mono text-aurora-ink-3">{`{{${v.code}}}`}</span>
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" checked={form.is_default} onChange={(e) => setForm({ ...form, is_default: e.target.checked })} />
                {t("contracts.default_checkbox")}
              </label>
            </div>
          )}

          {mode === "edit" && (
            <DialogFooter>
              {editingId == null && (
                <Button variant="ghost" onClick={() => setMode("gallery")}>{t("common.back", "Retour")}</Button>
              )}
              <Button variant="outline" onClick={() => setOpen(false)}>{t("contracts.cancel")}</Button>
              <Button variant="gradient" onClick={save} disabled={saving}>
                {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : (editingId != null ? t("contracts.save") : t("contracts.create"))}
              </Button>
            </DialogFooter>
          )}
        </DialogContent>
      </Dialog>

      {/* Read-only preview */}
      <Dialog open={!!preview} onOpenChange={(o) => !o && setPreview(null)}>
        <DialogContent className="max-w-3xl max-h-[80vh] overflow-y-auto">
          <DialogHeader><DialogTitle>{preview?.name}</DialogTitle></DialogHeader>
          <div className="prose prose-sm max-w-none border rounded-lg p-4 bg-white" dangerouslySetInnerHTML={{ __html: fillSample(preview?.body_html ?? "") }} />
        </DialogContent>
      </Dialog>
    </div>
  )
}
