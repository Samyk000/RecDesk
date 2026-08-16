import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cn } from "../../lib/utils";

type Variant = "primary" | "secondary" | "ghost" | "outline" | "destructive";
type Size = "xs" | "sm" | "md" | "icon";

const variantClasses: Record<Variant, string> = {
  primary:
    "relative overflow-hidden bg-primary text-primary-fg shadow-raise hover:bg-primary-hover hover:shadow-float focus-visible:ring-2 focus-visible:ring-primary/40 active:bg-primary-hover",
  secondary:
    "bg-surface-hover text-fg hover:bg-surface-active hover:shadow-raise border border-border active:bg-surface-active",
  ghost: "text-fg-muted hover:text-fg hover:bg-surface-hover active:bg-surface-active",
  outline: "border border-border text-fg hover:bg-surface-hover hover:shadow-raise active:bg-surface-active",
  destructive:
    "bg-red-500 text-white hover:bg-red-600 focus-visible:ring-2 focus-visible:ring-red-500/40 active:bg-red-600",
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
          "inline-flex select-none items-center justify-center whitespace-nowrap rounded-md font-medium transition-all duration-150 outline-none disabled:pointer-events-none disabled:opacity-50 disabled:shadow-none active:scale-[0.97] cursor-pointer",
          variant === "primary" && "btn-shine",
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