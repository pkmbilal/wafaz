"use client";

import { useState } from "react";
import Link from "next/link";
import { useAction } from "@/components/admin/use-action";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import type { ActionResult } from "@/lib/admin-actions";

// A checkbox list saved as one set (product tags, product collections).
export function ChecklistEditor({
  legend,
  options,
  selected,
  onSave,
  emptyText,
  manageHref,
}: {
  legend: string;
  options: { id: string; label: string }[];
  selected: string[];
  onSave: (ids: string[]) => Promise<ActionResult>;
  emptyText: string;
  manageHref: string;
}) {
  const [initial] = useState(() => [...selected].sort());
  const [ids, setIds] = useState<string[]>(selected);
  const { pending, run } = useAction();
  const dirty = JSON.stringify([...ids].sort()) !== JSON.stringify(initial);

  return (
    <fieldset className="flex flex-col gap-3">
      <legend className="sr-only">{legend}</legend>
      {options.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          {emptyText}{" "}
          <Link href={manageHref} className="text-primary underline-offset-4 hover:underline">
            Add some
          </Link>
          .
        </p>
      ) : (
        <div className="grid grid-cols-2 gap-x-4 sm:grid-cols-3">
          {options.map((o) => (
            <label key={o.id} className="flex min-h-touch items-center gap-2 text-sm">
              <Checkbox
                checked={ids.includes(o.id)}
                onCheckedChange={(on) => setIds((cur) => (on === true ? [...cur, o.id] : cur.filter((x) => x !== o.id)))}
              />
              {o.label}
            </label>
          ))}
        </div>
      )}
      <div className="flex justify-end">
        <Button type="button" variant="outline" disabled={pending || !dirty} onClick={() => run(() => onSave(ids))}>
          {pending ? "Saving…" : "Save"}
        </Button>
      </div>
    </fieldset>
  );
}
