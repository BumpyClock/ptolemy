import * as React from "react";
import { cn } from "@/lib/utils";

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  description?: string;
  icon?: React.ReactNode;
  containerClassName?: string;
}

const baseInputClass =
  "flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background " +
  "placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring " +
  "focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50";

const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, type, label, description, icon, containerClassName, id, ...props }, ref) => {
    if (label || description || icon) {
      return (
        <div className={cn("space-y-1", containerClassName)}>
          {label && (
            <label htmlFor={id} className="text-sm font-medium">
              {label}
            </label>
          )}
          <div className={cn("relative", icon && "flex items-center")}>
            {icon && <span className="absolute left-3 text-muted-foreground">{icon}</span>}
            <input
              id={id}
              type={type}
              className={cn(baseInputClass, icon && "pl-9", className)}
              ref={ref}
              {...props}
            />
          </div>
          {description && <p className="text-xs text-muted-foreground">{description}</p>}
        </div>
      );
    }

    return (
      <input
        id={id}
        type={type}
        className={cn(baseInputClass, className)}
        ref={ref}
        {...props}
      />
    );
  },
);
Input.displayName = "Input";

export { Input };
