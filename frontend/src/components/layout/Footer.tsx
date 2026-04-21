import { Link } from "react-router-dom"
import { useTranslation } from "react-i18next"

export function Footer() {
  const { t } = useTranslation()

  return (
    <footer className="bg-slate-950 text-gray-400">
      <div className="container max-w-7xl mx-auto px-4 py-16">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-10">
          <div className="col-span-1 md:col-span-1">
            <div className="flex items-center gap-2.5 mb-4">
              <div className="h-8 w-8 rounded-lg bg-gradient-to-br from-indigo-600 to-violet-600 flex items-center justify-center text-white text-xs font-black">IC</div>
              <span className="text-white font-bold text-lg tracking-tight">InfluConnect</span>
            </div>
            <p className="text-sm leading-relaxed text-gray-500">{t("footer.description")}</p>
          </div>
          <div>
            <h4 className="text-white font-semibold mb-4 text-sm">{t("footer.for_influencers")}</h4>
            <ul className="space-y-3 text-sm">
              <li><a href="#how-it-works" className="hover:text-white transition-colors">{t("footer.how_it_works")}</a></li>
              <li><Link to="/register?type=influencer" className="hover:text-white transition-colors">{t("footer.sign_up_free")}</Link></li>
              <li><a href="#" className="hover:text-white transition-colors">{t("footer.creator_resources")}</a></li>
            </ul>
          </div>
          <div>
            <h4 className="text-white font-semibold mb-4 text-sm">{t("footer.for_brands")}</h4>
            <ul className="space-y-3 text-sm">
              <li><a href="#pricing" className="hover:text-white transition-colors">{t("footer.pricing_plans")}</a></li>
              <li><Link to="/register?type=brand" className="hover:text-white transition-colors">{t("footer.book_demo")}</Link></li>
              <li><a href="#" className="hover:text-white transition-colors">{t("footer.case_studies")}</a></li>
            </ul>
          </div>
          <div>
            <h4 className="text-white font-semibold mb-4 text-sm">{t("footer.company")}</h4>
            <ul className="space-y-3 text-sm">
              <li><a href="#" className="hover:text-white transition-colors">{t("footer.about_us")}</a></li>
              <li><Link to="/legal/privacy" className="hover:text-white transition-colors">{t("footer.privacy_policy")}</Link></li>
              <li><Link to="/legal/terms" className="hover:text-white transition-colors">{t("footer.terms")}</Link></li>
              <li><Link to="/legal/notice" className="hover:text-white transition-colors">Mentions légales</Link></li>
              <li><a href="#" className="hover:text-white transition-colors">{t("footer.contact")}</a></li>
            </ul>
          </div>
        </div>
        <div className="border-t border-white/10 mt-12 pt-8 text-center">
          <p className="text-sm text-gray-600">© {new Date().getFullYear()} InfluConnect. {t("footer.rights")}</p>
        </div>
      </div>
    </footer>
  )
}
