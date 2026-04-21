import { Users, Star, Tag } from "lucide-react"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"

interface InfluencerCardProps {
  id: number
  name: string
  avatar?: string
  followers: number
  engagement_rate: number
  themes: string[]
  min_price: number
  avg_rating: number
  onContact?: (id: number) => void
}

export function InfluencerCard({ id, name, avatar, followers, engagement_rate, themes, min_price, avg_rating, onContact }: InfluencerCardProps) {
  const formatFollowers = (n: number) => n >= 1000000 ? `${(n / 1000000).toFixed(1)}M` : n >= 1000 ? `${(n / 1000).toFixed(0)}K` : String(n)

  return (
    <Card className="card-base hover:shadow-md transition-shadow">
      <CardContent className="p-5">
        <div className="flex items-start gap-3">
          <Avatar className="h-12 w-12">
            <AvatarImage src={avatar} />
            <AvatarFallback className="bg-gradient-to-br from-indigo-500 to-violet-600 text-white font-semibold">
              {name.slice(0, 2).toUpperCase()}
            </AvatarFallback>
          </Avatar>
          <div className="flex-1 min-w-0">
            <h3 className="font-semibold text-gray-900 truncate">{name}</h3>
            <div className="flex items-center gap-3 mt-1 text-sm text-gray-500">
              <span className="flex items-center gap-1"><Users className="h-3.5 w-3.5" />{formatFollowers(followers)}</span>
              <span className="flex items-center gap-1"><Star className="h-3.5 w-3.5 fill-yellow-400 text-yellow-400" />{avg_rating.toFixed(1)}</span>
              <span className="text-green-600 font-medium">{engagement_rate}%</span>
            </div>
          </div>
        </div>
        <div className="flex flex-wrap gap-1.5 mt-3">
          {themes.slice(0, 3).map((theme) => (
            <Badge key={theme} variant="info" className="text-xs">
              <Tag className="h-2.5 w-2.5 mr-1" />{theme}
            </Badge>
          ))}
        </div>
        <div className="flex items-center justify-between mt-4">
          <span className="text-sm text-gray-500">From <span className="font-semibold text-gray-900">€{min_price}</span></span>
          <Button size="sm" variant="gradient" onClick={() => onContact?.(id)}>Contact</Button>
        </div>
      </CardContent>
    </Card>
  )
}
