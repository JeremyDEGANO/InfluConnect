import { useState } from "react"
import { Filter, X } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"

export interface FilterValues {
  search: string
  minFollowers: string
  maxPrice: string
  themes: string[]
  minRating: string
}

interface FilterPanelProps {
  onFilterChange: (filters: FilterValues) => void
}

const THEME_OPTIONS = ["Fashion", "Beauty", "Tech", "Food", "Travel", "Fitness", "Gaming", "Lifestyle", "Finance", "Education"]

export function FilterPanel({ onFilterChange }: FilterPanelProps) {
  const [filters, setFilters] = useState<FilterValues>({ search: "", minFollowers: "", maxPrice: "", themes: [], minRating: "" })

  const update = (key: keyof FilterValues, value: string | string[]) => {
    const updated = { ...filters, [key]: value }
    setFilters(updated)
    onFilterChange(updated)
  }

  const toggleTheme = (theme: string) => {
    const themes = filters.themes.includes(theme) ? filters.themes.filter((t) => t !== theme) : [...filters.themes, theme]
    update("themes", themes)
  }

  const reset = () => {
    const empty: FilterValues = { search: "", minFollowers: "", maxPrice: "", themes: [], minRating: "" }
    setFilters(empty)
    onFilterChange(empty)
  }

  return (
    <Card className="card-base sticky top-4">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center justify-between text-base">
          <span className="flex items-center gap-2"><Filter className="h-4 w-4" />Filters</span>
          <Button variant="ghost" size="sm" onClick={reset} className="text-xs text-gray-400 hover:text-gray-600"><X className="h-3 w-3 mr-1" />Clear</Button>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div>
          <Label className="text-xs font-medium text-gray-500 uppercase tracking-wide">Search</Label>
          <Input className="mt-1" placeholder="Name, niche..." value={filters.search} onChange={(e) => update("search", e.target.value)} />
        </div>
        <div>
          <Label className="text-xs font-medium text-gray-500 uppercase tracking-wide">Min Followers</Label>
          <Input className="mt-1" type="number" placeholder="e.g. 10000" value={filters.minFollowers} onChange={(e) => update("minFollowers", e.target.value)} />
        </div>
        <div>
          <Label className="text-xs font-medium text-gray-500 uppercase tracking-wide">Max Price (€)</Label>
          <Input className="mt-1" type="number" placeholder="e.g. 500" value={filters.maxPrice} onChange={(e) => update("maxPrice", e.target.value)} />
        </div>
        <div>
          <Label className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-2 block">Themes</Label>
          <div className="flex flex-wrap gap-1.5">
            {THEME_OPTIONS.map((theme) => (
              <Badge
                key={theme}
                variant={filters.themes.includes(theme) ? "purple" : "outline"}
                className="cursor-pointer hover:bg-purple-50 text-xs"
                onClick={() => toggleTheme(theme)}
              >
                {theme}
              </Badge>
            ))}
          </div>
        </div>
        <div>
          <Label className="text-xs font-medium text-gray-500 uppercase tracking-wide">Min Rating</Label>
          <Input className="mt-1" type="number" min="1" max="5" placeholder="1-5" value={filters.minRating} onChange={(e) => update("minRating", e.target.value)} />
        </div>
      </CardContent>
    </Card>
  )
}
