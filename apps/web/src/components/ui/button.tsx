import { Button as ButtonPrimitive } from "@base-ui/react/button"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"

// Touch screens get larger targets (pointer-coarse), mouse users keep compact controls.
const buttonStyles = cva(
  "inline-flex shrink-0 items-center justify-center gap-2 whitespace-nowrap rounded-lg border border-transparent text-[14px] font-semibold select-none transition-[background-color,border-color,color,box-shadow,transform] duration-[120ms] active:translate-y-px disabled:pointer-events-none disabled:opacity-50 aria-disabled:pointer-events-none aria-disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
  {
    variants: {
      variant: {
        default:
          "bg-primary text-primary-foreground shadow-[inset_0_1px_0_rgb(255_255_255/0.16),0_4px_12px_-8px_var(--primary)] hover:bg-primary-bright",
        outline:
          "border-border-strong bg-surface-2 text-foreground hover:bg-accent",
        secondary:
          "bg-secondary text-secondary-foreground hover:bg-surface-3",
        ghost:
          "text-muted-foreground hover:bg-accent hover:text-foreground",
        destructive:
          "border-destructive/30 bg-destructive/10 text-destructive hover:bg-destructive/15",
        "destructive-solid":
          "bg-destructive text-white hover:bg-destructive/90",
        link: "text-primary underline-offset-4 hover:underline",
      },
      size: {
        default: "h-9.5 px-3.5 pointer-coarse:h-11",
        xs: "h-7 rounded-md px-2.5 text-[12.5px] pointer-coarse:h-9 [&_svg:not([class*='size-'])]:size-3.5",
        sm: "h-8 rounded-md px-3 text-[13px] pointer-coarse:h-10 [&_svg:not([class*='size-'])]:size-3.5",
        lg: "h-11 px-5 text-[15px]",
        icon: "size-9 pointer-coarse:size-11",
        "icon-xs": "size-7 rounded-md pointer-coarse:size-9 [&_svg:not([class*='size-'])]:size-3.5",
        "icon-sm": "size-8 rounded-md pointer-coarse:size-10",
        "icon-lg": "size-10",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
)

// Merged, so a variant's border or background wins over the base classes even
// when the classes go straight onto a Link instead of through <Button>.
function buttonVariants(props?: Parameters<typeof buttonStyles>[0]) {
  return cn(buttonStyles(props))
}

function Button({
  className,
  variant = "default",
  size = "default",
  ...props
}: ButtonPrimitive.Props & VariantProps<typeof buttonStyles>) {
  return (
    <ButtonPrimitive
      data-slot="button"
      className={buttonVariants({ variant, size, className })}
      {...props}
    />
  )
}

export { Button, buttonVariants }
