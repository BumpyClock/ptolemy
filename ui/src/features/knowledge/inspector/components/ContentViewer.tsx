import { Check, Code, Copy, FileText, Layers, Loader2 } from "lucide-react";
import Prism from "prismjs";
import ReactMarkdown from "react-markdown";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { ScrollArea } from "@/components/ui/ScrollArea";
import type { CodeExampleMetadata, DocumentChunkMetadata, InspectorSelectedItem } from "../../types";

import "prismjs/themes/prism-tomorrow.css";
import "prismjs/components/prism-javascript";
import "prismjs/components/prism-typescript";
import "prismjs/components/prism-python";
import "prismjs/components/prism-java";
import "prismjs/components/prism-bash";
import "prismjs/components/prism-json";

interface ContentViewerProps {
  selectedItem: InspectorSelectedItem | null;
  onCopy: (text: string, id: string) => void;
  copiedId: string | null;
}

export const ContentViewer: React.FC<ContentViewerProps> = ({ selectedItem, onCopy, copiedId }) => {
  if (!selectedItem) {
    return (
      <div className="flex-1 flex items-center justify-center text-muted-foreground">
        <div className="text-center">
          <Layers className="mx-auto mb-3 h-12 w-12 opacity-50" />
          <p className="text-sm">Select an item to view</p>
        </div>
      </div>
    );
  }

  const highlightCode = (code: string, language?: string): string => {
    try {
      const escaped = code.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
      const lang = language?.toLowerCase() || "javascript";
      const grammar = Prism.languages[lang] || Prism.languages.javascript;
      return Prism.highlight(escaped, grammar, lang);
    } catch (error) {
      console.error("Prism highlighting failed:", error);
      return code.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
    }
  };

  const stripOuterBackticks = (content: string) => {
    let cleaned = content.trim();
    if (cleaned.startsWith("```")) {
      const firstNewline = cleaned.indexOf("\n");
      if (firstNewline > 0) cleaned = cleaned.substring(firstNewline + 1);
    }
    if (cleaned.endsWith("```")) {
      const lastBackticks = cleaned.lastIndexOf("\n```");
      cleaned = lastBackticks > 0 ? cleaned.substring(0, lastBackticks) : cleaned.substring(0, cleaned.length - 3);
    }
    return cleaned.trim();
  };

  const documentMetadata = selectedItem.type === "document" ? (selectedItem.metadata as DocumentChunkMetadata | undefined) : undefined;
  const codeMetadata = selectedItem.type === "code" ? (selectedItem.metadata as CodeExampleMetadata | undefined) : undefined;
  const isSummaryPending =
    codeMetadata?.summary_pending || codeMetadata?.summary_status === "pending" || codeMetadata?.summary === "Summary pending";

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center gap-3 border-b px-4 py-3">
        <div className="flex min-w-0 flex-1 items-center gap-3">
          {selectedItem.type === "document" ? (
            <FileText className="h-5 w-5 text-muted-foreground" />
          ) : (
            <Code className="h-5 w-5 text-muted-foreground" />
          )}

          <div className="min-w-0 flex-1">
            {selectedItem.type === "document" ? (
              <>
                <h4 className="truncate text-sm font-medium">
                  {documentMetadata?.title || "Document"}
                </h4>
                {documentMetadata?.section && <p className="truncate text-xs text-muted-foreground">{documentMetadata.section}</p>}
              </>
            ) : (
              <>
                <div className="flex min-w-0 items-center gap-2">
                  <Badge variant="outline" className="text-xs font-mono">
                    {codeMetadata?.language || "unknown"}
                  </Badge>
                  {codeMetadata?.file_path && (
                    <span className="truncate text-xs text-muted-foreground">{codeMetadata.file_path}</span>
                  )}
                </div>
                {selectedItem.type === "code" && isSummaryPending && (
                  <p className="mt-1 flex items-center gap-1 text-xs text-muted-foreground">
                    <Loader2 className="h-3 w-3 animate-spin" />
                    Summarizing code example...
                  </p>
                )}
                {selectedItem.type === "code" && !isSummaryPending && codeMetadata?.summary && (
                  <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">{codeMetadata.summary}</p>
                )}
              </>
            )}
          </div>
        </div>

        <Button variant="ghost" size="sm" onClick={() => onCopy(selectedItem.content, selectedItem.id)}>
          {copiedId === selectedItem.id ? (
            <>
              <Check className="mr-1.5 h-4 w-4 text-foreground" />
              Copied
            </>
          ) : (
            <>
              <Copy className="mr-1.5 h-4 w-4" />
              Copy
            </>
          )}
        </Button>
      </div>

      <ScrollArea className="flex-1 px-6 py-4">
        {selectedItem.type === "document" ? (
          <ReactMarkdown
            components={{
              p: ({ children }) => <p className="mb-4 text-sm leading-relaxed">{children}</p>,
              h1: ({ children }) => <h1 className="mb-3 mt-6 text-lg font-semibold">{children}</h1>,
              h2: ({ children }) => <h2 className="mb-3 mt-5 text-base font-semibold">{children}</h2>,
              h3: ({ children }) => <h3 className="mb-2 mt-4 text-sm font-semibold">{children}</h3>,
              ul: ({ children }) => <ul className="mb-4 list-disc space-y-1 pl-5 text-sm">{children}</ul>,
              ol: ({ children }) => <ol className="mb-4 list-decimal space-y-1 pl-5 text-sm">{children}</ol>,
              li: ({ children }) => <li className="leading-relaxed">{children}</li>,
              code: ({ children }) => (
                <code className="rounded bg-muted px-1.5 py-0.5 text-xs">{children}</code>
              ),
            }}
          >
            {stripOuterBackticks(selectedItem.content || "No content available")}
          </ReactMarkdown>
        ) : (
          (() => {
            const language = codeMetadata?.language || "javascript";
            return (
              <pre className="rounded-lg border bg-muted/30 p-4 text-sm">
                <code
                  className={`language-${language} font-mono`}
                  dangerouslySetInnerHTML={{
                    __html: highlightCode(selectedItem.content || "// No code content available", language),
                  }}
                />
              </pre>
            );
          })()
        )}
      </ScrollArea>

      <div className="border-t px-4 py-3 text-xs text-muted-foreground">
        {(documentMetadata?.relevance_score ?? codeMetadata?.relevance_score) != null && (
          <span>
            Relevance: {((documentMetadata?.relevance_score ?? codeMetadata?.relevance_score ?? 0) * 100).toFixed(0)}%
          </span>
        )}
      </div>
    </div>
  );
};
