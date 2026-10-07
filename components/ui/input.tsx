import * as React from "react"
import { cn } from "cn"

// 44px tall (--touch-target) and 16px text so iOS doesn't zoom on focus.
function Input({ className, type, ...props }: React.ComponentProps<"input">) {
  return (
    <input
      type={type}
      data-slot="input"
      className={cn(
        "min-h-touch w-full min-w-0 rounded-md border border-input bg-card px-3.5 py-2 text-base text-foreground shadow-none transition-colors outline-none placeholder:text-muted-foreground/80 focus-visible:border-primary/60 focus-visible:ring-3 focus-visible:ring-ring/40 disabled:cursor-not-allowed disabled:bg-muted disabled:opacity-60 read-only:bg-muted/60 aria-invalid:border-destructive aria-invalid:ring-3 aria-invalid:ring-destructive/15",
        className
      )}
      {...props}
    />
  )
}

export { Input }
