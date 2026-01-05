/**
 * Main Knowledge Base View Component
 * Orchestrates the knowledge base UI using vertical slice architecture
 */

import { useEffect, useMemo, useRef, useState } from "react";
import { useToast } from "@/features/shared/hooks/useToast";
import { CrawlingProgress } from "../../progress/components/CrawlingProgress";
import type { ActiveOperation } from "../../progress/types";
import { KnowledgeHeader } from "../components/KnowledgeHeader";
import { KnowledgeList } from "../components/KnowledgeList";
import { useKnowledgeSummaries } from "../hooks/useKnowledgeQueries";
import { KnowledgeInspector } from "../inspector/components/KnowledgeInspector";
import type { KnowledgeItem, KnowledgeItemsFilter } from "../types";

const INITIAL_PAGE = 1;
const PAGE_SIZE = 24;

export const KnowledgeView = () => {
  // View state
  const [viewMode, setViewMode] = useState<"grid" | "table">("grid");
  const [searchQuery, setSearchQuery] = useState("");
  const [typeFilter, setTypeFilter] = useState<"all" | "technical" | "business">("all");
  const [page, setPage] = useState(INITIAL_PAGE);
  const [items, setItems] = useState<KnowledgeItem[]>([]);
  const loadMoreRef = useRef<HTMLDivElement | null>(null);

  const [inspectorItem, setInspectorItem] = useState<KnowledgeItem | null>(null);
  const [inspectorInitialTab, setInspectorInitialTab] = useState<"documents" | "code">("documents");

  // Build filter object for API - memoize to prevent recreating on every render
  const filter = useMemo<KnowledgeItemsFilter>(() => {
    const f: KnowledgeItemsFilter = {
      page,
      per_page: PAGE_SIZE,
    };

    if (searchQuery) {
      f.search = searchQuery;
    }

    if (typeFilter !== "all") {
      f.knowledge_type = typeFilter;
    }

    return f;
  }, [searchQuery, typeFilter, page]);

  // Fetch knowledge summaries (no automatic polling!)
  const { data, isLoading, isFetching, error, refetch, setActiveCrawlIds, activeOperations } =
    useKnowledgeSummaries(filter);

  const knowledgeItems = items;
  const totalItems = data?.total || 0;
  const perPage = data?.per_page || PAGE_SIZE;
  const totalPages = totalItems > 0 ? Math.ceil(totalItems / perPage) : 1;
  const hasMorePages = page < totalPages;
  const hasActiveOperations = activeOperations.length > 0;

  // Toast notifications
  const { showToast } = useToast();
  const previousOperations = useRef<ActiveOperation[]>([]);

  // Track crawl completions and errors for toast notifications
  useEffect(() => {
    // Find operations that just completed or failed
    const finishedOps = previousOperations.current.filter((prevOp) => {
      const currentOp = activeOperations.find((op) => op.operation_id === prevOp.operation_id);
      // Operation disappeared from active list - check its final status
      return (
        !currentOp &&
        ["crawling", "processing", "storing", "document_storage", "completed", "error", "failed"].includes(
          prevOp.status,
        )
      );
    });

    // Show toast for each finished operation
    finishedOps.forEach((op) => {
      // Check if it was an error or success
      if (op.status === "error" || op.status === "failed") {
        // Show error message with details
        const errorMessage = op.message || "Operation failed";
        showToast(`❌ ${errorMessage}`, "error", 7000);
      } else if (op.status === "completed") {
        // Show success message
        const message = op.message || "Operation completed";
        showToast(`✅ ${message}`, "success", 5000);
      }

      // Remove from active crawl IDs
      setActiveCrawlIds((prev) => prev.filter((id) => id !== op.operation_id));

      // Refetch summaries after any completion
      refetch();
    });

    // Update previous operations
    previousOperations.current = [...activeOperations];
  }, [activeOperations, showToast, refetch, setActiveCrawlIds]);

  useEffect(() => {
    if (!data?.items) return;

    if (page === INITIAL_PAGE) {
      setItems(data.items);
      return;
    }

    setItems((prev) => {
      const next = new Map(prev.map((item) => [item.source_id, item]));
      for (const item of data.items) {
        next.set(item.source_id, item);
      }
      return Array.from(next.values());
    });
  }, [data?.items, page]);

  const handleViewDocument = (sourceId: string) => {
    // Find the item and open inspector to documents tab
    const item = knowledgeItems.find((k) => k.source_id === sourceId);
    if (item) {
      setInspectorInitialTab("documents");
      setInspectorItem(item);
    }
  };

  const handleViewCodeExamples = (sourceId: string) => {
    // Open the inspector to code examples tab
    const item = knowledgeItems.find((k) => k.source_id === sourceId);
    if (item) {
      setInspectorInitialTab("code");
      setInspectorItem(item);
    }
  };

  const handleDeleteSuccess = () => {
    // TanStack Query will automatically refetch
  };

  const handleSearchChange = (value: string) => {
    setSearchQuery(value);
    setPage(INITIAL_PAGE);
    setItems([]);
  };

  const handleTypeFilterChange = (value: "all" | "technical" | "business") => {
    setTypeFilter(value);
    setPage(INITIAL_PAGE);
    setItems([]);
  };

  const handleViewModeChange = (value: "grid" | "table") => {
    setViewMode(value);
    setPage(INITIAL_PAGE);
    setItems([]);
  };

  const handleLoadMore = () => {
    if (hasMorePages && !isFetching) {
      setPage((prev) => prev + 1);
    }
  };

  useEffect(() => {
    const target = loadMoreRef.current;
    if (!target || !hasMorePages) return;

    const observer = new IntersectionObserver(
      (entries) => {
        const [entry] = entries;
        if (entry?.isIntersecting) {
          handleLoadMore();
        }
      },
      { rootMargin: "200px 0px" },
    );

    observer.observe(target);
    return () => observer.disconnect();
  }, [hasMorePages, isFetching]);

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <KnowledgeHeader
        totalItems={totalItems}
        isLoading={isLoading}
        searchQuery={searchQuery}
        onSearchChange={handleSearchChange}
        typeFilter={typeFilter}
        onTypeFilterChange={handleTypeFilterChange}
        viewMode={viewMode}
        onViewModeChange={handleViewModeChange}
      />

      {/* Main Content */}
      <div className="flex-1 overflow-auto px-6 pb-6">
        {/* Active Operations - Show at top when present */}
        {hasActiveOperations && (
          <div className="mb-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold">Active operations ({activeOperations.length})</h3>
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <div className="h-2 w-2 rounded-full bg-primary animate-pulse" />
                Live updates
              </div>
            </div>
            <CrawlingProgress onSwitchToBrowse={() => {}} />
          </div>
        )}

        {/* Knowledge Items List */}
        <KnowledgeList
          items={knowledgeItems}
          viewMode={viewMode}
          isLoading={isLoading}
          isLoadingMore={isFetching && knowledgeItems.length > 0}
          error={error}
          onRetry={refetch}
          onViewDocument={handleViewDocument}
          onViewCodeExamples={handleViewCodeExamples}
          onDeleteSuccess={handleDeleteSuccess}
          activeOperations={activeOperations}
          onRefreshStarted={(progressId) => {
            // Add the progress ID to track it
            setActiveCrawlIds((prev) => [...prev, progressId]);
          }}
        />

        {hasMorePages && !error && (
          <div ref={loadMoreRef} className="mt-8 flex justify-center py-2">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <span className="h-2 w-2 rounded-full bg-muted-foreground/50 animate-pulse" />
              {isFetching ? "Loading more" : "Scroll to load more"}
            </div>
          </div>
        )}
      </div>

      {/* Dialogs */}
      {/* Knowledge Inspector Modal */}
      {inspectorItem && (
        <KnowledgeInspector
          item={inspectorItem}
          open={!!inspectorItem}
          onOpenChange={(open) => {
            if (!open) setInspectorItem(null);
          }}
          initialTab={inspectorInitialTab}
        />
      )}
    </div>
  );
};
