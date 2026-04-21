import { useRef, useState, useEffect } from "react"
import { useTranslation } from "react-i18next"
import { Button } from "@/components/ui/button"
import { Eraser, PenTool } from "lucide-react"

interface Props {
  onChange: (dataUrl: string | null) => void
  height?: number
}

/**
 * Lightweight HTML5 canvas signature pad. Emits a base64 PNG data URL on
 * each stroke (or null when cleared). No third-party dependency.
 */
export function SignaturePad({ onChange, height = 160 }: Props) {
  const { t } = useTranslation()
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const drawing = useRef(false)
  const [empty, setEmpty] = useState(true)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ratio = window.devicePixelRatio || 1
    const rect = canvas.getBoundingClientRect()
    canvas.width = rect.width * ratio
    canvas.height = rect.height * ratio
    const ctx = canvas.getContext("2d")
    if (ctx) {
      ctx.scale(ratio, ratio)
      ctx.lineWidth = 2
      ctx.lineCap = "round"
      ctx.strokeStyle = "#1e293b"
    }
  }, [])

  const getPos = (e: React.PointerEvent) => {
    const rect = canvasRef.current!.getBoundingClientRect()
    return { x: e.clientX - rect.left, y: e.clientY - rect.top }
  }

  const start = (e: React.PointerEvent) => {
    drawing.current = true
    const ctx = canvasRef.current!.getContext("2d")!
    const { x, y } = getPos(e)
    ctx.beginPath()
    ctx.moveTo(x, y)
  }

  const move = (e: React.PointerEvent) => {
    if (!drawing.current) return
    const ctx = canvasRef.current!.getContext("2d")!
    const { x, y } = getPos(e)
    ctx.lineTo(x, y)
    ctx.stroke()
    if (empty) setEmpty(false)
  }

  const end = () => {
    if (!drawing.current) return
    drawing.current = false
    const data = canvasRef.current!.toDataURL("image/png")
    onChange(empty ? null : data)
  }

  const clear = () => {
    const canvas = canvasRef.current!
    const ctx = canvas.getContext("2d")!
    ctx.clearRect(0, 0, canvas.width, canvas.height)
    setEmpty(true)
    onChange(null)
  }

  return (
    <div className="space-y-2">
      <div className="relative border-2 border-dashed border-gray-300 rounded-xl bg-white overflow-hidden" style={{ height }}>
        <canvas
          ref={canvasRef}
          className="w-full h-full touch-none cursor-crosshair"
          onPointerDown={start}
          onPointerMove={move}
          onPointerUp={end}
          onPointerLeave={end}
        />
        {empty && (
          <div className="pointer-events-none absolute inset-0 flex items-center justify-center text-gray-300 text-sm gap-2">
            <PenTool className="h-4 w-4" />
            {t("signature.pad_placeholder")}
          </div>
        )}
      </div>
      <Button variant="outline" size="sm" type="button" onClick={clear}>
        <Eraser className="h-3.5 w-3.5 mr-1.5" />
        {t("signature.clear")}
      </Button>
    </div>
  )
}
