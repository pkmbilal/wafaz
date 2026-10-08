"use client";

import { useId, useState } from "react";
import { Plus, Trash2, Wand2 } from "lucide-react";
import { toast } from "sonner";
import { useAction } from "@/components/admin/use-action";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { adjustStock, saveVariants } from "@/app/admin/(protected)/products/actions";
import {
  buildVariantMatrix,
  type MatrixColour,
  paiseToRupeesInput,
  rupeesToPaise,
  skuPrefixFromSlug,
} from "@/lib/catalog/admin-input";
import type { AdminVariant } from "@/lib/catalog/admin-queries";
import { SIZE_ORDER } from "@/lib/catalog/sizes";
import { saveVariantsSchema, type VariantRowInput } from "@/lib/validators/admin-catalog";

// Variant table for one product: edit prices, SKUs and weights inline, add rows one by one or with
// the size × colour generator, and adjust stock through admin_adjust_stock. Existing stock is never
// edited inline; opening stock is set only on new rows.

type Row = {
  key: string;
  id?: string;
  sku: string;
  size: string;
  colour: string;
  colourHex: string;
  mrp: string;
  price: string;
  weightGrams: string;
  stock: string; // opening stock, new rows only
  isActive: boolean;
  current?: { stock: number; reserved: number };
};

let tempId = 0;
const newKey = () => `new-${++tempId}`;

function toRow(v: AdminVariant): Row {
  return {
    key: v.id,
    id: v.id,
    sku: v.sku,
    size: v.size,
    colour: v.colour,
    colourHex: v.colourHex ?? "",
    mrp: paiseToRupeesInput(v.mrpPaise),
    price: paiseToRupeesInput(v.pricePaise),
    weightGrams: String(v.weightGrams),
    stock: "",
    isActive: v.isActive,
    current: { stock: v.stock, reserved: v.reserved },
  };
}

function toInput(r: Row): VariantRowInput {
  return {
    ...(r.id ? { id: r.id } : { stock: r.stock || "0" }),
    sku: r.sku,
    size: r.size,
    colour: r.colour,
    colourHex: r.colourHex,
    mrp: r.mrp,
    price: r.price,
    weightGrams: r.weightGrams,
    isActive: r.isActive,
  };
}

