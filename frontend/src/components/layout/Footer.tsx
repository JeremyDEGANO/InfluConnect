import { Link } from "react-router-dom"
import { Twitter, Linkedin, Instagram, Github } from "lucide-react"

export function Footer() {
  return (
    <footer className="bg-gray-900 text-gray-400">
      <div className="container max-w-7xl mx-auto px-4 py-12">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
          <div className="col-span-1 md:col-span-2">
            <div className="text-white font-bold text-xl mb-3">
              InfluConnect <span className="text-lg">✨</span>
            </div>
            <p className="text-sm leading-relaxed max-w-xs">The premium marketplace connecting brands with authentic influencers for impactful campaigns.</p>
            <div className="flex gap-3 mt-4">
              {[Twitter, Linkedin, Instagram, Github].map((Icon, i) => (
                <a key={i} href="#" className="h-9 w-9 rounded-full bg-gray-800 flex items-center justify-center hover:bg-purple-700 transition-colors">
                  <Icon className="h-4 w-4 text-gray-300" />
                </a>
              ))}
            </div>
          </div>
          <div>
            <h4 className="text-white font-semibold mb-3 text-sm">Platform</h4>
            <ul className="space-y-2 text-sm">
              <li><Link to="/#features" className="hover:text-white transition-colors">Features</Link></li>
              <li><Link to="/#pricing" className="hover:text-white transition-colors">Pricing</Link></li>
              <li><Link to="/register" className="hover:text-white transition-colors">Get Started</Link></li>
            </ul>
          </div>
          <div>
            <h4 className="text-white font-semibold mb-3 text-sm">Legal</h4>
            <ul className="space-y-2 text-sm">
              <li><a href="#" className="hover:text-white transition-colors">Privacy Policy</a></li>
              <li><a href="#" className="hover:text-white transition-colors">Terms of Service</a></li>
              <li><a href="#" className="hover:text-white transition-colors">Cookie Policy</a></li>
            </ul>
          </div>
        </div>
        <div className="border-t border-gray-800 mt-8 pt-6 flex flex-col sm:flex-row items-center justify-between gap-4">
          <p className="text-xs">© {new Date().getFullYear()} InfluConnect. All rights reserved.</p>
          <p className="text-xs">Made with ❤️ for creators & brands</p>
        </div>
      </div>
    </footer>
  )
}
