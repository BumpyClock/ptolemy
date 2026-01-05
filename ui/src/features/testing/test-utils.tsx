import { QueryClientProvider } from "@tanstack/react-query";
import { render as rtlRender } from "@testing-library/react";
import type React from "react";
import { createTestQueryClient } from "../shared/config/queryClient";
import { TooltipProvider } from "@/components/ui/Tooltip";

/**
 * Custom render function that wraps components with all necessary providers
 * This follows the best practice of having a centralized test render utility
 */
export function renderWithProviders(
  ui: React.ReactElement,
  { queryClient = createTestQueryClient(), ...renderOptions } = {},
) {
  function Wrapper({ children }: { children: React.ReactNode }) {
    return (
      <QueryClientProvider client={queryClient}>
        <TooltipProvider>
          {children}
        </TooltipProvider>
      </QueryClientProvider>
    );
  }

  return rtlRender(ui, { wrapper: Wrapper, ...renderOptions });
}

// Re-export everything from React Testing Library
export * from "@testing-library/react";

// Override the default render with our custom one
export { renderWithProviders as render };
