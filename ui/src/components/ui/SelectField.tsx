import * as React from "react";
import { NativeSelect } from "@/components/ui/NativeSelect";
import { cn } from "@/lib/utils";

interface SelectOption {
  value: string;
  label: string;
}

interface SelectFieldProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
  label?: string;
  description?: string;
  options: SelectOption[];
  containerClassName?: string;
}

const SelectField = React.forwardRef<HTMLSelectElement, SelectFieldProps>(
  ({ label, description, options, className, containerClassName, id, ...props }, ref) => (
    <div className={cn("space-y-1", containerClassName)}>
      {label && (
        <label htmlFor={id} className="text-sm font-medium">
          {label}
        </label>
      )}
      <NativeSelect id={id} ref={ref} className={className} {...props}>
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </NativeSelect>
      {description && <p className="text-xs text-muted-foreground">{description}</p>}
    </div>
  ),
);
SelectField.displayName = "SelectField";

export { SelectField };
