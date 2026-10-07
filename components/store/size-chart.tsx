"use client";

import { Ruler } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import type { SizeChartData } from "@/lib/catalog/queries";

export function SizeChart({ name, data }: { name: string; data: SizeChartData }) {
  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button variant="link" size="sm" className="self-start px-0">
          <Ruler />
          Size chart
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Size chart</DialogTitle>
          <DialogDescription>
            {name} · measurements in {data.unit === "in" ? "inches" : data.unit}
          </DialogDescription>
        </DialogHeader>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border">
                {data.columns.map((c) => (
                  <th key={c} scope="col" className="px-2 py-2 text-left font-semibold">
                    {c}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {data.rows.map((row) => (
                <tr key={String(row[0])} className="border-b border-border/60 last:border-0">
                  {row.map((cell, i) =>
                    i === 0 ? (
                      <th key={i} scope="row" className="px-2 py-2 text-left font-medium">
                        {cell}
                      </th>
                    ) : (
                      <td key={i} className="px-2 py-2 text-muted-foreground">
                        {cell}
                      </td>
                    ),
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {data.note && <p className="text-xs text-muted-foreground">{data.note}</p>}
      </DialogContent>
    </Dialog>
  );
}
