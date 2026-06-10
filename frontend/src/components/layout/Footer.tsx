import { Link } from "react-router-dom"
import { useTranslation } from "react-i18next"

export function Footer() {
  const { t } = useTranslation()

  return (
    <footer className="bg-white border-t border-aurora-line">
      <div className="container max-w-7xl mx-auto px-5 py-16">
        <div className="grid grid-cols-2 md:grid-cols-6 gap-10">
          <div className="col-span-2">
            <div className="flex items-center gap-2.5 mb-4">
              <img
                src="/brand-logo-square.svg"
                alt="InfluConnect"
                className="h-7 w-7 rounded-[8px] object-cover"
              />
              <span className="text-aurora-ink font-semibold text-[15px] tracking-tight">InfluConnect</span>
            </div>
            <p className="text-sm leading-relaxed text-aurora-ink-3 max-w-xs">{t("footer.description")}</p>
            <div className="mt-6 flex items-center gap-3">
              <a href="https://www.linkedin.com/company/influconnect" aria-label="LinkedIn" className="h-9 w-9 rounded-full bg-aurora-surface text-aurora-ink-2 hover:bg-aurora-blue/10 hover:text-aurora-blue-deep flex items-center justify-center transition">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M19 3a2 2 0 012 2v14a2 2 0 01-2 2H5a2 2 0 01-2-2V5a2 2 0 012-2h14zM8.339 18.337V10.66H5.67v7.677h2.669zM7.005 9.43a1.547 1.547 0 100-3.094 1.547 1.547 0 000 3.094zm11.332 8.907v-4.21c0-2.31-1.231-3.385-2.872-3.385-1.324 0-1.918.728-2.249 1.24V10.66h-2.668c.035.752 0 7.677 0 7.677h2.668v-4.288c0-.24.018-.48.088-.65.193-.479.633-.974 1.371-.974.967 0 1.354.738 1.354 1.819v4.093h2.308z"/></svg>
              </a>
              <a href="https://twitter.com/influconnect" aria-label="X / Twitter" className="h-9 w-9 rounded-full bg-aurora-surface text-aurora-ink-2 hover:bg-aurora-blue/10 hover:text-aurora-blue-deep flex items-center justify-center transition">
                <svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor"><path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/></svg>
              </a>
              <a href="https://www.instagram.com/influconnect" aria-label="Instagram" className="h-9 w-9 rounded-full bg-aurora-surface text-aurora-ink-2 hover:bg-aurora-blue/10 hover:text-aurora-blue-deep flex items-center justify-center transition">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zM12 0C8.741 0 8.333.014 7.053.072 2.695.272.273 2.69.073 7.052.014 8.333 0 8.741 0 12c0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98C8.333 23.986 8.741 24 12 24c3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98C15.668.014 15.259 0 12 0zm0 5.838a6.162 6.162 0 100 12.324 6.162 6.162 0 000-12.324zM12 16a4 4 0 110-8 4 4 0 010 8zm6.406-11.845a1.44 1.44 0 100 2.881 1.44 1.44 0 000-2.881z"/></svg>
              </a>
            </div>
          </div>

          <div>
            <h4 className="text-aurora-ink font-semibold mb-4 text-xs uppercase tracking-widest">{t("footer.product", "Produit")}</h4>
            <ul className="space-y-2.5 text-sm">
              <li><Link to="/#features" className="text-aurora-ink-2 hover:text-aurora-ink transition-colors">{t("nav.features")}</Link></li>
              <li><Link to="/#how-it-works" className="text-aurora-ink-2 hover:text-aurora-ink transition-colors">{t("nav.how_it_works")}</Link></li>
              <li><Link to="/pricing/brands" className="text-aurora-ink-2 hover:text-aurora-ink transition-colors">{t("footer.pricing_plans")}</Link></li>
              <li><Link to="/compare" className="text-aurora-ink-2 hover:text-aurora-ink transition-colors">{t("footer.compare", "Comparer les offres")}</Link></li>
              <li><Link to="/marketplace" className="text-aurora-ink-2 hover:text-aurora-ink transition-colors">{t("nav.marketplace")}</Link></li>
            </ul>
          </div>

          <div>
            <h4 className="text-aurora-ink font-semibold mb-4 text-xs uppercase tracking-widest">{t("footer.for_brands")}</h4>
            <ul className="space-y-2.5 text-sm">
              <li><Link to="/pricing/brands" className="text-aurora-ink-2 hover:text-aurora-ink transition-colors">{t("footer.pricing_plans")}</Link></li>
              <li><Link to="/register?type=brand" className="text-aurora-ink-2 hover:text-aurora-ink transition-colors">{t("footer.book_demo")}</Link></li>
              <li><Link to="/pricing/agencies" className="text-aurora-ink-2 hover:text-aurora-ink transition-colors">{t("footer.for_agencies", "Pour les agences")}</Link></li>
              <li><Link to="/register?type=influencer" className="text-aurora-ink-2 hover:text-aurora-ink transition-colors">{t("footer.for_influencers")}</Link></li>
            </ul>
          </div>

          <div>
            <h4 className="text-aurora-ink font-semibold mb-4 text-xs uppercase tracking-widest">{t("footer.resources", "Ressources")}</h4>
            <ul className="space-y-2.5 text-sm">
              <li><Link to="/faq" className="text-aurora-ink-2 hover:text-aurora-ink transition-colors">FAQ</Link></li>
              <li><Link to="/help" className="text-aurora-ink-2 hover:text-aurora-ink transition-colors">{t("footer.help", "Centre d'aide")}</Link></li>
              <li><Link to="/docs/integrations" className="text-aurora-ink-2 hover:text-aurora-ink transition-colors">{t("footer.docs_integrations", "API & SSO")}</Link></li>
              <li><Link to="/about" className="text-aurora-ink-2 hover:text-aurora-ink transition-colors">{t("footer.about_us")}</Link></li>
              <li><Link to="/contact" className="text-aurora-ink-2 hover:text-aurora-ink transition-colors">{t("footer.contact")}</Link></li>
            </ul>
          </div>

          <div>
            <h4 className="text-aurora-ink font-semibold mb-4 text-xs uppercase tracking-widest">{t("footer.legal", "Légal")}</h4>
            <ul className="space-y-2.5 text-sm">
              <li><Link to="/legal/terms" className="text-aurora-ink-2 hover:text-aurora-ink transition-colors">CGU</Link></li>
              <li><Link to="/legal/cgv" className="text-aurora-ink-2 hover:text-aurora-ink transition-colors">CGV</Link></li>
              <li><Link to="/legal/privacy" className="text-aurora-ink-2 hover:text-aurora-ink transition-colors">{t("footer.privacy_policy")}</Link></li>
              <li><Link to="/legal/cookies" className="text-aurora-ink-2 hover:text-aurora-ink transition-colors">Cookies</Link></li>
              <li><Link to="/legal/notice" className="text-aurora-ink-2 hover:text-aurora-ink transition-colors">Mentions légales</Link></li>
            </ul>
          </div>
        </div>

        <div className="border-t border-aurora-line mt-12 pt-7 flex flex-col md:flex-row items-center justify-between gap-3">
          <p className="text-xs text-aurora-ink-3">© {new Date().getFullYear()} InfluConnect. {t("footer.rights")}</p>
          <p className="text-xs text-aurora-ink-3">Édité avec soin à Paris · 🇫🇷</p>
        </div>
      </div>
    </footer>
  )
}
