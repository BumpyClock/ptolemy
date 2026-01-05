import React, { useEffect, useMemo, useState } from "react";
import {
  Check,
  ChevronRight,
  Copy,
  FileCode,
  Info,
  Search,
} from "lucide-react";
import Prism from "prismjs";
import "prismjs/components/prism-javascript";
import "prismjs/components/prism-jsx";
import "prismjs/components/prism-typescript";
import "prismjs/components/prism-tsx";
import "prismjs/components/prism-css";
import "prismjs/components/prism-python";
import "prismjs/components/prism-java";
import "prismjs/components/prism-json";
import "prismjs/components/prism-markdown";
import "prismjs/components/prism-yaml";
import "prismjs/components/prism-bash";
import "prismjs/components/prism-sql";
import "prismjs/components/prism-graphql";
import "prismjs/themes/prism-tomorrow.css";
import { Badge } from "../ui/Badge";
import { Button } from "../ui/Button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "../ui/Dialog";
import { Input } from "../ui/Input";
import { ScrollArea } from "../ui/ScrollArea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../ui/Tabs";
import { cn } from "@/lib/utils";
import { copyToClipboard } from "../../features/shared/utils/clipboard";

export interface CodeExample {
  id: string;
  title: string;
  description: string;
  language: string;
  code: string;
  tags?: string[];
}

interface CodeViewerModalProps {
  examples: CodeExample[];
  onClose: () => void;
  isLoading?: boolean;
}

