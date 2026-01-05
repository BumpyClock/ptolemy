import * as React from "react";
import * as ToggleGroupPrimitive from "@radix-ui/react-toggle-group";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const toggleGroupVariants = cva("inline-flex items-center justify-center rounded-md bg-muted p-1 text-muted-foreground", {
  variants: {
    variant: {
      default: "bg-muted",
      outline: "border border-input bg-transparent",
    },
  },
  defaultVariants: {
    variant: "default",
  },
});

const ToggleGroup = React.forwardRef<
  React.ElementRef<typeof ToggleGroupPrimitive.Root>,
  React.ComponentPropsWithoutRef<typeof ToggleGroupPrimitive.Root> & VariantProps<typeof toggleGroupVariants>
>(({ className, variant, ...props }, ref) => (
  <ToggleGroupPrimitive.Root ref={ref} className={cn(toggleGroupVariants({ variant }), className)} {...props} />
));
ToggleGroup.displayName = ToggleGroupPrimitive.Root.displayName;

const toggleGroupItemVariants = cva(
  [
    "inline-flex items-center justify-center rounded-sm px-3 py-1.5 text-sm font-medium transition-all",
    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
    "data-[state=on]:bg-background data-[state=on]:text-foreground data-[state=on]:shadow",
  ].join(" "),
);

const ToggleGroupItem = React.forwardRef<
  React.ElementRef<typeof ToggleGroupPrimitive.Item>,
  React.ComponentPropsWithoutRef<typeof ToggleGroupPrimitive.Item>
>(({ className, ...props }, ref) => (
  <ToggleGroupPrimitive.Item ref={ref} className={cn(toggleGroupItemVariants(), className)} {...props} />
));
ToggleGroupItem.displayName = ToggleGroupPrimitive.Item.displayName;

export { ToggleGroup, ToggleGroupItem };
