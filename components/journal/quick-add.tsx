"use client";

import { useRef, useState, useTransition } from "react";
import { Plus } from "lucide-react";
import { toast } from "sonner";

import { addItem } from "@/lib/journal/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

interface QuickAddProps {
  logDate: string;
  status?: "planned" | "done";
  placeholder: string;
  ariaLabel: string;
}

/** Single input, Enter to add, stays focused for rapid entry (mirrors `StreamChecklist`'s add row). */
export function QuickAdd({
  logDate,
  status = "planned",
  placeholder,
  ariaLabel,
}: QuickAddProps) {
  const [value, setValue] = useState("");
  const [pending, startTransition] = useTransition();
  const inputRef = useRef<HTMLInputElement>(null);

  function handleAdd() {
    const title = value.trim();
    if (!title) return;
    startTransition(async () => {
      const result = await addItem(logDate, title, status);
      if (result.error) {
        toast.error(result.error);
        return;
      }
      setValue("");
      inputRef.current?.focus();
    });
  }

  return (
    <div data-slot="journal-quick-add" className="flex items-center gap-2">
      <Input
        ref={inputRef}
        aria-label={ariaLabel}
        placeholder={placeholder}
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            handleAdd();
          }
        }}
      />
      <Button
        type="button"
        variant="outline"
        size="sm"
        disabled={pending || !value.trim()}
        onClick={handleAdd}
      >
        <Plus aria-hidden />
        Add
      </Button>
    </div>
  );
}
