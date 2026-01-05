import { Globe, Loader2, Plus, Upload } from "lucide-react";
import { useId, useState } from "react";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/Dialog";
import { Input } from "@/components/ui/Input";
import { Label } from "@/components/ui/Label";
import { NativeSelect } from "@/components/ui/NativeSelect";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/Select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/Tabs";
import { useToast } from "@/features/shared/hooks/useToast";
import { useCrawlUrl, useUploadDocument } from "../hooks";
import type { CrawlRequest, UploadMetadata } from "../types";

interface AddKnowledgeDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
  onCrawlStarted?: (progressId: string) => void;
}

export const AddKnowledgeDialog: React.FC<AddKnowledgeDialogProps> = ({
  open,
  onOpenChange,
  onSuccess,
  onCrawlStarted,
}) => {
  const [activeTab, setActiveTab] = useState<"crawl" | "upload">("crawl");
  const { showToast } = useToast();
  const crawlMutation = useCrawlUrl();
  const uploadMutation = useUploadDocument();

  const urlId = useId();
  const fileId = useId();

  const [crawlUrl, setCrawlUrl] = useState("");
  const [crawlType, setCrawlType] = useState<"technical" | "business">("technical");
  const [maxDepth, setMaxDepth] = useState("2");
  const [crawlTags, setCrawlTags] = useState<string[]>([]);
  const [crawlTagInput, setCrawlTagInput] = useState("");

  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [uploadType, setUploadType] = useState<"technical" | "business">("technical");
  const [uploadTags, setUploadTags] = useState<string[]>([]);
  const [uploadTagInput, setUploadTagInput] = useState("");

  const resetForm = () => {
    setCrawlUrl("");
    setCrawlType("technical");
    setMaxDepth("2");
    setCrawlTags([]);
    setCrawlTagInput("");
    setSelectedFile(null);
    setUploadType("technical");
    setUploadTags([]);
    setUploadTagInput("");
  };

  const handleCrawl = async () => {
    if (!crawlUrl) {
      showToast("Please enter a URL to crawl", "error");
      return;
    }

    try {
      const request: CrawlRequest = {
        url: crawlUrl,
        knowledge_type: crawlType,
        max_depth: parseInt(maxDepth, 10),
        tags: crawlTags.length > 0 ? crawlTags : undefined,
      };

      const response = await crawlMutation.mutateAsync(request);
      if (response?.progressId && onCrawlStarted) {
        onCrawlStarted(response.progressId);
      }

      showToast("Crawl started successfully", "success");
      resetForm();
      onSuccess();
      onOpenChange(false);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to start crawl";
      showToast(message, "error");
    }
  };

  const handleUpload = async () => {
    if (!selectedFile) {
      showToast("Please select a file to upload", "error");
      return;
    }

    try {
      const metadata: UploadMetadata = {
        knowledge_type: uploadType,
        tags: uploadTags.length > 0 ? uploadTags : undefined,
      };

      const response = await uploadMutation.mutateAsync({ file: selectedFile, metadata });
      if (response?.progressId && onCrawlStarted) {
        onCrawlStarted(response.progressId);
      }

      showToast(`Upload started for ${selectedFile.name}. Processing in background...`, "info");
      resetForm();
      onOpenChange(false);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to upload document";
      showToast(message, "error");
    }
  };

  const isProcessing = crawlMutation.isPending || uploadMutation.isPending;

  const addTag = (value: string, tags: string[], setTags: (next: string[]) => void, setInput: (value: string) => void) => {
    const trimmed = value.trim();
    if (!trimmed) return;
    if (!tags.includes(trimmed)) {
      setTags([...tags, trimmed]);
    }
    setInput("");
  };

  const removeTag = (tag: string, tags: string[], setTags: (next: string[]) => void) => {
    setTags(tags.filter((t) => t !== tag));
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[640px]">
        <DialogHeader>
          <DialogTitle>Add knowledge</DialogTitle>
          <DialogDescription>Crawl websites or upload documents to expand your knowledge base.</DialogDescription>
        </DialogHeader>

        <Tabs value={activeTab} onValueChange={(value) => setActiveTab(value as "crawl" | "upload")}>
          <TabsList>
            <TabsTrigger value="crawl" className="gap-2">
              <Globe className="h-4 w-4" />
              Crawl
            </TabsTrigger>
            <TabsTrigger value="upload" className="gap-2">
              <Upload className="h-4 w-4" />
              Upload
            </TabsTrigger>
          </TabsList>

          <TabsContent value="crawl" className="space-y-5">
            <div className="space-y-2">
              <Label htmlFor={urlId}>Website URL</Label>
              <Input
                id={urlId}
                type="url"
                placeholder="https://docs.example.com"
                value={crawlUrl}
                onChange={(e) => setCrawlUrl(e.target.value)}
                disabled={isProcessing}
              />
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label>Knowledge type</Label>
                <Select value={crawlType} onValueChange={(value) => setCrawlType(value as "technical" | "business")}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select type" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="technical">Technical</SelectItem>
                    <SelectItem value="business">Business</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Max depth</Label>
                <NativeSelect value={maxDepth} onChange={(e) => setMaxDepth(e.target.value)}>
                  <option value="1">1</option>
                  <option value="2">2</option>
                  <option value="3">3</option>
                  <option value="4">4</option>
                </NativeSelect>
              </div>
            </div>

            <div className="space-y-2">
              <Label>Tags</Label>
              <div className="flex flex-wrap items-center gap-2">
                {crawlTags.map((tag) => (
                  <Badge key={tag} variant="outline" className="gap-1 text-xs">
                    {tag}
                    <button type="button" onClick={() => removeTag(tag, crawlTags, setCrawlTags)}>
                      x
                    </button>
                  </Badge>
                ))}
              </div>
              <div className="flex gap-2">
                <Input
                  value={crawlTagInput}
                  onChange={(e) => setCrawlTagInput(e.target.value)}
                  placeholder="Add tag"
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      addTag(crawlTagInput, crawlTags, setCrawlTags, setCrawlTagInput);
                    }
                  }}
                />
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => addTag(crawlTagInput, crawlTags, setCrawlTags, setCrawlTagInput)}
                >
                  <Plus className="h-4 w-4" />
                </Button>
              </div>
            </div>

            <Button onClick={handleCrawl} disabled={isProcessing || !crawlUrl}>
              {crawlMutation.isPending ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Starting crawl...
                </>
              ) : (
                <>
                  <Globe className="mr-2 h-4 w-4" />
                  Start crawl
                </>
              )}
            </Button>
          </TabsContent>

          <TabsContent value="upload" className="space-y-5">
            <div className="space-y-2">
              <Label htmlFor={fileId}>Document file</Label>
              <Input
                id={fileId}
                type="file"
                accept=".txt,.md,.pdf,.doc,.docx,.html,.htm"
                onChange={(e) => setSelectedFile(e.target.files?.[0] || null)}
                disabled={isProcessing}
              />
            </div>

            <div className="space-y-2">
              <Label>Knowledge type</Label>
              <Select value={uploadType} onValueChange={(value) => setUploadType(value as "technical" | "business")}>
                <SelectTrigger>
                  <SelectValue placeholder="Select type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="technical">Technical</SelectItem>
                  <SelectItem value="business">Business</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Tags</Label>
              <div className="flex flex-wrap items-center gap-2">
                {uploadTags.map((tag) => (
                  <Badge key={tag} variant="outline" className="gap-1 text-xs">
                    {tag}
                    <button type="button" onClick={() => removeTag(tag, uploadTags, setUploadTags)}>
                      x
                    </button>
                  </Badge>
                ))}
              </div>
              <div className="flex gap-2">
                <Input
                  value={uploadTagInput}
                  onChange={(e) => setUploadTagInput(e.target.value)}
                  placeholder="Add tag"
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      addTag(uploadTagInput, uploadTags, setUploadTags, setUploadTagInput);
                    }
                  }}
                />
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => addTag(uploadTagInput, uploadTags, setUploadTags, setUploadTagInput)}
                >
                  <Plus className="h-4 w-4" />
                </Button>
              </div>
            </div>

            <Button onClick={handleUpload} disabled={isProcessing || !selectedFile}>
              {uploadMutation.isPending ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Uploading...
                </>
              ) : (
                <>
                  <Upload className="mr-2 h-4 w-4" />
                  Upload document
                </>
              )}
            </Button>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
};
