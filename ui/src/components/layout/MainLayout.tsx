import type React from "react";
import { useEffect, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import { Plus } from "lucide-react";
import { useToast } from "@/features/shared/hooks/useToast";
import { credentialsService } from "@/services/credentialsService";
import { isLmConfigured } from "@/utils/onboarding";
import { cn } from "@/lib/utils";
import { BackendStartupError } from "../BackendStartupError";
import { useBackendHealth } from "./hooks/useBackendHealth";
import { Button } from "@/components/ui/Button";
import { AddKnowledgeDialog } from "@/features/knowledge/components/AddKnowledgeDialog";
import { knowledgeKeys } from "@/features/knowledge/hooks/useKnowledgeQueries";

interface MainLayoutProps {
  children: React.ReactNode;
  className?: string;
}

const navigationItems = [
  { path: "/", label: "Knowledge Base" },
  { path: "/mcp", label: "MCP" },
  { path: "/settings", label: "Settings" },
];

export function MainLayout({ children, className }: MainLayoutProps) {
  const navigate = useNavigate();
  const location = useLocation();
  const { showToast } = useToast();
  const queryClient = useQueryClient();
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);

  const {
    data: healthData,
    isError: isBackendError,
    error: backendError,
    failureCount,
  } = useBackendHealth();

  const backendStartupFailed = isBackendError && failureCount >= 5;

  useEffect(() => {
    const checkOnboarding = async () => {
      if (backendStartupFailed) return;
      if (!healthData?.ready || location.pathname === "/onboarding") return;
      if (localStorage.getItem("onboardingDismissed") === "true") return;

      try {
        const [ragCreds, apiKeyCreds] = await Promise.all([
          credentialsService.getCredentialsByCategory("rag_strategy"),
          credentialsService.getCredentialsByCategory("api_keys"),
        ]);

        const configured = isLmConfigured(ragCreds, apiKeyCreds);
        if (!configured) {
          navigate("/onboarding", { replace: true });
        }
      } catch (error) {
        console.error("ONBOARDING_CHECK_FAILED:", error);
        showToast("Configuration check failed. You can manually configure in Settings.", "warning");
      }
    };

    checkOnboarding();
  }, [healthData?.ready, backendStartupFailed, location.pathname, navigate, showToast]);

  useEffect(() => {
    if (isBackendError && backendError) {
      const errorMessage = backendError instanceof Error ? backendError.message : "Backend connection failed";
      showToast(`Backend unavailable: ${errorMessage}. Some features may not work.`, "error");
    }
  }, [isBackendError, backendError, showToast]);

  const handleAddKnowledgeSuccess = () => {
    queryClient.invalidateQueries({ queryKey: knowledgeKeys.summariesPrefix() });
  };

  return (
    <div className={cn("min-h-screen bg-background", className)}>
      {backendStartupFailed && <BackendStartupError />}

      <div className="flex min-h-screen flex-col">
        <header className="sticky top-0 z-40 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80">
          <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 md:px-6">
            <div className="flex items-center gap-6">
              <Link to="/" className="flex items-center gap-2 text-sm font-semibold text-foreground">
                <img src="/logo-neon.png" alt="Ptolemy" className="h-6 w-6" />
                Ptolemy
              </Link>
              <nav className="hidden items-center gap-4 text-sm md:flex" aria-label="Primary">
                {navigationItems.map((item) => {
                  const isActive = location.pathname === item.path;
                  return (
                    <Link
                      key={item.path}
                      to={item.path}
                      className={cn(
                        "rounded-md px-2 py-1 transition-colors",
                        isActive ? "bg-muted text-foreground" : "text-muted-foreground hover:text-foreground",
                      )}
                      aria-current={isActive ? "page" : undefined}
                    >
                      {item.label}
                    </Link>
                  );
                })}
              </nav>
            </div>
            <div className="flex items-center gap-3">
              <Button onClick={() => setIsAddDialogOpen(true)} className="gap-2">
                <Plus className="h-4 w-4" />
                Add knowledge
              </Button>
            </div>
          </div>
          <nav className="flex flex-wrap items-center gap-2 px-4 pb-3 text-sm md:hidden" aria-label="Primary">
            {navigationItems.map((item) => {
              const isActive = location.pathname === item.path;
              return (
                <Link
                  key={item.path}
                  to={item.path}
                  className={cn(
                    "rounded-md px-2 py-1 transition-colors",
                    isActive ? "bg-muted text-foreground" : "text-muted-foreground hover:text-foreground",
                  )}
                  aria-current={isActive ? "page" : undefined}
                >
                  {item.label}
                </Link>
              );
            })}
          </nav>
        </header>

        <main className="flex-1 px-6 py-6">{children}</main>
      </div>

      <AddKnowledgeDialog
        open={isAddDialogOpen}
        onOpenChange={setIsAddDialogOpen}
        onSuccess={handleAddKnowledgeSuccess}
      />
    </div>
  );
}

export function MinimalLayout({ children, className }: MainLayoutProps) {
  return (
    <div className={cn("min-h-screen bg-background", "flex items-center justify-center", className)}>
      <div className="w-full max-w-4xl px-6">{children}</div>
    </div>
  );
}
