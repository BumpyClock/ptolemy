import { format } from "date-fns";
import { Clock, Code, ExternalLink, FileText, Globe } from "lucide-react";
import { useState } from "react";
import { Card, CardContent, CardFooter, CardHeader } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { cn } from "@/lib/utils";
import { isOptimistic } from "@/features/shared/utils/optimistic";
import { KnowledgeCardProgress } from "../../progress/components/KnowledgeCardProgress";
import type { ActiveOperation } from "../../progress/types";
import { useDeleteKnowledgeItem, useRefreshKnowledgeItem } from "../hooks";
import type { KnowledgeItem } from "../types";
import { extractDomain } from "../utils/knowledge-utils";
import { KnowledgeCardActions } from "./KnowledgeCardActions";
import { KnowledgeCardTags } from "./KnowledgeCardTags";
import { KnowledgeCardTitle } from "./KnowledgeCardTitle";
import { KnowledgeCardType } from "./KnowledgeCardType";

interface KnowledgeCardProps {
  item: KnowledgeItem;
  onViewDocument: () => void;
  onViewCodeExamples?: () => void;
  onExport?: () => void;
  onDeleteSuccess: () => void;
  activeOperation?: ActiveOperation;
  onRefreshStarted?: (progressId: string) => void;
}

export const KnowledgeCard: React.FC<KnowledgeCardProps> = ({
  item,
  onViewDocument,
  onViewCodeExamples,
  onExport,
  onDeleteSuccess,
  activeOperation,
  onRefreshStarted,
}) => {
  const [isHovered, setIsHovered] = useState(false);
  const deleteMutation = useDeleteKnowledgeItem();
  const refreshMutation = useRefreshKnowledgeItem();

  const optimistic = isOptimistic(item);
  const sourceType = item.source_type || item.metadata?.source_type;
  const isUrl = sourceType === "url" && !item.url?.startsWith("file://");
  const codeExamplesCount = item.code_examples_count || item.metadata?.code_examples_count || 0;
  const documentCount = item.document_count || item.metadata?.document_count || 0;

  const handleDelete = async () => {
    await deleteMutation.mutateAsync(item.source_id);
    onDeleteSuccess();
  };

  const handleRefresh = async () => {
    if (refreshMutation.isPending) return;
    const response = await refreshMutation.mutateAsync(item.source_id);
    if (response?.progressId && onRefreshStarted) {
      onRefreshStarted(response.progressId);
    }
  };

  return (
    <div
      className={cn("relative", optimistic && "opacity-80")}
      role="button"
      tabIndex={0}
      onClick={onViewDocument}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onViewDocument();
        }
      }}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      <Card className={cn("h-full transition-shadow", isHovered && "shadow-md")}>
        <CardHeader className="space-y-3 p-4">
          <div className="flex items-start justify-between gap-2">
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant="outline" className="gap-1">
                <span className="inline-flex h-4 w-4 items-center justify-center">
                  {isUrl ? <Globe className="h-3.5 w-3.5" /> : <FileText className="h-3.5 w-3.5" />}
                </span>
                {isUrl ? "Web" : "Document"}
              </Badge>
              <KnowledgeCardType sourceId={item.source_id} knowledgeType={item.knowledge_type} />
            </div>
            <div
              onClick={(e) => e.stopPropagation()}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") e.stopPropagation();
              }}
              role="none"
            >
              <KnowledgeCardActions
                sourceId={item.source_id}
                itemTitle={item.title}
                isUrl={isUrl}
                hasCodeExamples={codeExamplesCount > 0}
                onViewDocuments={onViewDocument}
                onViewCodeExamples={codeExamplesCount > 0 ? onViewCodeExamples : undefined}
                onRefresh={isUrl ? handleRefresh : undefined}
                onDelete={handleDelete}
                onExport={onExport}
              />
            </div>
          </div>

          <div className="space-y-2">
            <KnowledgeCardTitle sourceId={item.source_id} title={item.title} description={item.metadata?.description} />
            {item.url &&
              (isUrl ? (
                <a
                  href={item.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={(e) => e.stopPropagation()}
                  className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
                >
                  <ExternalLink className="h-3 w-3" />
                  <span className="truncate">{extractDomain(item.url)}</span>
                </a>
              ) : (
                <div className="inline-flex items-center gap-1 text-xs text-muted-foreground">
                  <FileText className="h-3 w-3" />
                  <span className="truncate">{item.url.replace("file://", "")}</span>
                </div>
              ))}
          </div>

          <div
            onClick={(e) => e.stopPropagation()}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") e.stopPropagation();
            }}
            role="none"
          >
            <KnowledgeCardTags sourceId={item.source_id} tags={item.metadata?.tags || []} />
          </div>
        </CardHeader>

        <CardContent className="space-y-3 px-4 pb-4">
          {activeOperation && <KnowledgeCardProgress operation={activeOperation} />}
        </CardContent>

        <CardFooter className="flex items-center justify-between px-4 pb-4 text-xs text-muted-foreground">
          <div className="flex items-center gap-1">
            <Clock className="h-3 w-3" />
            <span>
              {(() => {
                const updated = item.updated_at || item.created_at;
                try {
                  return `Updated ${format(new Date(updated), "M/d/yyyy")}`;
                } catch {
                  return "Updated recently";
                }
              })()}
            </span>
          </div>
          <div className="flex items-center gap-3">
            <span className="inline-flex items-center gap-1">
              <FileText className="h-3 w-3" />
              {documentCount}
            </span>
            <span className="inline-flex items-center gap-1">
              <Code className="h-3 w-3" />
              {codeExamplesCount}
            </span>
          </div>
        </CardFooter>
      </Card>
    </div>
  );
};
