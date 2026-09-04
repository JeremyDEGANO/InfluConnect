import { useEffect, useRef, useState } from "react"
import { useTranslation } from "react-i18next"
import api from "@/lib/api"
import { Input } from "@/components/ui/input"
import { Loader2, MapPin } from "lucide-react"
import { cn } from "@/lib/utils"

export interface AddressSuggestion {
  label: string
  /** Empty in city mode. */
  street?: string
  postal_code: string
  city: string
  country: string
}

interface Props {
  /** The street line; this component owns only that field. */
  value: string
  onChange: (street: string) => void
  /** Fired when a suggestion is picked, so the caller can fill the rest. */
  onSelect: (suggestion: AddressSuggestion) => void
  /** ISO-2 country used to pick the provider (FR -> BAN, else Photon). */
  country?: string
  /** "city" searches municipalities only (influencer profiles). */
  kind?: "address" | "city"
  placeholder?: string
  invalid?: boolean
  className?: string
  id?: string
}

const MIN_CHARS = 3
const DEBOUNCE_MS = 250

/**
 * Street input with address suggestions. Picking one fills postcode, city and
 * country in the parent form, so an address can never be half-valid.
 *
 * Typing freely still works: suggestions assist, they never gate the field.
 */
export function AddressAutocomplete({
  value,
  onChange,
  onSelect,
  country = "FR",
  kind = "address",
  placeholder,
  invalid,
  className,
  id,
}: Props) {
  const { t } = useTranslation()
  const [suggestions, setSuggestions] = useState<AddressSuggestion[]>([])
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [highlighted, setHighlighted] = useState(-1)
  const containerRef = useRef<HTMLDivElement>(null)
  // Set while applying a pick, so the resulting value change does not
  // immediately re-open the dropdown with a stale query.
  const justPicked = useRef(false)

  useEffect(() => {
    if (justPicked.current) {
      justPicked.current = false
      return
    }
    const query = value.trim()
    if (query.length < MIN_CHARS) {
      setSuggestions([])
      setOpen(false)
      return
    }

    const controller = new AbortController()
    const timer = setTimeout(() => {
      setLoading(true)
      api
        .get("/reference/address-autocomplete/", {
          params: { q: query, country, kind },
          signal: controller.signal,
        })
        .then((res) => {
          const results: AddressSuggestion[] = res.data?.results ?? []
          setSuggestions(results)
          setOpen(results.length > 0)
          setHighlighted(-1)
        })
        .catch(() => {
          // Offline, throttled or upstream down: stay silent and let them type.
          setSuggestions([])
          setOpen(false)
        })
        .finally(() => setLoading(false))
    }, DEBOUNCE_MS)

    return () => {
      clearTimeout(timer)
      controller.abort()
    }
  }, [value, country, kind])

  // Close when clicking outside.
  useEffect(() => {
    const onClickOutside = (event: MouseEvent) => {
      if (!containerRef.current?.contains(event.target as Node)) setOpen(false)
    }
    document.addEventListener("mousedown", onClickOutside)
    return () => document.removeEventListener("mousedown", onClickOutside)
  }, [])

  const pick = (suggestion: AddressSuggestion) => {
    justPicked.current = true
    onChange(kind === "city" ? suggestion.city || suggestion.label : suggestion.street || suggestion.label)
    onSelect(suggestion)
    setOpen(false)
    setSuggestions([])
  }

  const onKeyDown = (event: React.KeyboardEvent) => {
    if (!open || suggestions.length === 0) return
    if (event.key === "ArrowDown") {
      event.preventDefault()
      setHighlighted((i) => (i + 1) % suggestions.length)
    } else if (event.key === "ArrowUp") {
      event.preventDefault()
      setHighlighted((i) => (i <= 0 ? suggestions.length - 1 : i - 1))
    } else if (event.key === "Enter" && highlighted >= 0) {
      event.preventDefault()
      pick(suggestions[highlighted])
    } else if (event.key === "Escape") {
      setOpen(false)
    }
  }

  return (
    <div ref={containerRef} className={cn("relative", className)}>
      <Input
        id={id}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={onKeyDown}
        onFocus={() => suggestions.length > 0 && setOpen(true)}
        placeholder={placeholder}
        data-invalid={invalid}
        aria-invalid={invalid}
        aria-autocomplete="list"
        aria-expanded={open}
        autoComplete="off"
      />
      {loading && (
        <Loader2 className="h-4 w-4 animate-spin text-aurora-ink-3 absolute right-3 top-1/2 -translate-y-1/2" />
      )}

      {open && suggestions.length > 0 && (
        <ul
          role="listbox"
          className="absolute z-50 mt-1 w-full max-h-64 overflow-auto rounded-xl border border-aurora-line bg-white shadow-soft-lg py-1"
        >
          {suggestions.map((s, i) => (
            <li key={`${s.label}-${i}`}>
              <button
                type="button"
                role="option"
                aria-selected={i === highlighted}
                onMouseEnter={() => setHighlighted(i)}
                onClick={() => pick(s)}
                className={cn(
                  "w-full text-left px-3 py-2 flex items-start gap-2 text-[13px]",
                  i === highlighted ? "bg-aurora-surface" : "hover:bg-aurora-surface",
                )}
              >
                <MapPin className="h-3.5 w-3.5 text-aurora-blue shrink-0 mt-0.5" />
                <span>
                  <span className="text-aurora-ink">{kind === "city" ? s.city || s.label : s.street || s.label}</span>
                  {(s.postal_code || (kind !== "city" && s.city)) && (
                    <span className="block text-[11px] text-aurora-ink-3">
                      {(kind === "city"
                        ? [s.postal_code, s.country]
                        : [s.postal_code, s.city, s.country]
                      ).filter(Boolean).join(" · ")}
                    </span>
                  )}
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}

      {open && suggestions.length === 0 && !loading && value.trim().length >= MIN_CHARS && (
        <p className="text-[11px] text-aurora-ink-3 mt-1">
          {t("address.no_match", "Aucune adresse trouvée — vous pouvez saisir la vôtre manuellement.")}
        </p>
      )}
    </div>
  )
}
