import * as React from "react"
import * as ProgressPrimitive from "@radix-ui/react-progress"

import { cn } from "@/lib/utils"

function Progress({
  className,
  value,
  ...props
}: React.ComponentProps<typeof ProgressPrimitive.Root>) {
  return (
    <ProgressPrimitive.Root
      data-slot="progress"
      className={cn(
        "bg-primary/20 relative h-2 w-full overflow-hidden rounded-full shadow-inner",
        className
      )}
      {...props}
    >
      <ProgressPrimitive.Indicator
        data-slot="progress-indicator"
        className="relative h-full w-full flex-1 overflow-hidden rounded-full bg-gradient-to-r from-cyan-400 via-blue-500 to-indigo-500 shadow-[0_6px_16px_rgba(59,130,246,0.35)] transition-transform duration-700 ease-out"
        style={{ transform: `translateX(-${100 - (value || 0)}%)` }}
      >
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-r from-white/0 via-white/35 to-white/0 opacity-70 animate-progress-shimmer" />
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-r from-white/0 via-white/45 to-white/0 opacity-40 animate-progress-wave" />
      </ProgressPrimitive.Indicator>
    </ProgressPrimitive.Root>
  )
}

export { Progress }
