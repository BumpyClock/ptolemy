import { Code, FileText, Hash, Loader2, Search } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { ScrollArea } from "@/components/ui/ScrollArea";
import { cn } from "@/lib/utils";
import type { CodeExample, DocumentChunk } from "../../types";

interface InspectorSidebarProps {
  viewMode: "documents" | "code";
  searchQuery: string;
  onSearchChange: (query: string) => void;
  items: DocumentChunk[] | CodeExample[];
  selectedItemId: string | null;
  onItemSelect: (item: DocumentChunk | CodeExample) => void;
  isLoading: boolean;
  hasNextPage: boolean;
  onLoadMore: () => void;
  isFetchingNextPage: boolean;
}

export const InspectorSidebar: React.FC<InspectorSidebarProps> = ({
  viewMode,
  searchQuery,
  onSearchChange,
  items,
  selectedItemId,
  onItemSelect,
  isLoading,
  hasNextPage,
  onLoadMore,
  isFetchingNextPage,
}) => {
  const getItemTitle = (item: DocumentChunk | CodeExample) => {
    const idSuffix = String(item.id).slice(-6);
    if (viewMode === "documents") {
      const doc = item as DocumentChunk;
      return doc.title || doc.metadata?.title || doc.metadata?.section || `Document ${idSuffix}`;
    }
    const code = item as CodeExample;
    return (
      code.title || code.example_name || code.file_path?.split("/").pop() || code.summary || `Code Example ${idSuffix}`
    );
  };

  const getItemDescription = (item: DocumentChunk | CodeExample) => {
    if (viewMode === "documents") {
      const doc = item as DocumentChunk;
      const preview = doc.content ? `${doc.content.substring(0, 100)}...` : "No preview available";
      return doc.section || doc.metadata?.section || preview;
    }
    const code = item as CodeExample;
    const isSummaryPending =
      code.metadata?.summary_pending ||
      code.metadata?.summary_status === "pending" ||
      code.summary === "Summary pending";
    if (isSummaryPending) return "Summarizing code example...";
    return code.summary || (code.language ? `${code.language} code snippet` : "Code snippet");
  };

  return (
    <aside className="w-80 border-r bg-background" aria-label="Document and code browser">
      <div className="border-b p-4">
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder={`Search ${viewMode}...`}
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            className="pl-9"
            aria-label={`Search ${viewMode}`}
          />
        </div>
      </div>

      <ScrollArea className="h-[calc(80vh-120px)]">
        {isLoading ? (
          <div className="p-4 text-center text-muted-foreground" aria-live="polite">
            <Loader2 className="mx-auto mb-2 h-5 w-5 animate-spin" aria-hidden="true" />
            <span>Loading {viewMode}...</span>
          </div>
        ) : items.length === 0 ? (
          <div className="p-4 text-center text-muted-foreground">
            No {viewMode} found
            {searchQuery && <p className="mt-1 text-xs">Try adjusting your search</p>}
          </div>
        ) : (
          <div className="p-2">
            {items.map((item) => (
              <button
                type="button"
                key={item.id}
                onClick={() => onItemSelect(item)}
                className={cn(
                  "w-full rounded-md px-3 py-2 text-left text-sm transition-colors",
                  "hover:bg-accent/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                  selectedItemId === item.id ? "bg-accent" : "bg-transparent",
                )}
                role="option"
                aria-selected={selectedItemId === item.id}
                aria-label={`${getItemTitle(item)}. ${getItemDescription(item)}`}
              >
                <div className="flex items-start gap-3">
                  <div className="mt-0.5 flex-shrink-0" aria-hidden="true">
                    {viewMode === "documents" ? (
                      <FileText className="h-4 w-4 text-muted-foreground" />
                    ) : (
                      <Code className="h-4 w-4 text-muted-foreground" />
                    )}
                  </div>

                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="flex-1 truncate font-medium">{getItemTitle(item)}</span>
                      {viewMode === "code" && (item as CodeExample).language && (
                        <span className="rounded bg-muted px-1.5 py-0.5 text-[10px] uppercase">
                          {(item as CodeExample).language}
                        </span>
                      )}
                    </div>
                    <p className="line-clamp-2 text-xs text-muted-foreground">{getItemDescription(item)}</p>
                    {item.metadata?.relevance_score != null && (
                      <div className="mt-1 flex items-center gap-1 text-[10px] text-muted-foreground">
                        <Hash className="h-3 w-3" aria-hidden="true" />
                        {(item.metadata.relevance_score * 100).toFixed(0)}%
                      </div>
                    )}
                  </div>
                </div>
              </button>
            ))}

            {hasNextPage && !isLoading && (
              <div className="p-3">
                <Button variant="outline" size="sm" onClick={onLoadMore} disabled={isFetchingNextPage} className="w-full">
                  {isFetchingNextPage ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden="true" />
                      Loading...
                    </>
                  ) : (
                    <>Load more {viewMode}</>
                  )}
                </Button>
              </div>
            )}
          </div>
        )}
      </ScrollArea>
    </aside>
  );
};
