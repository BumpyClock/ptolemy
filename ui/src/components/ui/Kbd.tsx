import * as React from "react";
import { cn } from "@/lib/utils";

const Kbd = React.forwardRef<HTMLElement, React.HTMLAttributes<HTMLElement>>(({ className, ...props }, ref) => (
  <kbd
    ref={ref}
    className={cn(
      "rounded border border-border bg-muted px-1.5 py-0.5 text-xs font-mono text-muted-foreground shadow-sm",
      className,
    )}
    {...props}
  />
));
Kbd.displayName = "Kbd";

export { Kbd };
