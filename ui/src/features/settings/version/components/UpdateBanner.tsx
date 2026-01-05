import { ArrowUpCircle, ExternalLink, X } from "lucide-react";
import React from "react";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { useVersionCheck } from "../hooks/useVersionQueries";

export function UpdateBanner() {
  const { data, isLoading, error } = useVersionCheck();
  const [isDismissed, setIsDismissed] = React.useState(false);

  // Don't show banner if loading, error, no data, or no update available
  if (isLoading || error || !data?.update_available || isDismissed) {
    return null;
  }

  return (
    <Card className="mb-6 border-dashed">
      <div className="flex flex-col gap-4 p-4 md:flex-row md:items-center md:justify-between">
        <div className="flex items-start gap-3">
          <div className="rounded-md bg-primary/10 p-2 text-primary">
            <ArrowUpCircle className="h-5 w-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-sm font-semibold">Update available</h3>
              <Badge variant="warning">v{data.latest}</Badge>
            </div>
            <p className="text-xs text-muted-foreground">You are currently running v{data.current}</p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {data.release_url && (
            <Button asChild variant="outline" size="sm">
              <a href={data.release_url} target="_blank" rel="noopener noreferrer">
                View release
                <ExternalLink className="h-4 w-4" />
              </a>
            </Button>
          )}
          <Button asChild variant="outline" size="sm">
            <a href="https://github.com/coleam00/Ptolemy#upgrading" target="_blank" rel="noopener noreferrer">
              Upgrade guide
              <ExternalLink className="h-4 w-4" />
            </a>
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            onClick={() => setIsDismissed(true)}
            aria-label="Dismiss update banner"
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </Card>
  );
}
