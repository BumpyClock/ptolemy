import { BookOpen, Grid, List, Plus, Search } from "lucide-react";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Kbd } from "@/components/ui/Kbd";
import { Label } from "@/components/ui/Label";
import { NativeSelect } from "@/components/ui/NativeSelect";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/ToggleGroup";

interface KnowledgeHeaderProps {
  totalItems: number;
  isLoading: boolean;
  searchQuery: string;
  onSearchChange: (query: string) => void;
  typeFilter: "all" | "technical" | "business";
  onTypeFilterChange: (type: "all" | "technical" | "business") => void;
  viewMode: "grid" | "table";
  onViewModeChange: (mode: "grid" | "table") => void;
  onAddKnowledge: () => void;
}

export const KnowledgeHeader: React.FC<KnowledgeHeaderProps> = ({
  totalItems,
  isLoading,
  searchQuery,
  onSearchChange,
  typeFilter,
  onTypeFilterChange,
  viewMode,
  onViewModeChange,
  onAddKnowledge,
}) => {
  return (
    <div className="flex flex-col gap-4 pb-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <BookOpen className="h-6 w-6 text-muted-foreground" />
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-semibold">Knowledge Base</h1>
            <Badge variant="secondary">{isLoading ? "Loading..." : `${totalItems} items`}</Badge>
          </div>
        </div>
        <Button onClick={onAddKnowledge} className="gap-2">
          <Plus className="h-4 w-4" />
          Add knowledge
        </Button>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <div className="relative w-full sm:w-[320px]">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            type="search"
            placeholder="Search knowledge..."
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            className="pl-9 pr-12"
          />
          <div className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2">
            <Kbd>/</Kbd>
          </div>
        </div>

        <div className="w-full sm:w-[200px]">
          <Label htmlFor="knowledge-type" className="sr-only">
            Knowledge type
          </Label>
          <NativeSelect
            id="knowledge-type"
            value={typeFilter}
            onChange={(e) => onTypeFilterChange(e.target.value as "all" | "technical" | "business")}
          >
            <option value="all">All types</option>
            <option value="technical">Technical</option>
            <option value="business">Business</option>
          </NativeSelect>
        </div>

        <ToggleGroup
          type="single"
          value={viewMode}
          onValueChange={(value) => value && onViewModeChange(value as "grid" | "table")}
          aria-label="View mode"
        >
          <ToggleGroupItem value="grid" aria-label="Grid view">
            <Grid className="h-4 w-4" />
          </ToggleGroupItem>
          <ToggleGroupItem value="table" aria-label="Table view">
            <List className="h-4 w-4" />
          </ToggleGroupItem>
        </ToggleGroup>
      </div>
    </div>
  );
};
