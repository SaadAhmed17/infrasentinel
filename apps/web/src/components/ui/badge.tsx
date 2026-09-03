import * as React from "react"

import { cn } from "@/lib/utils"

function Badge({
  className,
  ...props
}: React.ComponentProps<"span">) {
  return (
    <span
      data-slot="badge"
      className={cn(
        "inline-flex w-fit shrink-0 items-center gap-1 rounded-md border px-1.5 py-0.5 text-xs font-medium whitespace-nowrap",
        className
      )}
      {...props}
    />
  )
}

export { Badge }