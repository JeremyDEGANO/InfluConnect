import { ExternalLink, MapPin, Users } from "lucide-react"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { HoverCard, HoverCardContent, HoverCardTrigger } from "@/components/ui/hover-card"
import { resolveMediaUrl } from "@/lib/utils"

interface SocialNetwork {
  platform: string
  followers_count: number
}

interface InfluencerHoverCardProps {
  influencerId: number
  influencerPseudo?: string
  displayName: string
  avatar?: string | null
  city?: string
  socialNetworks?: SocialNetwork[]
  contentThemes?: string[]
  children: React.ReactNode
  profileBase?: string // e.g. "/brand/influencers" or "/marketplace"
}

const fmt = (n: number) =>
  n >= 1_000_000 ? `${(n / 1_000_000).toFixed(1)}M` : n >= 1_000 ? `${(n / 1_000).toFixed(1)}K` : String(n)

export function InfluencerHoverCard({
  influencerId,
  influencerPseudo,
  displayName,
  avatar,
  city,
  socialNetworks = [],
  contentThemes = [],
  children,
  profileBase = "/brand/influencers",
}: InfluencerHoverCardProps) {
  const profileUrl = influencerPseudo ? `${profileBase}/${encodeURIComponent(influencerPseudo)}` : undefined
  const mediaKitUrl = profileUrl ? `${profileUrl}#media-kit` : undefined
  const totalFollowers = socialNetworks.reduce((s, sn) => s + sn.followers_count, 0)

  return (
    <HoverCard openDelay={250} closeDelay={100}>
      <HoverCardTrigger asChild>{children}</HoverCardTrigger>
      <HoverCardContent side="top" align="start">
        <div className="flex items-start gap-3">
          <Avatar className="h-12 w-12 shrink-0">
            {avatar && <AvatarImage src={resolveMediaUrl(avatar)} />}
            <AvatarFallback className="bg-gradient-to-br from-indigo-400 to-violet-600 text-white font-semibold">
              {(displayName || "??").slice(0, 2).toUpperCase()}
            </AvatarFallback>
          </Avatar>
          <div className="min-w-0 flex-1">
            <p className="font-semibold text-gray-900 truncate">{displayName}</p>
            <div className="flex items-center gap-2 text-xs text-gray-500 mt-0.5">
              {city && <span className="flex items-center gap-0.5"><MapPin className="h-3 w-3" />{city}</span>}
              {totalFollowers > 0 && <span className="flex items-center gap-0.5"><Users className="h-3 w-3" />{fmt(totalFollowers)}</span>}
            </div>
          </div>
        </div>

        {socialNetworks.length > 0 && (
          <div className="flex flex-wrap gap-1 mt-3">
            {socialNetworks.slice(0, 4).map((sn) => (
              <Badge key={sn.platform} variant="outline" className="text-[10px] px-1.5 py-0">
                {sn.platform} · {fmt(sn.followers_count)}
              </Badge>
            ))}
          </div>
        )}

        {contentThemes.length > 0 && (
          <div className="flex flex-wrap gap-1 mt-2">
            {contentThemes.slice(0, 5).map((th) => (
              <Badge key={th} variant="info" className="text-[10px] px-1.5 py-0">{th}</Badge>
            ))}
            {contentThemes.length > 5 && <span className="text-[10px] text-gray-400">+{contentThemes.length - 5}</span>}
          </div>
        )}

        <div className="flex gap-2 mt-3 pt-3 border-t border-gray-100">
          {profileUrl && (
            <a
              href={profileUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1 text-xs font-medium text-indigo-600 hover:underline"
            >
              <ExternalLink className="h-3 w-3" />Voir le profil
            </a>
          )}
          {mediaKitUrl && (
            <a
              href={mediaKitUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1 text-xs font-medium text-gray-500 hover:underline"
            >
              <ExternalLink className="h-3 w-3" />Kit média
            </a>
          )}
        </div>
      </HoverCardContent>
    </HoverCard>
  )
}
