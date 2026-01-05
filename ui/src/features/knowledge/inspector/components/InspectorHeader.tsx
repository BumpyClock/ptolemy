import { formatDistanceToNow } from "date-fns";
import { Briefcase, Calendar, FileText, Globe, Terminal } from "lucide-react";
import { Badge } from "@/components/ui/Badge";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/Tabs";
import { cn } from "@/lib/utils";
import type { KnowledgeItem } from "../../types";

interface InspectorHeaderProps {
  item: KnowledgeItem;
  viewMode: "documents" | "code";
  onViewModeChange: (mode: "documents" | "code") => void;
  documentCount: number;
  codeCount: number;
  filteredDocumentCount: number;
  filteredCodeCount: number;
}

export const InspectorHeader: React.FC<InspectorHeaderProps> = ({
  item,
  viewMode,
  onViewModeChange,
  documentCount,
  codeCount,
  filteredDocumentCount,
  filteredCodeCount,
}) => {
  return (
    <div className="space-y-4 border-b px-6 py-4">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="space-y-2">
          <h2 className="text-xl font-semibold">{item.title}</h2>
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="outline" className="gap-1">
              {item.source_type === "url" ? <Globe className="h-3.5 w-3.5" /> : <FileText className="h-3.5 w-3.5" />}
              {item.source_type === "url" ? "Web" : "File"}
            </Badge>
            <Badge variant="outline" className="gap-1">
              {item.knowledge_type === "technical" ? (
                <>
                  <Terminal className="h-3.5 w-3.5" />
                  Technical
                </>
              ) : (
                <>
                  <Briefcase className="h-3.5 w-3.5" />
                  Business
                </>
              )}
            </Badge>
            {item.url && (
              <a
                href={item.url}
                target="_blank"
                rel="noopener noreferrer"
                className="max-w-[320px] truncate text-xs text-muted-foreground hover:text-foreground"
              >
                {item.url}
              </a>
            )}
          </div>
        </div>

        <div className="flex items-center gap-3 text-xs text-muted-foreground">
          <span>
            Showing{" "}
            {viewMode === "documents"
              ? `${filteredDocumentCount} of ${documentCount}`
              : `${filteredCodeCount} of ${codeCount}`}
          </span>
          <span className="flex items-center gap-1">
            <Calendar className="h-3 w-3" />
            {formatDistanceToNow(new Date(item.created_at), { addSuffix: true })}
          </span>
        </div>
      </div>

      <Tabs value={viewMode} onValueChange={(value) => onViewModeChange(value as "documents" | "code")}>
        <TabsList>
          <TabsTrigger value="documents" className={cn("gap-2")}>
            Documents ({documentCount})
          </TabsTrigger>
          <TabsTrigger value="code" className={cn("gap-2")}>
            Code ({codeCount})
          </TabsTrigger>
        </TabsList>
      </Tabs>
    </div>
  );
};
