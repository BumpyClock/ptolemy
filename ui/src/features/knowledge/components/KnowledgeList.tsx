import { AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Skeleton } from "@/components/ui/Skeleton";
import type { ActiveOperation } from "../../progress/types";
import type { KnowledgeItem } from "../types";
import { KnowledgeCard } from "./KnowledgeCard";
import { KnowledgeTable } from "./KnowledgeTable";

interface KnowledgeListProps {
  items: KnowledgeItem[];
  viewMode: "grid" | "table";
  isLoading: boolean;
  isLoadingMore?: boolean;
  error: Error | null;
  onRetry: () => void;
  onViewDocument: (sourceId: string) => void;
  onViewCodeExamples?: (sourceId: string) => void;
  onDeleteSuccess: () => void;
  activeOperations?: ActiveOperation[];
  onRefreshStarted?: (progressId: string) => void;
}

export const KnowledgeList: React.FC<KnowledgeListProps> = ({
  items,
  viewMode,
  isLoading,
  isLoadingMore = false,
  error,
  onRetry,
  onViewDocument,
  onViewCodeExamples,
  onDeleteSuccess,
  activeOperations = [],
  onRefreshStarted,
}) => {
  const getActiveOperationForItem = (item: KnowledgeItem): ActiveOperation | undefined => {
    const matchBySourceId = activeOperations.find((op) => op.source_id === item.source_id);
    if (matchBySourceId) return matchBySourceId;

    const itemUrl = item.metadata?.original_url || item.url;
    return activeOperations.find((op) => {
      return (
        op.url === itemUrl ||
        op.current_url === itemUrl ||
        op.message?.includes(itemUrl) ||
        (op.operation_type === "crawl" && op.message?.includes(item.title))
      );
    });
  };

  if (isLoading && items.length === 0) {
    return (
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {Array.from({ length: 8 }).map((_, index) => (
          <div key={index} className="rounded-lg border bg-card p-4">
            <div className="space-y-3">
              <Skeleton className="h-4 w-3/4" />
              <Skeleton className="h-3 w-full" />
              <Skeleton className="h-3 w-2/3" />
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-lg border bg-muted/40 p-8 text-center">
        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-destructive/10 text-destructive">
          <AlertCircle className="h-6 w-6" />
        </div>
        <div className="mt-4">
          <h3 className="text-lg font-semibold">Failed to load knowledge base</h3>
          <p className="text-sm text-muted-foreground">{error.message}</p>
        </div>
        <Button variant="outline" onClick={onRetry} className="mt-4">
          Try again
        </Button>
      </div>
    );
  }

  if (items.length === 0) {
    return (
      <div className="rounded-lg border bg-muted/40 p-10 text-center">
        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-muted text-muted-foreground">
          <AlertCircle className="h-6 w-6" />
        </div>
        <div className="mt-4">
          <h3 className="text-lg font-semibold">No knowledge items</h3>
          <p className="text-sm text-muted-foreground">
            Start by adding documents or crawling websites to build your knowledge base.
          </p>
        </div>
      </div>
    );
  }

  if (viewMode === "table") {
    return (
      <KnowledgeTable
        items={items}
        onViewDocument={onViewDocument}
        onDeleteSuccess={onDeleteSuccess}
        isLoadingMore={isLoadingMore}
      />
    );
  }

  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
      {items.map((item) => {
        const activeOperation = getActiveOperationForItem(item);
        return (
          <KnowledgeCard
            key={item.source_id}
            item={item}
            onViewDocument={() => onViewDocument(item.source_id)}
            onViewCodeExamples={onViewCodeExamples ? () => onViewCodeExamples(item.source_id) : undefined}
            onDeleteSuccess={onDeleteSuccess}
            activeOperation={activeOperation}
            onRefreshStarted={onRefreshStarted}
          />
        );
      })}
      {isLoadingMore &&
        Array.from({ length: 4 }).map((_, index) => (
          <div key={`loading-more-${index}`} className="rounded-lg border bg-card p-4">
            <div className="space-y-3">
              <Skeleton className="h-4 w-3/4" />
              <Skeleton className="h-3 w-full" />
              <Skeleton className="h-3 w-2/3" />
            </div>
          </div>
        ))}
    </div>
  );
};
