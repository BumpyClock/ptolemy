import { AlertTriangle, CheckCircle, Database, RefreshCw } from "lucide-react";
import React from "react";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { useMigrationStatus } from "../hooks/useMigrationQueries";
import { PendingMigrationsModal } from "./PendingMigrationsModal";

export function MigrationStatusCard() {
  const { data, isLoading, error, refetch } = useMigrationStatus();
  const [isModalOpen, setIsModalOpen] = React.useState(false);

  const handleRefresh = () => {
    refetch();
  };

  const status = isLoading
    ? { label: "Checking", variant: "secondary" as const, icon: RefreshCw, spin: true }
    : error
      ? { label: "Error loading", variant: "destructive" as const, icon: AlertTriangle, spin: false }
      : data?.bootstrap_required
        ? { label: "Setup required", variant: "warning" as const, icon: AlertTriangle, spin: false }
        : data?.has_pending
          ? { label: "Migrations pending", variant: "warning" as const, icon: AlertTriangle, spin: false }
          : { label: "Up to date", variant: "success" as const, icon: CheckCircle, spin: false };

  const StatusIcon = status.icon;

  return (
    <>
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Database className="h-4 w-4 text-muted-foreground" />
            <h3 className="text-sm font-semibold">Database migrations</h3>
          </div>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            onClick={handleRefresh}
            disabled={isLoading}
            aria-label="Refresh migration status"
          >
            <RefreshCw className={`h-4 w-4 ${isLoading ? "animate-spin" : ""}`} />
          </Button>
        </div>

        <div className="space-y-2 text-sm">
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground">Applied migrations</span>
            <span className="font-mono">{data?.applied_count ?? 0}</span>
          </div>

          <div className="flex items-center justify-between">
            <span className="text-muted-foreground">Pending migrations</span>
            <span className="font-mono">{data?.pending_count ?? 0}</span>
          </div>

          <div className="flex items-center justify-between">
            <span className="text-muted-foreground">Status</span>
            <Badge variant={status.variant}>
              <StatusIcon className={`mr-1 h-3.5 w-3.5 ${status.spin ? "animate-spin" : ""}`} />
              {status.label}
            </Badge>
          </div>

          {data?.current_version && (
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Database version</span>
              <span className="font-mono">{data.current_version}</span>
            </div>
          )}
        </div>

        {data?.has_pending && (
          <div className="rounded-md border border-border bg-muted p-3 text-sm text-muted-foreground">
            <p className="mb-2">
              {data.bootstrap_required
                ? "Initial database setup is required."
                : `${data.pending_count} migration${data.pending_count > 1 ? "s" : ""} need to be applied.`}
            </p>
            <Button type="button" variant="outline" size="sm" onClick={() => setIsModalOpen(true)}>
              View pending migrations
            </Button>
          </div>
        )}

        {error && (
          <div className="rounded-md border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
            Failed to load migration status. Please check your database connection.
          </div>
        )}
      </div>

      {data && (
        <PendingMigrationsModal
          isOpen={isModalOpen}
          onClose={() => setIsModalOpen(false)}
          migrations={data.pending_migrations}
          onMigrationsApplied={refetch}
        />
      )}
    </>
  );
}
