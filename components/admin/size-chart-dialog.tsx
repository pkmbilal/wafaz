"use client";

import { useId, useState } from "react";
import { Pencil, Plus, Trash2 } from "lucide-react";
import { FormDialog } from "@/components/admin/form-dialog";
import { useAction } from "@/components/admin/use-action";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { saveSizeChart } from "@/app/admin/(protected)/catalog/actions";
import type { AdminSizeChart } from "@/lib/catalog/admin-queries";
import { sizeChartSchema } from "@/lib/validators/admin-catalog";

const BLANK = {
  unit: "in",
  columns: ["Size", "Bust", "Waist", "Hip", "Length"],
  rows: [["S", "", "", "", ""]],
  note: "",
};

export function SizeChartDialog({ chart }: { chart?: AdminSizeChart }) {
  return (
    <FormDialog
      wide
      trigger={chart ? <Pencil aria-hidden /> : <><Plus aria-hidden /> New size chart</>}
      triggerLabel={chart ? `Edit ${chart.name}` : undefined}
      variant={chart ? "ghost" : "default"}
      size={chart ? "icon" : "default"}
      title={chart ? `Edit ${chart.name}` : "New size chart"}
      description="The first column is the size. Shoppers see this table from the product page."
    >
      {(close) => <SizeChartForm chart={chart} onSaved={close} />}
    </FormDialog>
  );
}

function SizeChartForm({ chart, onSaved }: { chart?: AdminSizeChart; onSaved: () => void }) {
  const id = useId();
  const [name, setName] = useState(chart?.name ?? "");
  const [unit, setUnit] = useState(chart?.data.unit ?? BLANK.unit);
  const [columns, setColumns] = useState<string[]>(chart?.data.columns ?? BLANK.columns);
  const [rows, setRows] = useState<string[][]>(chart?.data.rows.map((r) => r.map(String)) ?? BLANK.rows);
  const [note, setNote] = useState(chart?.data.note ?? "");
  const [error, setError] = useState<string | null>(null);
  const { pending, run } = useAction();

  function setCell(r: number, c: number, value: string) {
    setRows((rs) => rs.map((row, i) => (i === r ? row.map((cell, j) => (j === c ? value : cell)) : row)));
  }

  function addColumn() {
    setColumns((cs) => [...cs, ""]);
    setRows((rs) => rs.map((row) => [...row, ""]));
  }

  function removeColumn(c: number) {
    setColumns((cs) => cs.filter((_, j) => j !== c));
    setRows((rs) => rs.map((row) => row.filter((_, j) => j !== c)));
  }

  function submit(e: React.FormEvent) {
    e.preventDefault();
    const input = { id: chart?.id, name, unit, columns, rows, note };
    const parsed = sizeChartSchema.safeParse(input);
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? "Check the chart");
      return;
    }
    setError(null);
    run(() => saveSizeChart(input), undefined, onSaved);
  }

  return (
    <form noValidate onSubmit={submit} className="flex flex-col gap-4">
      <div className="grid gap-3 sm:grid-cols-[1fr_10rem]">
        <div className="flex flex-col gap-2">
          <Label htmlFor={`${id}-name`}>Name</Label>
          <Input id={`${id}-name`} maxLength={80} value={name} onChange={(e) => setName(e.target.value)} />
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor={`${id}-unit`}>Unit</Label>
          <Select value={unit} onValueChange={setUnit}>
            <SelectTrigger id={`${id}-unit`} className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="in">Inches</SelectItem>
              <SelectItem value="cm">Centimetres</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="text-sm">
          <caption className="sr-only">Measurements</caption>
          <thead>
            <tr>
              {columns.map((col, c) => (
                <th key={c} scope="col" className="p-1 align-bottom">
                  <div className="flex items-center gap-1">
                    <Input
                      aria-label={`Column ${c + 1} heading`}
                      className="w-24 font-semibold"
                      maxLength={30}
                      value={col}
                      onChange={(e) => setColumns((cs) => cs.map((x, j) => (j === c ? e.target.value : x)))}
                    />
                    {c > 0 && columns.length > 2 && (
                      <Button type="button" variant="ghost" size="icon" aria-label={`Remove column ${col || c + 1}`} onClick={() => removeColumn(c)}>
                        <Trash2 aria-hidden />
                      </Button>
                    )}
                  </div>
                </th>
              ))}
              <th className="p-1">
                <span className="sr-only">Row actions</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row, r) => (
              <tr key={r}>
                {row.map((cell, c) => (
                  <td key={c} className="p-1">
                    <Input
                      aria-label={`${columns[c] || `Column ${c + 1}`} for row ${r + 1}`}
                      className="w-24 tabular-nums"
                      maxLength={20}
                      value={cell}
                      onChange={(e) => setCell(r, c, e.target.value)}
                    />
                  </td>
                ))}
                <td className="p-1">
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    aria-label={`Remove row ${row[0] || r + 1}`}
                    disabled={rows.length === 1}
                    onClick={() => setRows((rs) => rs.filter((_, i) => i !== r))}
                  >
                    <Trash2 aria-hidden />
                  </Button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="flex flex-wrap gap-2">
        <Button type="button" variant="outline" size="sm" disabled={rows.length >= 30} onClick={() => setRows((rs) => [...rs, columns.map(() => "")])}>
          <Plus aria-hidden /> Add row
        </Button>
        <Button type="button" variant="outline" size="sm" disabled={columns.length >= 10} onClick={addColumn}>
          <Plus aria-hidden /> Add column
        </Button>
      </div>

      <div className="flex flex-col gap-2">
        <Label htmlFor={`${id}-note`}>Note (optional)</Label>
        <Input id={`${id}-note`} maxLength={300} placeholder="e.g. Garment measurements; allow 1–2 in for ease." value={note} onChange={(e) => setNote(e.target.value)} />
      </div>

      <p aria-live="assertive" className="text-sm text-destructive empty:hidden">
        {error}
      </p>
      <Button type="submit" disabled={pending} className="self-end">
        {pending ? "Saving…" : "Save size chart"}
      </Button>
    </form>
  );
}
