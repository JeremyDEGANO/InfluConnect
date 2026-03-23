import { useTranslation } from "react-i18next"
import { Button } from "@/components/ui/button"
import { Globe } from "lucide-react"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"

export function LanguageSelector() {
  const { i18n } = useTranslation()
  const currentLang = i18n.language?.startsWith("fr") ? "FR" : "EN"

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="sm" className="gap-1">
          <Globe className="h-4 w-4" />
          {currentLang}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem onClick={() => i18n.changeLanguage("en")} className={currentLang === "EN" ? "font-semibold" : ""}>
          🇬🇧 English
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => i18n.changeLanguage("fr")} className={currentLang === "FR" ? "font-semibold" : ""}>
          🇫🇷 Français
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
