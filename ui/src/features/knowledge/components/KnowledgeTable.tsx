import { formatDistanceToNowStrict } from "date-fns";
import { Code, ExternalLink, Eye, FileText, MoreHorizontal, Trash2 } from "lucide-react";
import { useState } from "react";
import { useToast } from "@/features/shared/hooks/useToast";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/DropdownMenu";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/Table";
import { useDeleteKnowledgeItem } from "../hooks";
import type { KnowledgeItem } from "../types";

interface KnowledgeTableProps {
  items: KnowledgeItem[];
  onViewDocument: (sourceId: string) => void;
  onDeleteSuccess: () => void;
}

export const KnowledgeTable: React.FC<KnowledgeTableProps> = ({ items, onViewDocument, onDeleteSuccess }) => {
  const [deletingIds, setDeletingIds] = useState<Set<string>>(new Set());
  const { showToast } = useToast();
  const deleteMutation = useDeleteKnowledgeItem();

  const handleDelete = async (item: KnowledgeItem) => {
    if (!confirm(`Delete "${item.title}"? This action cannot be undone.`)) return;

    setDeletingIds((prev) => new Set(prev).add(item.source_id));
    try {
      await deleteMutation.mutateAsync(item.source_id);
      showToast("Knowledge item deleted successfully", "success");
      onDeleteSuccess();
    } catch (_error) {
      showToast("Failed to delete knowledge item", "error");
    } finally {
      setDeletingIds((prev) => {
        const next = new Set(prev);
        next.delete(item.source_id);
        return next;
      });
    }
  };

  const getHostname = (url: string): string => {
    try {
      return new URL(url).hostname;
    } catch {
      return url;
    }
  };

  const isSafeProtocol = (url: string): boolean => {
    try {
      const protocol = new URL(url).protocol;
      return protocol === "http:" || protocol === "https:";
    } catch {
      return false;
    }
  };

  const formatCreatedDate = (dateString: string): string => {
    try {
      const date = new Date(dateString);
      if (Number.isNaN(date.getTime())) return "N/A";
      return formatDistanceToNowStrict(date, { addSuffix: true });
    } catch {
      return "N/A";
    }
  };

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Title</TableHead>
          <TableHead>Type</TableHead>
          <TableHead>Source</TableHead>
          <TableHead>Docs</TableHead>
          <TableHead>Examples</TableHead>
          <TableHead>Created</TableHead>
          <TableHead className="text-right">Actions</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {items.map((item) => {
          const isDeleting = deletingIds.has(item.source_id);
          const type = item.metadata?.knowledge_type || "general";
          return (
            <TableRow key={item.source_id} className={isDeleting ? "opacity-50" : ""}>
              <TableCell className="font-medium">{item.title}</TableCell>
              <TableCell>
                <Badge variant="outline" className="gap-1 text-xs capitalize">
                  {type === "technical" ? <Code className="h-3.5 w-3.5" /> : <FileText className="h-3.5 w-3.5" />}
                  {type}
                </Badge>
              </TableCell>
              <TableCell className="max-w-[220px] truncate">
                {isSafeProtocol(item.url) ? (
                  <a
                    href={item.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
                  >
                    <ExternalLink className="h-3.5 w-3.5" />
                    {getHostname(item.url)}
                  </a>
                ) : (
                  <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
                    <ExternalLink className="h-3.5 w-3.5" />
                    {getHostname(item.url)}
                  </span>
                )}
              </TableCell>
              <TableCell>{item.document_count || item.metadata?.document_count || 0}</TableCell>
              <TableCell>{item.code_examples_count || item.metadata?.code_examples_count || 0}</TableCell>
              <TableCell>{formatCreatedDate(item.created_at)}</TableCell>
              <TableCell className="text-right">
                <div className="flex items-center justify-end gap-2">
                  <Button variant="ghost" size="icon" onClick={() => onViewDocument(item.source_id)}>
                    <Eye className="h-4 w-4" />
                  </Button>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="icon">
                        <MoreHorizontal className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onClick={() => onViewDocument(item.source_id)}>
                        <Eye className="mr-2 h-4 w-4" />
                        View documents
                      </DropdownMenuItem>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem
                        onClick={() => handleDelete(item)}
                        className="text-destructive focus:text-destructive"
                      >
                        <Trash2 className="mr-2 h-4 w-4" />
                        Delete
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              </TableCell>
            </TableRow>
          );
        })}
      </TableBody>
    </Table>
  );
};
