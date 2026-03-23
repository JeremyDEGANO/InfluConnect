import { Check } from "lucide-react"
import { cn } from "@/lib/utils"
import { Progress } from "@/components/ui/progress"

interface Step {
  id: number
  title: string
  description?: string
}

interface MultiStepFormProps {
  steps: Step[]
  currentStep: number
  children: React.ReactNode
}

export function MultiStepForm({ steps, currentStep, children }: MultiStepFormProps) {
  const progress = ((currentStep - 1) / (steps.length - 1)) * 100

  return (
    <div className="w-full">
      <div className="mb-8">
        <Progress value={progress} className="h-2 mb-6" />
        <div className="flex justify-between">
          {steps.map((step) => {
            const done = step.id < currentStep
            const active = step.id === currentStep
            return (
              <div key={step.id} className="flex flex-col items-center gap-1" style={{ width: `${100 / steps.length}%` }}>
                <div className={cn(
                  "h-8 w-8 rounded-full flex items-center justify-center text-sm font-semibold transition-all",
                  done && "bg-gradient-to-r from-purple-600 to-indigo-600 text-white",
                  active && "bg-gradient-to-r from-purple-600 to-blue-600 text-white ring-4 ring-purple-100",
                  !done && !active && "bg-gray-100 text-gray-400"
                )}>
                  {done ? <Check className="h-4 w-4" /> : step.id}
                </div>
                <span className={cn("text-xs font-medium text-center hidden sm:block", active ? "text-purple-700" : done ? "text-gray-700" : "text-gray-400")}>
                  {step.title}
                </span>
              </div>
            )
          })}
        </div>
      </div>
      <div>{children}</div>
    </div>
  )
}
