"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { QuantityStepper } from "@/components/store/quantity-stepper";
import {
  type ActionResult,
  failStuckRefund,
  markDelivered,
  markPacked,
  markRto,
  previewRefund,
  type RefundPreview,
  refundOrder,
  resolveAttention,
  shipOrder,
} from "@/app/admin/(protected)/orders/actions";
import { formatInr } from "@/lib/format";
import type { FulfillmentStatus, OrderStatus, PaymentStatus } from "@/lib/orders/queries";
import { COURIERS, type Courier, courierLabels } from "@/lib/shipping/tracking";

// Status actions for one order. Only the transitions valid right now are offered; the DB functions
// re-check every one. Refund actions are shown to the owner only (the actions check it too).

export type OrderActionsProps = {
  orderId: string;
  orderStatus: OrderStatus;
  paymentStatus: PaymentStatus;
  fulfillmentStatus: FulfillmentStatus;
  isOwner: boolean;
  hasInvoice: boolean;
  refundInProgress: boolean;
  shippingPaise: number;
  shippingRefunded: boolean;
  items: { id: string; title: string; sku: string; qty: number; refundedQty: number }[];
};

function useAction() {
  const [pending, startTransition] = useTransition();
  function run(action: () => Promise<ActionResult>, success: string, onDone?: () => void) {
    startTransition(async () => {
      const result = await action();
      if (result.ok) {
        toast.success(result.message ?? success);
        onDone?.();
      } else {
        toast.error(result.error);
      }
    });
  }
  return { pending, run };
}

export function OrderActions(p: OrderActionsProps) {
  const { pending, run } = useAction();
  const paid = p.paymentStatus === "paid" || p.paymentStatus === "partially_refunded";
  const confirmed = p.orderStatus === "confirmed";
  const beforeShipping = p.fulfillmentStatus === "unfulfilled" || p.fulfillmentStatus === "packed";
  const remainingUnits = p.items.reduce((sum, i) => sum + i.qty - i.refundedQty, 0);
  const refundable =
    p.isOwner && p.hasInvoice && paid && !p.refundInProgress &&
    (remainingUnits > 0 || (p.shippingPaise > 0 && !p.shippingRefunded));

  const canPack = confirmed && paid && p.fulfillmentStatus === "unfulfilled";
  const canShip = confirmed && paid && beforeShipping && !p.refundInProgress;
  const shipped = confirmed && p.fulfillmentStatus === "shipped";
  const canCancel = refundable && confirmed && beforeShipping;
  const canPartial = refundable && (confirmed || p.orderStatus === "completed");
  const canReceiveRto = refundable && confirmed && p.fulfillmentStatus === "returned_to_origin";

  const nothing = !canPack && !canShip && !shipped && !canCancel && !canPartial && !canReceiveRto;

  return (
    <section aria-labelledby="actions-heading" className="flex flex-col gap-3 rounded-lg border border-border bg-card p-4 shadow-soft">
      <h2 id="actions-heading" className="font-sans text-sm font-semibold tracking-normal">
        Actions
      </h2>
      {p.refundInProgress && (
        <p className="text-sm text-muted-foreground">A refund is being processed. Other refund actions are paused.</p>
      )}
      {nothing ? (
        <p className="text-sm text-muted-foreground">No actions available for this order.</p>
      ) : (
        <div className="flex flex-col gap-2">
          {canPack && (
            <Button variant="outline" disabled={pending} onClick={() => run(() => markPacked(p.orderId), "Marked as packed")}>
              Mark packed
            </Button>
          )}
          {canShip && <ShipDialog orderId={p.orderId} />}
          {shipped && (
            <>
              <ConfirmDialog
                trigger="Mark delivered"
                title="Mark this order delivered?"
                description="The customer gets a delivered email and the order is completed."
                confirm="Mark delivered"
                onConfirm={() => markDelivered(p.orderId)}
                success="Marked as delivered"
              />
              <ConfirmDialog
                trigger="Returned to origin (RTO)"
                title="Parcel coming back?"
                description="Marks the order as returned to origin. Stock and the refund wait until you confirm the parcel has arrived."
                confirm="Mark RTO"
                onConfirm={() => markRto(p.orderId)}
                success="Marked as returned to origin"
                variant="outline"
              />
            </>
          )}
          {canReceiveRto && <RtoReceiveDialog {...p} />}
          {canPartial && <PartialRefundDialog {...p} />}
          {canCancel && <CancelDialog orderId={p.orderId} />}
        </div>
      )}
    </section>
  );
}

