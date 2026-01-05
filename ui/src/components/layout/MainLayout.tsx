import type React from "react";
import { useEffect } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { useToast } from "@/features/shared/hooks/useToast";
import { credentialsService } from "@/services/credentialsService";
import { isLmConfigured } from "@/utils/onboarding";
import { cn } from "@/lib/utils";
import { BackendStartupError } from "../BackendStartupError";
import { useBackendHealth } from "./hooks/useBackendHealth";
import { Navigation } from "./Navigation";
import { Badge } from "@/components/ui/Badge";
import { Menubar, MenubarContent, MenubarItem, MenubarMenu, MenubarTrigger } from "@/components/ui/Menubar";
import { NavigationMenu, NavigationMenuItem, NavigationMenuLink, NavigationMenuList } from "@/components/ui/NavigationMenu";
import { Separator } from "@/components/ui/Separator";

interface MainLayoutProps {
  children: React.ReactNode;
  className?: string;
}

interface BackendStatusProps {
  isHealthLoading: boolean;
  isBackendError: boolean;
  healthData: { ready: boolean } | undefined;
}

function BackendStatus({ isHealthLoading, isBackendError, healthData }: BackendStatusProps) {
  if (isHealthLoading) {
    return <Badge variant="warning">Connecting</Badge>;
  }

  if (isBackendError) {
    return <Badge variant="destructive">Backend Offline</Badge>;
  }

  if (healthData?.ready === false) {
    return <Badge variant="secondary">Starting</Badge>;
  }

  return <Badge variant="success">Online</Badge>;
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

  const {
    data: healthData,
    isError: isBackendError,
    error: backendError,
    isLoading: isHealthLoading,
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

  return (
    <div className={cn("min-h-screen bg-background", className)}>
      {backendStartupFailed && <BackendStartupError />}

      <div className="flex min-h-screen">
        <aside className="hidden w-64 flex-col border-r bg-background md:flex">
          <div className="flex items-center gap-2 px-4 py-4">
            <Link to="/" className="flex items-center gap-2 text-sm font-semibold text-foreground">
              <img src="/logo-neon.png" alt="Ptolemy" className="h-6 w-6" />
              Ptolemy
            </Link>
          </div>
          <nav className="px-2">
            <Navigation />
          </nav>
          <div className="mt-auto px-4 pb-5 pt-4">
            <Separator className="mb-4" />
            <BackendStatus isHealthLoading={isHealthLoading} isBackendError={isBackendError} healthData={healthData} />
          </div>
        </aside>

        <div className="flex min-h-screen flex-1 flex-col">
          <header className="flex items-center justify-between border-b bg-background px-4 py-3 md:hidden">
            <Link to="/" className="text-sm font-semibold">
              Ptolemy
            </Link>
            <NavigationMenu>
              <NavigationMenuList>
                {navigationItems.map((item) => (
                  <NavigationMenuItem key={item.path}>
                    <NavigationMenuLink asChild>
                      <Link to={item.path} className="text-sm">
                        {item.label}
                      </Link>
                    </NavigationMenuLink>
                  </NavigationMenuItem>
                ))}
              </NavigationMenuList>
            </NavigationMenu>
          </header>

          <header className="hidden items-center justify-between border-b bg-background px-6 py-3 md:flex">
            <Menubar>
              <MenubarMenu>
                <MenubarTrigger>Navigate</MenubarTrigger>
                <MenubarContent>
                  {navigationItems.map((item) => (
                    <MenubarItem key={item.path} onClick={() => navigate(item.path)}>
                      {item.label}
                    </MenubarItem>
                  ))}
                </MenubarContent>
              </MenubarMenu>
            </Menubar>
            <BackendStatus isHealthLoading={isHealthLoading} isBackendError={isBackendError} healthData={healthData} />
          </header>

          <main className="flex-1 px-6 py-6">{children}</main>
        </div>
      </div>
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
