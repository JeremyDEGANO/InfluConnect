import { ExternalLink } from "lucide-react"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { HoverCard, HoverCardContent, HoverCardTrigger } from "@/components/ui/hover-card"
import { resolveMediaUrl } from "@/lib/utils"

interface BrandHoverCardProps {
  brandId: number
  brandName: string
  brandLogo?: string | null
  children: React.ReactNode
  profileBase?: string // e.g. "/influencer/brands"
}

export function BrandHoverCard({
  brandId,
  brandName,
  brandLogo,
  children,
  profileBase = "/influencer/brands",
}: BrandHoverCardProps) {
  const profileUrl = `${profileBase}/${brandId}`

  return (
    <HoverCard openDelay={250} closeDelay={100}>
      <HoverCardTrigger asChild>{children}</HoverCardTrigger>
      <HoverCardContent side="top" align="start">
        <div className="flex items-center gap-3">
          <Avatar className="h-10 w-10 shrink-0">
            {brandLogo && <AvatarImage src={resolveMediaUrl(brandLogo)} />}
            <AvatarFallback className="bg-aurora-ink text-white text-sm font-semibold">
              {(brandName || "??").slice(0, 2).toUpperCase()}
            </AvatarFallback>
          </Avatar>
          <p className="font-semibold text-aurora-ink truncate">{brandName}</p>
        </div>
        <div className="mt-3 pt-3 border-t border-aurora-line">
          <a
            href={profileUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1 text-xs font-medium text-aurora-blue hover:underline"
          >
            <ExternalLink className="h-3 w-3" />Voir le profil de la marque
          </a>
        </div>
      </HoverCardContent>
    </HoverCard>
  )
}
