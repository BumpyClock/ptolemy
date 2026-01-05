import { Briefcase, Terminal } from "lucide-react";
import { useState } from "react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/Select";
import { useUpdateKnowledgeItem } from "../hooks";

interface KnowledgeCardTypeProps {
  sourceId: string;
  knowledgeType: "technical" | "business";
}

export const KnowledgeCardType: React.FC<KnowledgeCardTypeProps> = ({ sourceId, knowledgeType }) => {
  const [value, setValue] = useState<"technical" | "business">(knowledgeType);
  const updateMutation = useUpdateKnowledgeItem();

  const handleTypeChange = async (newType: "technical" | "business") => {
    if (newType === value) return;
    setValue(newType);
    try {
      await updateMutation.mutateAsync({
        sourceId,
        updates: { knowledge_type: newType },
      });
    } catch (_error) {
      setValue(knowledgeType);
    }
  };

  return (
    <Select
      value={value}
      onValueChange={(next) => handleTypeChange(next as "technical" | "business")}
      disabled={updateMutation.isPending}
    >
      <SelectTrigger className="h-7 w-[140px] text-xs">
        <SelectValue>
          <div className="flex items-center gap-2">
            {value === "technical" ? <Terminal className="h-3.5 w-3.5" /> : <Briefcase className="h-3.5 w-3.5" />}
            <span className="capitalize">{value}</span>
          </div>
        </SelectValue>
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="technical">
          <div className="flex items-center gap-2">
            <Terminal className="h-3.5 w-3.5" />
            Technical
          </div>
        </SelectItem>
        <SelectItem value="business">
          <div className="flex items-center gap-2">
            <Briefcase className="h-3.5 w-3.5" />
            Business
          </div>
        </SelectItem>
      </SelectContent>
    </Select>
  );
};
