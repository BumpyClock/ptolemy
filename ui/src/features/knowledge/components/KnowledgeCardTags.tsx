import { Plus, Tag, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { useUpdateKnowledgeItem } from "../hooks";

interface KnowledgeCardTagsProps {
  sourceId: string;
  tags: string[];
}

export const KnowledgeCardTags: React.FC<KnowledgeCardTagsProps> = ({ sourceId, tags }) => {
  const [isEditing, setIsEditing] = useState(false);
  const [editingTags, setEditingTags] = useState<string[]>(tags);
  const [newTagValue, setNewTagValue] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  const updateMutation = useUpdateKnowledgeItem();

  useEffect(() => {
    if (!isEditing) setEditingTags(tags);
  }, [tags, isEditing]);

  useEffect(() => {
    if (isEditing && inputRef.current) inputRef.current.focus();
  }, [isEditing]);

  const handleAddTag = () => {
    const trimmed = newTagValue.trim();
    if (!trimmed) return;
    if (!editingTags.includes(trimmed)) {
      setEditingTags([...editingTags, trimmed]);
    }
    setNewTagValue("");
  };

  const handleRemoveTag = (tagToRemove: string) => {
    setEditingTags(editingTags.filter((tag) => tag !== tagToRemove));
  };

  const handleSave = async () => {
    try {
      await updateMutation.mutateAsync({
        sourceId,
        updates: { tags: editingTags.filter((tag) => tag.trim().length > 0) },
      });
      setIsEditing(false);
    } catch (_error) {
      setEditingTags(tags);
      setIsEditing(false);
    }
  };

  const handleCancel = () => {
    setEditingTags(tags);
    setNewTagValue("");
    setIsEditing(false);
  };

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center gap-2">
        {(isEditing ? editingTags : tags).map((tag) => (
          <Badge key={tag} variant="outline" className="gap-1 text-[11px]">
            <Tag className="h-3 w-3" />
            {tag}
            {isEditing && (
              <button
                type="button"
                className="ml-1 text-muted-foreground hover:text-foreground"
                onClick={(e) => {
                  e.stopPropagation();
                  handleRemoveTag(tag);
                }}
              >
                <X className="h-3 w-3" />
              </button>
            )}
          </Badge>
        ))}
        {!tags.length && !isEditing && (
          <span className="text-xs text-muted-foreground">No tags</span>
        )}
      </div>

      {isEditing ? (
        <div className="flex flex-wrap items-center gap-2">
          <Input
            ref={inputRef}
            value={newTagValue}
            onChange={(e) => setNewTagValue(e.target.value)}
            placeholder="Add tag"
            className="h-8 w-40"
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                handleAddTag();
              }
            }}
          />
          <Button type="button" variant="outline" size="sm" onClick={handleAddTag}>
            <Plus className="h-3.5 w-3.5" />
          </Button>
          <Button type="button" size="sm" onClick={handleSave} disabled={updateMutation.isPending}>
            Save
          </Button>
          <Button type="button" variant="ghost" size="sm" onClick={handleCancel}>
            Cancel
          </Button>
        </div>
      ) : (
        <Button type="button" variant="ghost" size="sm" onClick={() => setIsEditing(true)}>
          Edit tags
        </Button>
      )}
    </div>
  );
};
