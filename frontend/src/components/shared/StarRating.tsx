import { useState } from "react"
import { Star } from "lucide-react"
import { cn } from "@/lib/utils"

interface StarRatingProps {
  value?: number
  onChange?: (rating: number) => void
  readonly?: boolean
  size?: "sm" | "md" | "lg"
}

const SIZE_MAP = { sm: "h-4 w-4", md: "h-5 w-5", lg: "h-6 w-6" }

export function StarRating({ value = 0, onChange, readonly = false, size = "md" }: StarRatingProps) {
  const [hovered, setHovered] = useState(0)
  const active = hovered || value

  return (
    <div className="flex gap-0.5">
      {[1, 2, 3, 4, 5].map((star) => (
        <button
          key={star}
          type="button"
          disabled={readonly}
          onClick={() => onChange?.(star)}
          onMouseEnter={() => !readonly && setHovered(star)}
          onMouseLeave={() => !readonly && setHovered(0)}
          className={cn("transition-colors", readonly ? "cursor-default" : "cursor-pointer")}
        >
          <Star
            className={cn(SIZE_MAP[size], star <= active ? "fill-yellow-400 text-yellow-400" : "text-gray-300")}
          />
        </button>
      ))}
    </div>
  )
}
