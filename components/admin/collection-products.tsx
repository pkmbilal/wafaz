"use client";

import { useId, useState, useTransition } from "react";
import { ArrowDown, ArrowUp, Plus, Search, X } from "lucide-react";
import { StatusBadge } from "@/components/admin/status-badge";
import { Thumb } from "@/components/admin/thumb";
import { useAction } from "@/components/admin/use-action";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { searchProducts, setCollectionProducts } from "@/app/admin/(protected)/catalog/actions";
import { productStatusLabels } from "@/lib/catalog/admin-labels";
import type { AdminProductSummary } from "@/lib/catalog/admin-queries";

// Products in one collection, in display order. Changes are saved together.
export function CollectionProducts({
  collectionId,
  products,
}: {
  collectionId: string;
  products: AdminProductSummary[];
}) {
  const id = useId();
  const [initial] = useState(() => products.map((p) => p.id).join());
  const [list, setList] = useState(products);
  const [q, setQ] = useState("");
  const [results, setResults] = useState<AdminProductSummary[] | null>(null);
  const [searching, startSearch] = useTransition();
  const { pending, run } = useAction();
  const dirty = list.map((p) => p.id).join() !== initial;

  function move(index: number, by: -1 | 1) {
    setList((cur) => {
      const next = [...cur];
      const [moved] = next.splice(index, 1);
      next.splice(index + by, 0, moved);
      return next;
    });
  }

  return (
    <div className="flex flex-col gap-4">
      <form
        role="search"
        className="flex flex-col gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          if (q.trim().length < 2) return;
          startSearch(async () => setResults(await searchProducts(q.trim())));
        }}
      >
        <Label htmlFor={`${id}-q`}>Add products</Label>
        <div className="flex gap-2">
          <Input id={`${id}-q`} placeholder="Search by title" maxLength={80} value={q} onChange={(e) => setQ(e.target.value)} />
          <Button type="submit" variant="outline" disabled={searching}>
            <Search aria-hidden />
            <span className="sr-only sm:not-sr-only">Search</span>
          </Button>
        </div>
      </form>

      {results && (
        <div aria-live="polite" className="flex flex-col gap-1 rounded-lg border border-border p-2">
          {results.length === 0 ? (
            <p className="p-2 text-sm text-muted-foreground">No products found.</p>
          ) : (
            <ul className="flex flex-col">
              {results.map((p) => {
                const added = list.some((x) => x.id === p.id);
                return (
                  <li key={p.id} className="flex items-center gap-3 px-2 py-1">
                    <Thumb imageKey={p.imageKey} className="w-8" />
                    <span className="min-w-0 flex-1 truncate text-sm">{p.title}</span>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      disabled={added}
                      onClick={() => setList((cur) => [...cur, p])}
                    >
                      {added ? "Added" : <><Plus aria-hidden /> Add</>}
                    </Button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      )}

      {list.length === 0 ? (
        <p className="text-sm text-muted-foreground">No products in this collection yet.</p>
      ) : (
        <ol className="flex flex-col divide-y divide-border rounded-lg border border-border">
          {list.map((p, i) => (
            <li key={p.id} className="flex items-center gap-3 px-3 py-2">
              <span className="w-6 text-right text-xs text-muted-foreground tabular-nums">{i + 1}</span>
              <Thumb imageKey={p.imageKey} className="w-10" />
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-medium">{p.title}</span>
                {p.status !== "active" && <StatusBadge value={p.status} label={productStatusLabels[p.status]} />}
              </span>
              <Button type="button" variant="ghost" size="icon" aria-label={`Move ${p.title} up`} disabled={i === 0} onClick={() => move(i, -1)}>
                <ArrowUp aria-hidden />
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                aria-label={`Move ${p.title} down`}
                disabled={i === list.length - 1}
                onClick={() => move(i, 1)}
              >
                <ArrowDown aria-hidden />
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                aria-label={`Remove ${p.title}`}
                onClick={() => setList((cur) => cur.filter((x) => x.id !== p.id))}
              >
                <X aria-hidden />
              </Button>
            </li>
          ))}
        </ol>
      )}

      <div className="flex flex-col-reverse gap-2 sm:flex-row sm:items-center sm:justify-end">
        {dirty && (
          <Button type="button" variant="ghost" disabled={pending} onClick={() => setList(products)}>
            Discard
          </Button>
        )}
        <Button
          type="button"
          disabled={pending || !dirty}
          onClick={() => run(() => setCollectionProducts({ collectionId, productIds: list.map((p) => p.id) }))}
        >
          {pending ? "Saving…" : "Save order"}
        </Button>
      </div>
    </div>
  );
}