export const CodeViewerModal: React.FC<CodeViewerModalProps> = ({
  examples,
  onClose,
  isLoading = false,
}) => {
  const [activeTab, setActiveTab] = useState<"code" | "metadata">("code");
  const [activeExampleIndex, setActiveExampleIndex] = useState(0);
  const [copied, setCopied] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");

  const filteredExamples = useMemo(() => {
    if (!searchQuery.trim()) return examples;

    const query = searchQuery.toLowerCase();
    return examples.filter((example) => {
      return (
        example.title.toLowerCase().includes(query) ||
        example.description.toLowerCase().includes(query) ||
        example.code.toLowerCase().includes(query) ||
        example.tags?.some((tag) => tag.toLowerCase().includes(query))
      );
    });
  }, [examples, searchQuery]);

  const activeExample = filteredExamples[activeExampleIndex];

  useEffect(() => {
    if (activeExampleIndex >= filteredExamples.length) {
      setActiveExampleIndex(0);
    }
  }, [activeExampleIndex, filteredExamples.length]);

  useEffect(() => {
    if (activeExample) {
      Prism.highlightAll();
    }
  }, [activeExample, activeExampleIndex]);

  useEffect(() => {
    setActiveExampleIndex(0);
  }, [searchQuery]);

  const handleCopyCode = async () => {
    if (!activeExample) return;
    const result = await copyToClipboard(activeExample.code);
    if (result.success) {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } else {
      console.error("Failed to copy to clipboard:", result.error);
    }
  };

  const handleOpenChange = (open: boolean) => {
    if (!open) {
      onClose();
    }
  };

  return (
    <Dialog open onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-6xl p-0">
        <DialogHeader className="px-6 pt-6">
          <DialogTitle>Code examples</DialogTitle>
          <DialogDescription>
            Browse extracted snippets and metadata from your knowledge base.
          </DialogDescription>
        </DialogHeader>

        <div className="border-t">
          <div className="grid md:grid-cols-[280px_1fr]">
            <aside className="border-r p-4">
              <Input
                type="search"
                placeholder="Search examples..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                icon={<Search className="h-4 w-4" />}
              />

              <ScrollArea className="mt-4 h-[60vh] pr-3">
                {filteredExamples.length === 0 ? (
                  <div className="rounded-md border border-dashed p-6 text-center text-sm text-muted-foreground">
                    No examples found.
                  </div>
                ) : (
                  <div className="space-y-2">
                    {filteredExamples.map((example, index) => (
                      <button
                        key={example.id}
                        type="button"
                        onClick={() => setActiveExampleIndex(index)}
                        className={cn(
                          "flex w-full items-start gap-3 rounded-md border p-3 text-left transition",
                          index === activeExampleIndex
                            ? "border-primary/50 bg-accent"
                            : "border-transparent hover:border-border hover:bg-muted/50",
                        )}
                      >
                        <FileCode className="mt-0.5 h-4 w-4 text-muted-foreground" />
                        <div className="flex-1">
                          <div className="text-sm font-medium text-foreground line-clamp-1">
                            {example.title}
                          </div>
                          <div className="mt-1 line-clamp-2 text-xs text-muted-foreground">
                            {example.description}
                          </div>
                          <div className="mt-2 flex items-center gap-2">
                            <Badge variant="outline" className="text-xs text-muted-foreground">
                              {example.language}
                            </Badge>
                            {example.tags && example.tags.length > 0 && (
                              <span className="text-xs text-muted-foreground">
                                +{example.tags.length} tags
                              </span>
                            )}
                          </div>
                        </div>
                        {index === activeExampleIndex && (
                          <ChevronRight className="mt-1 h-4 w-4 text-muted-foreground" />
                        )}
                      </button>
                    ))}
                  </div>
                )}
              </ScrollArea>
            </aside>

            <section className="p-6">
              {isLoading ? (
                <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
                  Loading code examples...
                </div>
              ) : !activeExample ? (
                <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
                  No code example selected.
                </div>
              ) : (
                <>
                  <div className="flex flex-wrap items-start justify-between gap-4">
                    <div>
                      <h2 className="text-xl font-semibold">{activeExample.title}</h2>
                      <p className="mt-1 text-sm text-muted-foreground">
                        {activeExample.description}
                      </p>
                      <div className="mt-3 flex flex-wrap gap-2">
                        <Badge variant="outline" className="text-xs text-muted-foreground">
                          {activeExample.language}
                        </Badge>
                        {activeExample.tags?.map((tag) => (
                          <Badge key={tag} variant="outline" className="text-xs text-muted-foreground">
                            {tag}
                          </Badge>
                        ))}
                      </div>
                    </div>

                    <Button variant="outline" size="sm" onClick={handleCopyCode}>
                      {copied ? (
                        <>
                          <Check className="h-4 w-4" />
                          Copied
                        </>
                      ) : (
                        <>
                          <Copy className="h-4 w-4" />
                          Copy code
                        </>
                      )}
                    </Button>
                  </div>

                  <Tabs value={activeTab} onValueChange={(value) => setActiveTab(value as "code" | "metadata")}>
                    <TabsList className="mt-6">
                      <TabsTrigger value="code">Code</TabsTrigger>
                      <TabsTrigger value="metadata" className="gap-2">
                        <Info className="h-3.5 w-3.5" />
                        Metadata
                      </TabsTrigger>
                    </TabsList>

                    <TabsContent value="code">
                      <ScrollArea className="h-[45vh] rounded-md border bg-muted/40">
                        <pre className="p-4 text-sm">
                          <code className={`language-${activeExample.language || "javascript"}`}>
                            {activeExample.code}
                          </code>
                        </pre>
                      </ScrollArea>
                    </TabsContent>

                    <TabsContent value="metadata">
                      <div className="rounded-md border bg-muted/40 p-4 text-sm">
                        <div className="flex items-center justify-between">
                          <span className="text-muted-foreground">Lines</span>
                          <span className="font-mono">
                            {activeExample.code.split("\n").length}
                          </span>
                        </div>
                        <div className="mt-2 flex items-center justify-between">
                          <span className="text-muted-foreground">Characters</span>
                          <span className="font-mono">{activeExample.code.length}</span>
                        </div>
                        {activeExample.tags && activeExample.tags.length > 0 && (
                          <div className="mt-4">
                            <div className="mb-2 text-xs font-medium text-muted-foreground">
                              Tags
                            </div>
                            <div className="flex flex-wrap gap-2">
                              {activeExample.tags.map((tag) => (
                                <Badge key={tag} variant="outline" className="text-xs text-muted-foreground">
                                  {tag}
                                </Badge>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    </TabsContent>
                  </Tabs>
                </>
              )}
            </section>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};
