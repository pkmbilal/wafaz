import * as React from "react"
import { cn } from "cn"

// Matches Input: card surface, 16px text (no iOS zoom), brand focus ring.
function Textarea({ className, ...props }: React.ComponentProps<"textarea">) {
  return (
    <textarea
      data-slot="textarea"
      className={cn(
        "flex field-sizing-content min-h-24 w-full rounded-md border border-input bg-card px-3.5 py-2.5 text-base text-foreground transition-colors outline-none placeholder:text-muted-foreground/80 focus-visible:border-primary/60 focus-visible:ring-3 focus-visible:ring-ring/40 disabled:cursor-not-allowed disabled:bg-muted disabled:opacity-60 aria-invalid:border-destructive aria-invalid:ring-3 aria-invalid:ring-destructive/15",
        className
      )}
      {...props}
    />
  )
}

export { Textarea }