export function VariantEditor({
  productId,
  productSlug,
  variants,
}: {
  productId: string;
  productSlug: string;
  variants: AdminVariant[];
}) {
  const [initial] = useState(() => variants.map(toRow));
  const [rows, setRows] = useState<Row[]>(initial);
  const { pending, run } = useAction();
  const dirty = JSON.stringify(rows) !== JSON.stringify(initial);

  function update(key: string, patch: Partial<Row>) {
    setRows((rs) => rs.map((r) => (r.key === key ? { ...r, ...patch } : r)));
  }

  function addBlank() {
    const last = rows.at(-1);
    setRows((rs) => [
      ...rs,
      {
        key: newKey(),
        sku: "",
        size: "",
        colour: last?.colour ?? "",
        colourHex: last?.colourHex ?? "",
        mrp: last?.mrp ?? "",
        price: last?.price ?? "",
        weightGrams: last?.weightGrams ?? "",
        stock: "0",
        isActive: true,
      },
    ]);
  }

  function save() {
    const payload = { productId, variants: rows.map(toInput) };
    const parsed = saveVariantsSchema.safeParse(payload);
    if (!parsed.success) {
      const issue = parsed.error.issues[0];
      const index = issue?.path[1];
      const row = typeof index === "number" ? rows[index] : undefined;
      const where = row ? `${row.colour || "?"} / ${row.size || "?"}: ` : "";
      toast.error(`${where}${issue?.message ?? "Check the variants"}`);
      return;
    }
    run(() => saveVariants(payload));
  }

  const colours: MatrixColour[] = [];
  for (const r of rows) {
    if (r.colour && !colours.some((c) => c.name.toLowerCase() === r.colour.toLowerCase())) {
      colours.push({ name: r.colour, hex: r.colourHex });
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap gap-2">
        <GenerateDialog
          defaultPrefix={skuPrefixFromSlug(productSlug)}
          defaultColours={colours}
          onGenerate={(matrix) => {
            const added = buildVariantMatrix(matrix, rows);
            if (added.length === 0) {
              toast.info("All of those sizes and colours already exist.");
              return false;
            }
            setRows((rs) => [
              ...rs,
              ...added.map((a) => ({
                key: newKey(),
                sku: a.sku,
                size: a.size,
                colour: a.colour,
                colourHex: a.colourHex,
                mrp: paiseToRupeesInput(a.mrpPaise),
                price: paiseToRupeesInput(a.pricePaise),
                weightGrams: String(a.weightGrams),
                stock: String(a.stock),
                isActive: true,
              })),
            ]);
            toast.success(`Added ${added.length} new ${added.length === 1 ? "variant" : "variants"}. Save to keep them.`);
            return true;
          }}
        />
        <Button type="button" variant="outline" onClick={addBlank}>
          <Plus aria-hidden />
          Add one variant
        </Button>
      </div>

      {rows.length === 0 ? (
        <p className="text-sm text-muted-foreground">No variants yet. Generate them from sizes and colours.</p>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-border">
          <table className="w-full min-w-[60rem] text-sm">
            <caption className="sr-only">Variants</caption>
            <thead className="bg-muted/50 text-left text-xs font-semibold tracking-wide text-muted-foreground uppercase">
              <tr>
                <th scope="col" className="px-2 py-2">Colour</th>
                <th scope="col" className="px-2 py-2">Size</th>
                <th scope="col" className="px-2 py-2">SKU</th>
                <th scope="col" className="px-2 py-2">MRP ₹</th>
                <th scope="col" className="px-2 py-2">Price ₹</th>
                <th scope="col" className="px-2 py-2">Weight g</th>
                <th scope="col" className="px-2 py-2">Stock</th>
                <th scope="col" className="px-2 py-2">Active</th>
                <th scope="col" className="px-2 py-2"><span className="sr-only">Remove</span></th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => {
                const label = `${r.colour || "new"} ${r.size}`.trim();
                return (
                  <tr key={r.key} className="border-t border-border align-middle">
                    <td className="px-2 py-1.5">
                      <div className="flex items-center gap-1.5">
                        <span
                          aria-hidden
                          className="size-5 shrink-0 rounded-full border border-border"
                          style={{ background: /^#[0-9A-Fa-f]{6}$/.test(r.colourHex) ? r.colourHex : "transparent" }}
                        />
                        <Input
                          aria-label={`Colour for ${label}`}
                          className="w-28"
                          maxLength={40}
                          value={r.colour}
                          onChange={(e) => update(r.key, { colour: e.target.value })}
                        />
                        <Input
                          aria-label={`Swatch hex for ${label}`}
                          className="w-24 font-mono"
                          placeholder="#RRGGBB"
                          maxLength={7}
                          value={r.colourHex}
                          onChange={(e) => update(r.key, { colourHex: e.target.value })}
                        />
                      </div>
                    </td>
                    <td className="px-2 py-1.5">
                      <Input
                        aria-label={`Size for ${label}`}
                        className="w-20"
                        maxLength={20}
                        value={r.size}
                        onChange={(e) => update(r.key, { size: e.target.value })}
                      />
                    </td>
                    <td className="px-2 py-1.5">
                      <Input
                        aria-label={`SKU for ${label}`}
                        className="w-40 font-mono uppercase"
                        maxLength={40}
                        value={r.sku}
                        onChange={(e) => update(r.key, { sku: e.target.value.toUpperCase() })}
                      />
                    </td>
                    <td className="px-2 py-1.5">
                      <Input
                        aria-label={`MRP for ${label}`}
                        className="w-24 tabular-nums"
                        inputMode="decimal"
                        value={r.mrp}
                        onChange={(e) => update(r.key, { mrp: e.target.value })}
                      />
                    </td>
                    <td className="px-2 py-1.5">
                      <Input
                        aria-label={`Selling price for ${label}`}
                        className="w-24 tabular-nums"
                        inputMode="decimal"
                        value={r.price}
                        onChange={(e) => update(r.key, { price: e.target.value })}
                      />
                    </td>
                    <td className="px-2 py-1.5">
                      <Input
                        aria-label={`Weight in grams for ${label}`}
                        className="w-20 tabular-nums"
                        inputMode="numeric"
                        value={r.weightGrams}
                        onChange={(e) => update(r.key, { weightGrams: e.target.value })}
                      />
                    </td>
                    <td className="px-2 py-1.5">
                      {r.id && r.current ? (
                        <StockCell
                          productId={productId}
                          variantId={r.id}
                          label={label}
                          stock={r.current.stock}
                          reserved={r.current.reserved}
                          disabled={dirty}
                        />
                      ) : (
                        <Input
                          aria-label={`Opening stock for ${label}`}
                          className="w-20 tabular-nums"
                          inputMode="numeric"
                          value={r.stock}
                          onChange={(e) => update(r.key, { stock: e.target.value })}
                        />
                      )}
                    </td>
                    <td className="px-2 py-1.5">
                      <Switch
                        aria-label={`${label} is on sale`}
                        checked={r.isActive}
                        onCheckedChange={(on) => update(r.key, { isActive: on })}
                      />
                    </td>
                    <td className="px-2 py-1.5">
                      {!r.id && (
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          aria-label={`Remove new variant ${label}`}
                          onClick={() => setRows((rs) => rs.filter((x) => x.key !== r.key))}
                        >
                          <Trash2 aria-hidden />
                        </Button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      <div className="flex flex-col-reverse items-stretch gap-2 sm:flex-row sm:items-center sm:justify-end">
        {dirty && (
          <p className="text-sm text-muted-foreground" aria-live="polite">
            Unsaved changes. Saved variants can be switched off but not deleted.
          </p>
        )}
        {dirty && (
          <Button type="button" variant="ghost" disabled={pending} onClick={() => setRows(initial)}>
            Discard
          </Button>
        )}
        <Button type="button" disabled={pending || !dirty} onClick={save}>
          {pending ? "Saving…" : "Save variants"}
        </Button>
      </div>
    </div>
  );
}

function StockCell({
  productId,
  variantId,
  label,
  stock,
  reserved,
  disabled,
}: {
  productId: string;
  variantId: string;
  label: string;
  stock: number;
  reserved: number;
  disabled: boolean;
}) {
  const id = useId();
  const [open, setOpen] = useState(false);
  const [delta, setDelta] = useState("");
  const { pending, run } = useAction();
  const n = /^-?\d+$/.test(delta.trim()) ? Number(delta) : NaN;
  const next = Number.isInteger(n) ? stock + n : null;

  return (
    <div className="flex items-center gap-2">
      <span className="tabular-nums whitespace-nowrap">
        {stock - reserved}
        <span className="text-xs text-muted-foreground"> avail</span>
        {reserved > 0 && <span className="block text-xs text-muted-foreground">{reserved} reserved</span>}
      </span>
      <Dialog
        open={open}
        onOpenChange={(o) => {
          setOpen(o);
          if (!o) setDelta("");
        }}
      >
        <DialogTrigger asChild>
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={disabled}
            title={disabled ? "Save or discard your changes first" : undefined}
            aria-label={`Adjust stock for ${label}`}
          >
            Adjust
          </Button>
        </DialogTrigger>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Adjust stock · {label}</DialogTitle>
            <DialogDescription>
              In stock: {stock}. Reserved for unpaid orders: {reserved}. Enter units received (e.g. 10) or removed (e.g. -2).
            </DialogDescription>
          </DialogHeader>
          <form
            className="flex flex-col gap-4"
            onSubmit={(e) => {
              e.preventDefault();
              run(() => adjustStock({ productId, variantId, delta }), undefined, () => setOpen(false));
            }}
          >
            <div className="flex flex-col gap-2">
              <Label htmlFor={`${id}-delta`}>Change</Label>
              <Input
                id={`${id}-delta`}
                inputMode="numeric"
                autoFocus
                value={delta}
                onChange={(e) => setDelta(e.target.value.replace(/[^\d-]/g, ""))}
                aria-describedby={`${id}-next`}
              />
              <p id={`${id}-next`} className="text-sm text-muted-foreground" aria-live="polite">
                {next === null ? " " : next < reserved ? `Can't go below ${reserved} (reserved).` : `New stock: ${next}`}
              </p>
            </div>
            <DialogFooter>
              <Button type="submit" disabled={pending || next === null || n === 0 || next < reserved}>
                {pending ? "Saving…" : "Update stock"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function GenerateDialog({
  defaultPrefix,
  defaultColours,
  onGenerate,
}: {
  defaultPrefix: string;
  defaultColours: MatrixColour[];
  onGenerate: (input: Parameters<typeof buildVariantMatrix>[0]) => boolean;
}) {
  const id = useId();
  const [open, setOpen] = useState(false);
  const [prefix, setPrefix] = useState(defaultPrefix);
  const [sizes, setSizes] = useState<string[]>([]);
  const [extraSizes, setExtraSizes] = useState("");
  const [colours, setColours] = useState<MatrixColour[]>(
    defaultColours.length ? defaultColours : [{ name: "", hex: "" }],
  );
  const [mrp, setMrp] = useState("");
  const [price, setPrice] = useState("");
  const [weight, setWeight] = useState("");
  const [stock, setStock] = useState("0");
  const [error, setError] = useState<string | null>(null);

  function generate(e: React.FormEvent) {
    e.preventDefault();
    const allSizes = [...sizes, ...extraSizes.split(",").map((s) => s.trim()).filter(Boolean)];
    const mrpPaise = rupeesToPaise(mrp);
    const pricePaise = rupeesToPaise(price);
    const weightGrams = /^\d+$/.test(weight) ? Number(weight) : 0;
    const stockUnits = /^\d+$/.test(stock) ? Number(stock) : -1;
    const named = colours.filter((c) => c.name.trim());

    if (!/^[A-Za-z0-9]{1,12}$/.test(prefix)) return setError("SKU prefix: up to 12 letters or digits.");
    if (allSizes.length === 0) return setError("Pick at least one size.");
    if (named.length === 0) return setError("Add at least one colour.");
    if (!mrpPaise || !pricePaise) return setError("Enter the MRP and selling price in rupees.");
    if (pricePaise > mrpPaise) return setError("Selling price can't be above the MRP.");
    if (weightGrams < 1 || weightGrams > 50000) return setError("Enter the packed weight in grams.");
    if (stockUnits < 0 || stockUnits > 100000) return setError("Opening stock must be a whole number.");
    setError(null);

    const added = onGenerate({
      skuPrefix: prefix,
      sizes: allSizes,
      colours: named,
      mrpPaise,
      pricePaise,
      weightGrams,
      stock: stockUnits,
    });
    if (added) setOpen(false);
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button type="button" variant="outline">
          <Wand2 aria-hidden />
          Generate variants
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>Generate variants</DialogTitle>
          <DialogDescription>
            Creates one variant for every size and colour picked. Combinations that already exist are skipped.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={generate} className="flex flex-col gap-5">
          <fieldset className="flex flex-col gap-2">
            <legend className="mb-2 text-sm font-medium">Sizes</legend>
            <div className="grid grid-cols-3 gap-1 sm:grid-cols-4">
              {SIZE_ORDER.map((s) => (
                <label key={s} className="flex min-h-touch items-center gap-2 text-sm">
                  <Checkbox
                    checked={sizes.includes(s)}
                    onCheckedChange={(on) => setSizes((cur) => (on === true ? [...cur, s] : cur.filter((x) => x !== s)))}
                  />
                  {s}
                </label>
              ))}
            </div>
            <Label htmlFor={`${id}-extra`} className="mt-2">Other sizes (comma separated)</Label>
            <Input id={`${id}-extra`} placeholder="e.g. 38, 40, 42" value={extraSizes} onChange={(e) => setExtraSizes(e.target.value)} />
          </fieldset>

          <fieldset className="flex flex-col gap-2">
            <legend className="mb-2 text-sm font-medium">Colours</legend>
            {colours.map((c, i) => (
              <div key={i} className="flex items-center gap-2">
                <span
                  aria-hidden
                  className="size-6 shrink-0 rounded-full border border-border"
                  style={{ background: /^#[0-9A-Fa-f]{6}$/.test(c.hex) ? c.hex : "transparent" }}
                />
                <Input
                  aria-label={`Colour ${i + 1} name`}
                  placeholder="Colour name"
                  maxLength={40}
                  value={c.name}
                  onChange={(e) => setColours((cs) => cs.map((x, j) => (j === i ? { ...x, name: e.target.value } : x)))}
                />
                <Input
                  aria-label={`Colour ${i + 1} swatch hex`}
                  className="w-28 font-mono"
                  placeholder="#RRGGBB"
                  maxLength={7}
                  value={c.hex}
                  onChange={(e) => setColours((cs) => cs.map((x, j) => (j === i ? { ...x, hex: e.target.value } : x)))}
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  aria-label={`Remove colour ${i + 1}`}
                  disabled={colours.length === 1}
                  onClick={() => setColours((cs) => cs.filter((_, j) => j !== i))}
                >
                  <Trash2 aria-hidden />
                </Button>
              </div>
            ))}
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="self-start"
              onClick={() => setColours((cs) => [...cs, { name: "", hex: "" }])}
            >
              <Plus aria-hidden />
              Add colour
            </Button>
          </fieldset>

          <div className="grid gap-3 sm:grid-cols-2">
            <div className="flex flex-col gap-2">
              <Label htmlFor={`${id}-prefix`}>SKU prefix</Label>
              <Input id={`${id}-prefix`} className="font-mono uppercase" maxLength={12} value={prefix} onChange={(e) => setPrefix(e.target.value.toUpperCase())} />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor={`${id}-weight`}>Packed weight (g)</Label>
              <Input id={`${id}-weight`} inputMode="numeric" value={weight} onChange={(e) => setWeight(e.target.value)} />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor={`${id}-mrp`}>MRP ₹ (incl. GST)</Label>
              <Input id={`${id}-mrp`} inputMode="decimal" value={mrp} onChange={(e) => setMrp(e.target.value)} />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor={`${id}-price`}>Selling price ₹ (incl. GST)</Label>
              <Input id={`${id}-price`} inputMode="decimal" value={price} onChange={(e) => setPrice(e.target.value)} />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor={`${id}-stock`}>Opening stock each</Label>
              <Input id={`${id}-stock`} inputMode="numeric" value={stock} onChange={(e) => setStock(e.target.value)} />
            </div>
          </div>

          <p aria-live="assertive" className="text-sm text-destructive empty:hidden">
            {error}
          </p>
          <DialogFooter>
            <Button type="submit">Add variants</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
