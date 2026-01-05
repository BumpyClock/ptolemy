import { Info } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { Input } from "@/components/ui/Input";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/Tooltip";
import { cn } from "@/lib/utils";
import { useUpdateKnowledgeItem } from "../hooks";

interface KnowledgeCardTitleProps {
  sourceId: string;
  title: string;
  description?: string;
}

export const KnowledgeCardTitle: React.FC<KnowledgeCardTitleProps> = ({ sourceId, title, description }) => {
  const [isEditing, setIsEditing] = useState(false);
  const [editValue, setEditValue] = useState(title);
  const inputRef = useRef<HTMLInputElement>(null);
  const updateMutation = useUpdateKnowledgeItem();

  useEffect(() => {
    if (!isEditing) setEditValue(title);
  }, [title, isEditing]);

  useEffect(() => {
    if (isEditing && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [isEditing]);

  const handleSave = async () => {
    const trimmed = editValue.trim();
    if (!trimmed || trimmed === title) {
      setIsEditing(false);
      setEditValue(title);
      return;
    }

    try {
      await updateMutation.mutateAsync({
        sourceId,
        updates: { title: trimmed },
      });
      setIsEditing(false);
    } catch (_error) {
      setEditValue(title);
      setIsEditing(false);
    }
  };

  const handleCancel = () => {
    setEditValue(title);
    setIsEditing(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    e.stopPropagation();
    if (e.key === "Enter") {
      e.preventDefault();
      handleSave();
    } else if (e.key === "Escape") {
      e.preventDefault();
      handleCancel();
    }
  };

  const handleClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!isEditing && !updateMutation.isPending) {
      setIsEditing(true);
    }
  };

  if (isEditing) {
    return (
      <div className="flex items-center gap-2">
        <Input
          ref={inputRef}
          value={editValue}
          onChange={(e) => setEditValue(e.target.value)}
          onBlur={handleSave}
          onKeyDown={handleKeyDown}
          onClick={(e) => e.stopPropagation()}
          disabled={updateMutation.isPending}
          className="h-8"
        />
        {description?.trim() && (
          <Tooltip>
            <TooltipTrigger asChild>
              <Info className="h-4 w-4 text-muted-foreground" />
            </TooltipTrigger>
            <TooltipContent side="top" className="max-w-xs whitespace-pre-wrap text-xs">
              {description}
            </TooltipContent>
          </Tooltip>
        )}
      </div>
    );
  }

  return (
    <div className="flex items-center gap-2">
      <button
        type="button"
        className={cn(
          "text-left text-base font-semibold text-foreground transition-colors hover:text-foreground/80",
          updateMutation.isPending && "opacity-50",
        )}
        onClick={handleClick}
      >
        {title}
      </button>
      {description?.trim() && (
        <Tooltip>
          <TooltipTrigger asChild>
            <Info className="h-4 w-4 text-muted-foreground" />
          </TooltipTrigger>
          <TooltipContent side="top" className="max-w-xs whitespace-pre-wrap text-xs">
            {description}
          </TooltipContent>
        </Tooltip>
      )}
    </div>
  );
};
