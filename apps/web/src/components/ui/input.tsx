import * as React from "react"

import { cn } from "@/lib/utils"
import { fieldControlClass } from "./form-styles"

function Input({ className, type, ...props }: React.ComponentProps<"input">) {
  return (
    <input
      type={type}
      data-slot="input"
      className={cn(fieldControlClass, "min-w-0", className)}
      {...props}
    />
  )
}

export { Input }
