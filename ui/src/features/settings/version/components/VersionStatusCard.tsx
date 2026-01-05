import { AlertCircle, CheckCircle, Info, RefreshCw } from "lucide-react";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { useClearVersionCache, useVersionCheck } from "../hooks/useVersionQueries";

export function VersionStatusCard() {
  const { data, isLoading, error, refetch } = useVersionCheck();
  const clearCache = useClearVersionCache();

  const handleRefreshClick = async () => {
    // Clear cache and then refetch
    await clearCache.mutateAsync();
    refetch();
  };

  const status = isLoading
    ? { label: "Checking", variant: "secondary" as const, icon: RefreshCw, spin: true }
    : error
      ? { label: "Check failed", variant: "destructive" as const, icon: AlertCircle, spin: false }
      : data?.update_available
        ? { label: "Update available", variant: "warning" as const, icon: AlertCircle, spin: false }
        : { label: "Up to date", variant: "success" as const, icon: CheckCircle, spin: false };

  const StatusIcon = status.icon;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Info className="h-4 w-4 text-muted-foreground" />
          <h3 className="text-sm font-semibold">Version information</h3>
        </div>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          onClick={handleRefreshClick}
          disabled={isLoading || clearCache.isPending}
          aria-label="Refresh version check"
        >
          <RefreshCw className={`h-4 w-4 ${isLoading || clearCache.isPending ? "animate-spin" : ""}`} />
        </Button>
      </div>

      <div className="space-y-2 text-sm">
        <div className="flex items-center justify-between">
          <span className="text-muted-foreground">Current version</span>
          <span className="font-mono">{data?.current || "Loading..."}</span>
        </div>

        <div className="flex items-center justify-between">
          <span className="text-muted-foreground">Latest version</span>
          <span className="font-mono">
            {isLoading ? "Checking..." : error ? "Check failed" : data?.latest ? data.latest : "No releases found"}
          </span>
        </div>

        <div className="flex items-center justify-between">
          <span className="text-muted-foreground">Status</span>
          <Badge variant={status.variant}>
            <StatusIcon className={`mr-1 h-3.5 w-3.5 ${status.spin ? "animate-spin" : ""}`} />
            {status.label}
          </Badge>
        </div>

        {data?.published_at && (
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground">Released</span>
            <span>{new Date(data.published_at).toLocaleDateString()}</span>
          </div>
        )}
      </div>

      {error && (
        <div className="rounded-md border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
          {data?.check_error || "Failed to check for updates. Please try again later."}
        </div>
      )}
    </div>
  );
}