function ShipDialog({ orderId }: { orderId: string }) {
  const [open, setOpen] = useState(false);
  const [courier, setCourier] = useState<Courier>("dtdc");
  const [tracking, setTracking] = useState("");
  const { pending, run } = useAction();

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>Ship order</Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Ship order</DialogTitle>
          <DialogDescription>
            Book the parcel with the courier first, then enter the tracking number. The customer gets an email with the
            tracking link.
          </DialogDescription>
        </DialogHeader>
        <form
          className="flex flex-col gap-4"
          onSubmit={(e) => {
            e.preventDefault();
            run(() => shipOrder({ orderId, courier, trackingNumber: tracking }), "Marked as shipped", () => setOpen(false));
          }}
        >
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="ship-courier">Courier</Label>
            <Select value={courier} onValueChange={(v) => setCourier(v as Courier)}>
              <SelectTrigger id="ship-courier" className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {COURIERS.map((c) => (
                  <SelectItem key={c} value={c}>
                    {c === "other" ? "Other" : courierLabels[c]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="ship-tracking">Tracking number</Label>
            <Input
              id="ship-tracking"
              required
              autoComplete="off"
              maxLength={40}
              value={tracking}
              onChange={(e) => setTracking(e.target.value)}
            />
          </div>
          <DialogFooter>
            <Button type="submit" disabled={pending || tracking.trim().length < 3}>
              {pending ? "Saving…" : "Mark shipped"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function ConfirmDialog({
  trigger,
  title,
  description,
  confirm,
  onConfirm,
  success,
  variant = "default",
}: {
  trigger: string;
  title: string;
  description: string;
  confirm: string;
  onConfirm: () => Promise<ActionResult>;
  success: string;
  variant?: "default" | "outline";
}) {
  const [open, setOpen] = useState(false);
  const { pending, run } = useAction();
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant={variant}>{trigger}</Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button disabled={pending} onClick={() => run(onConfirm, success, () => setOpen(false))}>
            {pending ? "Saving…" : confirm}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function ReasonField({ id, value, onChange }: { id: string; value: string; onChange: (v: string) => void }) {
  return (
    <div className="flex flex-col gap-1.5">
      <Label htmlFor={id}>Reason (printed on the credit note)</Label>
      <Textarea id={id} required maxLength={500} value={value} onChange={(e) => onChange(e.target.value)} />
    </div>
  );
}

function CancelDialog({ orderId }: { orderId: string }) {
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("Cancelled at customer's request");
  const { pending, run } = useAction();
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="destructive">Cancel and refund</Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Cancel this order?</DialogTitle>
          <DialogDescription>
            Refunds everything still unrefunded (including shipping) through Razorpay, issues a credit note, puts the
            items back in stock and emails the customer. This can&apos;t be undone.
          </DialogDescription>
        </DialogHeader>
        <form
          className="flex flex-col gap-4"
          onSubmit={(e) => {
            e.preventDefault();
            run(() => refundOrder({ kind: "cancel", orderId, reason }), "Order cancelled", () => setOpen(false));
          }}
        >
          <ReasonField id="cancel-reason" value={reason} onChange={setReason} />
          <DialogFooter>
            <Button type="submit" variant="destructive" disabled={pending || reason.trim().length < 3}>
              {pending ? "Refunding…" : "Cancel and refund"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function RtoReceiveDialog(p: OrderActionsProps) {
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("Parcel returned to origin");
  const [includeShipping, setIncludeShipping] = useState(true);
  const { pending, run } = useAction();
  const showShipping = p.shippingPaise > 0 && !p.shippingRefunded;
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>Parcel received back: refund</Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Returned parcel received?</DialogTitle>
          <DialogDescription>
            Puts the items back in stock, refunds the customer through Razorpay, issues a credit note and cancels the
            order. Only confirm once the parcel is physically back with you.
          </DialogDescription>
        </DialogHeader>
        <form
          className="flex flex-col gap-4"
          onSubmit={(e) => {
            e.preventDefault();
            run(
              () => refundOrder({ kind: "rto", orderId: p.orderId, includeShipping: showShipping && includeShipping, reason }),
              "Refund issued",
              () => setOpen(false),
            );
          }}
        >
          {showShipping && (
            <div className="flex items-center gap-3">
              <Checkbox id="rto-shipping" checked={includeShipping} onCheckedChange={(v) => setIncludeShipping(v === true)} />
              <Label htmlFor="rto-shipping">Refund shipping ({formatInr(p.shippingPaise)})</Label>
            </div>
          )}
          {/* TODO(owner): should shipping be refunded by default when a parcel comes back undelivered? */}
          <ReasonField id="rto-reason" value={reason} onChange={setReason} />
          <DialogFooter>
            <Button type="submit" disabled={pending || reason.trim().length < 3}>
              {pending ? "Refunding…" : "Restock and refund"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function PartialRefundDialog(p: OrderActionsProps) {
  const [open, setOpen] = useState(false);
  const [qty, setQty] = useState<Record<string, number>>({});
  const [includeShipping, setIncludeShipping] = useState(false);
  const [reason, setReason] = useState("");
  const [preview, setPreview] = useState<RefundPreview | null>(null);
  const [previewing, startPreview] = useTransition();
  const { pending, run } = useAction();

  const showShipping = p.shippingPaise > 0 && !p.shippingRefunded;
  const selected = (q: Record<string, number>) =>
    Object.entries(q)
      .filter(([, n]) => n > 0)
      .map(([orderItemId, n]) => ({ orderItemId, qty: n }));
  const items = selected(qty);

  // Recalculate on the server (refund_preview) whenever the selection changes.
  function select(nextQty: Record<string, number>, nextShipping: boolean) {
    setQty(nextQty);
    setIncludeShipping(nextShipping);
    const nextItems = selected(nextQty);
    if (nextItems.length === 0 && !nextShipping) {
      setPreview(null);
      return;
    }
    startPreview(async () => {
      setPreview(await previewRefund({ orderId: p.orderId, items: nextItems, includeShipping: nextShipping }));
    });
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (!next) {
          setQty({});
          setIncludeShipping(false);
          setPreview(null);
        }
      }}
    >
      <DialogTrigger asChild>
        <Button variant="outline">Refund items</Button>
      </DialogTrigger>
      <DialogContent className="max-h-[90dvh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Refund items</DialogTitle>
          <DialogDescription>
            Choose what to refund. Each refund goes through Razorpay and gets its own credit note. Stock isn&apos;t
            changed.
          </DialogDescription>
        </DialogHeader>
        <form
          className="flex flex-col gap-4"
          onSubmit={(e) => {
            e.preventDefault();
            run(
              () => refundOrder({ kind: "partial", orderId: p.orderId, items, includeShipping, reason }),
              "Refund issued",
              () => setOpen(false),
            );
          }}
        >
          <ul className="flex flex-col divide-y divide-border">
            {p.items.map((item) => {
              const left = item.qty - item.refundedQty;
              return (
                <li key={item.id} className="flex items-center justify-between gap-3 py-2">
                  <div className="min-w-0 text-sm">
                    <p className="truncate font-medium">{item.title}</p>
                    <p className="text-xs text-muted-foreground">
                      {item.sku} · {left} of {item.qty} refundable
                    </p>
                  </div>
                  {left > 0 ? (
                    <QuantityStepper
                      value={qty[item.id] ?? 0}
                      min={0}
                      max={left}
                      label={`Units of ${item.title} to refund`}
                      onChange={(n) => select({ ...qty, [item.id]: n }, includeShipping)}
                    />
                  ) : (
                    <span className="text-xs text-muted-foreground">Refunded</span>
                  )}
                </li>
              );
            })}
          </ul>
          {showShipping && (
            <div className="flex items-center gap-3">
              <Checkbox
                id="partial-shipping"
                checked={includeShipping}
                onCheckedChange={(v) => select(qty, v === true)}
              />
              <Label htmlFor="partial-shipping">
                Refund shipping ({formatInr(p.shippingPaise)}). Only with the last items.
              </Label>
            </div>
          )}
          <div aria-live="polite" className="rounded-md bg-muted p-3 text-sm">
            {previewing ? (
              <p className="text-muted-foreground">Calculating…</p>
            ) : !preview ? (
              <p className="text-muted-foreground">Select at least one item.</p>
            ) : preview.ok ? (
              <p>
                Refund <strong className="tabular-nums">{formatInr(preview.amountPaise)}</strong>
                {preview.full ? " (everything left on the order)" : ""}
              </p>
            ) : (
              <p className="text-destructive">{preview.error}</p>
            )}
          </div>
          <ReasonField id="partial-reason" value={reason} onChange={setReason} />
          <DialogFooter>
            <Button
              type="submit"
              disabled={pending || previewing || !preview?.ok || reason.trim().length < 3}
            >
              {pending ? "Refunding…" : preview?.ok ? `Refund ${formatInr(preview.amountPaise)}` : "Refund"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export function ResolveAttentionDialog({ orderId }: { orderId: string }) {
  const [open, setOpen] = useState(false);
  const [note, setNote] = useState("");
  const { pending, run } = useAction();
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          Mark resolved
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Mark as resolved</DialogTitle>
          <DialogDescription>Clears the flag. Your note is kept in the order timeline.</DialogDescription>
        </DialogHeader>
        <form
          className="flex flex-col gap-4"
          onSubmit={(e) => {
            e.preventDefault();
            run(() => resolveAttention({ orderId, note }), "Marked as resolved", () => setOpen(false));
          }}
        >
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="resolve-note">What was done?</Label>
            <Textarea id="resolve-note" required maxLength={500} value={note} onChange={(e) => setNote(e.target.value)} />
          </div>
          <DialogFooter>
            <Button type="submit" disabled={pending || note.trim().length < 3}>
              {pending ? "Saving…" : "Mark resolved"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export function ClearStuckRefundButton({ orderId, refundId }: { orderId: string; refundId: string }) {
  return (
    <ConfirmDialog
      trigger="Clear stuck refund"
      title="No refund in Razorpay?"
      description="Check the Razorpay dashboard first. Only clear this if Razorpay shows no refund for this payment; if it did refund, wait for its webhook to finish the refund instead."
      confirm="Clear refund"
      onConfirm={() => failStuckRefund({ orderId, refundId })}
      success="Refund cleared"
      variant="outline"
    />
  );
}
