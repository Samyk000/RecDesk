import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cn } from "../../lib/utils";

type Variant = "primary" | "secondary" | "ghost" | "outline" | "destructive";
type Size = "xs" | "sm" | "md" | "icon";

const variantClasses: Record<Variant, string> = {
  primary:
    "bg-primary text-primary-fg hover:bg-primary-hover focus-visible:ring-2 focus-visible:ring-primary/40",
  secondary:
    "bg-surface-hover text-fg hover:bg-surface-active border border-border",
  ghost: "text-fg-muted hover:text-fg hover:bg-surface-hover",
  outline: "border border-border text-fg hover:bg-surface-hover",
  destructive:
    "bg-red-500 text-white hover:bg-red-600 focus-visible:ring-2 focus-visible:ring-red-500/40",
};

const sizeClasses: Record<Size, string> = {
  xs: "h-6 px-2 text-xs gap-1",
  sm: "h-8 px-3 text-sm gap-1.5",
  md: "h-9 px-4 text-sm gap-2",
  icon: "h-8 w-8",
};

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
  asChild?: boolean;
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = "secondary", size = "md", asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : "button";
    return (
      <Comp
        className={cn(
          "inline-flex select-none items-center justify-center whitespace-nowrap rounded-md font-medium transition-colors duration-150 outline-none disabled:pointer-events-none disabled:opacity-50",
          variantClasses[variant],
          sizeClasses[size],
          className,
        )}
        ref={ref}
        {...props}
      />
    );
  },
);
Button.displayName = "Button";

export { Button };