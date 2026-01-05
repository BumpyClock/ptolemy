import { AlertCircle, CheckCircle2, Code, FileText, Link, Loader2 } from "lucide-react";
import { Badge } from "@/components/ui/Badge";
import type { ActiveOperation } from "../types/progress";

interface KnowledgeCardProgressProps {
  operation: ActiveOperation;
}

export const KnowledgeCardProgress: React.FC<KnowledgeCardProgressProps> = ({ operation }) => {
  const progressPercentage = typeof operation.progress === "number" ? Math.round(operation.progress) : 0;
  const isActive = [
    "crawling",
    "processing",
    "in_progress",
    "starting",
    "initializing",
    "analyzing",
    "source_creation",
    "document_storage",
    "code_extraction",
    "summarizing",
  ].includes(operation.status);

  if (!isActive) return null;

  const getStatusIcon = () => {
    switch (operation.status) {
      case "completed":
        return <CheckCircle2 className="h-3 w-3" />;
      case "failed":
      case "error":
        return <AlertCircle className="h-3 w-3" />;
      default:
        return <Loader2 className="h-3 w-3 animate-spin" />;
    }
  };

  const currentStep = operation.message || operation.status.replace(/_/g, " ").replace(/^\w/, (c) => c.toUpperCase());
  const stats = operation.stats || operation.progress_data;

  return (
    <div className="rounded-md border bg-muted/30 p-3">
      <div className="mb-2 flex items-center justify-between text-xs text-muted-foreground">
        <Badge variant="secondary" className="gap-1 text-xs">
          {getStatusIcon()}
          {currentStep}
        </Badge>
        <span>{progressPercentage}%</span>
      </div>
      <div className="h-1.5 w-full rounded-full bg-muted">
        <div className="h-full rounded-full bg-primary" style={{ width: `${progressPercentage}%` }} />
      </div>
      <div className="mt-2 flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
        {(operation.pages_crawled !== undefined || stats?.pages_crawled !== undefined) && (
          <span className="inline-flex items-center gap-1">
            <Link className="h-3 w-3" />
            {operation.pages_crawled || stats?.pages_crawled || 0} pages
          </span>
        )}
        {(operation.documents_created !== undefined ||
          (stats && "documents_created" in stats && stats.documents_created !== undefined)) && (
          <span className="inline-flex items-center gap-1">
            <FileText className="h-3 w-3" />
            {operation.documents_created || (stats && "documents_created" in stats ? stats.documents_created : 0)} docs
          </span>
        )}
        {operation.code_blocks_found !== undefined && (
          <span className="inline-flex items-center gap-1">
            <Code className="h-3 w-3" />
            {operation.code_blocks_found} examples
          </span>
        )}
      </div>
      {operation.status === "error" && operation.message && (
        <div className="mt-2 text-xs text-destructive">{operation.message}</div>
      )}
    </div>
  );
};
