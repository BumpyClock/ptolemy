import { CheckCircle, Globe, Loader2, StopCircle, XCircle } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { Card, CardContent, CardHeader } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { useStopCrawl } from "../../knowledge/hooks";
import { useCrawlProgressPolling } from "../hooks";
import type { ActiveOperation } from "../types/progress";

interface CrawlingProgressProps {
  onSwitchToBrowse: () => void;
}

export const CrawlingProgress: React.FC<CrawlingProgressProps> = ({ onSwitchToBrowse }) => {
  const { activeOperations, isLoading } = useCrawlProgressPolling();
  const stopMutation = useStopCrawl();
  const [stoppingId, setStoppingId] = useState<string | null>(null);

  const handleStop = async (progressId: string) => {
    try {
      setStoppingId(progressId);
      await stopMutation.mutateAsync(progressId);
    } catch (error) {
      console.error("Stop crawl failed:", { progressId, error });
    } finally {
      setStoppingId(null);
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "completed":
        return <CheckCircle className="h-4 w-4" />;
      case "failed":
      case "error":
        return <XCircle className="h-4 w-4" />;
      case "stopped":
      case "cancelled":
        return <StopCircle className="h-4 w-4" />;
      default:
        return <Loader2 className="h-4 w-4 animate-spin" />;
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "completed":
        return "success" as const;
      case "failed":
      case "error":
        return "warning" as const;
      case "stopped":
      case "cancelled":
        return "secondary" as const;
      default:
        return "secondary" as const;
    }
  };

  const getProgressPercentage = (operation: ActiveOperation): number => {
    if (typeof operation.progress === "number") return Math.round(operation.progress);
    return 0;
  };

  if (isLoading && activeOperations.length === 0) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-center text-muted-foreground">
          <Loader2 className="mx-auto mb-4 h-8 w-8 animate-spin" />
          <p>Loading operations...</p>
        </div>
      </div>
    );
  }

  if (activeOperations.length === 0) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center gap-3 p-8 text-center">
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-muted">
            <Globe className="h-6 w-6 text-muted-foreground" />
          </div>
          <div>
            <h3 className="text-lg font-semibold">No active operations</h3>
            <p className="text-sm text-muted-foreground">
              Start crawling websites or uploading documents to expand your knowledge base.
            </p>
          </div>
          <Button variant="outline" onClick={onSwitchToBrowse}>
            Browse knowledge base
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {activeOperations.map((operation) => {
        const progress = getProgressPercentage(operation);
        const isActive = [
          "crawling",
          "processing",
          "in_progress",
          "starting",
          "initializing",
          "discovery",
          "analyzing",
          "storing",
          "source_creation",
          "document_storage",
          "code_extraction",
          "summarizing",
        ].includes(operation.status);

        return (
          <Card key={operation.operation_id}>
            <CardHeader className="pb-3">
              <div className="flex items-start justify-between gap-4">
                <div className="space-y-2">
                  <div className="flex items-center gap-2 text-sm font-medium">
                    {getStatusIcon(operation.status)}
                    <span className="truncate">{operation.message || operation.current_url || "Processing..."}</span>
                  </div>
                  <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                    <Badge variant={getStatusBadge(operation.status)}>
                      {operation.status.replace(/_/g, " ").replace(/^\w/, (c) => c.toUpperCase())}
                    </Badge>
                    {operation.operation_type && (
                      <Badge variant="outline">
                        {operation.operation_type === "crawl"
                          ? "Web crawl"
                          : operation.operation_type === "upload"
                            ? "Document upload"
                            : operation.operation_type}
                      </Badge>
                    )}
                  </div>
                </div>

                {isActive && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleStop(operation.operation_id)}
                    disabled={stoppingId === operation.operation_id}
                    className="text-destructive"
                  >
                    {stoppingId === operation.operation_id ? (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    ) : (
                      <StopCircle className="mr-2 h-4 w-4" />
                    )}
                    Stop
                  </Button>
                )}
              </div>
            </CardHeader>
            <CardContent className="space-y-2">
              <div className="h-1.5 w-full rounded-full bg-muted">
                <div className="h-full rounded-full bg-primary" style={{ width: `${progress}%` }} />
              </div>
              <div className="text-xs text-muted-foreground">{progress}%</div>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
};
