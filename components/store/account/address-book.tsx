"use client";

import { useState, useTransition } from "react";
import { MapPin, Plus } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { AddressForm } from "@/components/store/address-form";
import { deleteAddress, saveAddress, setDefaultAddress } from "@/app/(store)/account/actions";
import type { SavedAddress } from "@/lib/account/queries";
import type { IndianState } from "@/lib/catalog/queries";

type Editing = { mode: "new" } | { mode: "edit"; address: SavedAddress } | null;

export function AddressBook({
  addresses,
  states,
}: {
  addresses: SavedAddress[];
  states: IndianState[];
}) {
  const [editing, setEditing] = useState<Editing>(null);
  const [pending, startTransition] = useTransition();
  const stateName = (code: string) => states.find((s) => s.code === code)?.name ?? code;

  function run(action: () => Promise<{ ok: boolean; error?: string }>, success: string) {
    startTransition(async () => {
      const result = await action();
      if (result.ok) toast.success(success);
      else toast.error(result.error ?? "Something went wrong");
    });
  }

  return (
    <div className="flex flex-col gap-4">
      {addresses.length === 0 ? (
        <div className="flex flex-col items-center gap-3 rounded-lg border border-dashed border-border px-6 py-12 text-center">
          <MapPin aria-hidden className="size-10 text-accent" strokeWidth={1.5} />
          <p className="text-sm text-muted-foreground">
            No saved addresses yet. Add one to check out faster.
          </p>
        </div>
      ) : (
        <ul className="grid gap-4 sm:grid-cols-2">
          {addresses.map((a) => (
            <li key={a.id} className="flex flex-col gap-3 rounded-lg border border-border bg-card p-4 shadow-soft">
              <div className="flex items-start justify-between gap-2">
                <p className="font-medium">{a.name}</p>
                {a.isDefault && <Badge variant="secondary">Default</Badge>}
              </div>
              <address className="text-sm leading-relaxed text-foreground/80 not-italic">
                {a.line1}
                {a.line2 && (
                  <>
                    <br />
                    {a.line2}
                  </>
                )}
                <br />
                {a.city}, {stateName(a.stateCode)} {a.pincode}
                <br />
                {a.phone}
              </address>
              <div className="mt-auto flex flex-wrap gap-1">
                <Button variant="outline" size="sm" onClick={() => setEditing({ mode: "edit", address: a })}>
                  Edit
                </Button>
                {!a.isDefault && (
                  <Button
                    variant="ghost"
                    size="sm"
                    disabled={pending}
                    onClick={() => run(() => setDefaultAddress(a.id), "Default address updated")}
                  >
                    Make default
                  </Button>
                )}
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-destructive"
                  disabled={pending}
                  aria-label={`Delete address for ${a.name}, ${a.line1}`}
                  onClick={() => run(() => deleteAddress(a.id), "Address deleted")}
                >
                  Delete
                </Button>
              </div>
            </li>
          ))}
        </ul>
      )}

      <Button variant="outline" className="self-start" onClick={() => setEditing({ mode: "new" })}>
        <Plus aria-hidden /> Add a new address
      </Button>

      <Dialog open={editing !== null} onOpenChange={(open) => !open && setEditing(null)}>
        <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-xl">
          <DialogHeader>
            <DialogTitle>{editing?.mode === "edit" ? "Edit address" : "Add a new address"}</DialogTitle>
            <DialogDescription>We deliver across India.</DialogDescription>
          </DialogHeader>
          {editing && (
            <AddressForm
              key={editing.mode === "edit" ? editing.address.id : "new"}
              states={states}
              showDefaultToggle={
                editing.mode === "new" ? addresses.length > 0 : !editing.address.isDefault
              }
              defaultValues={
                editing.mode === "edit"
                  ? {
                      name: editing.address.name,
                      phone: editing.address.phone.replace(/^\+91/, ""),
                      line1: editing.address.line1,
                      line2: editing.address.line2 ?? "",
                      city: editing.address.city,
                      stateCode: editing.address.stateCode,
                      pincode: editing.address.pincode,
                      isDefault: editing.address.isDefault,
                    }
                  : undefined
              }
              onCancel={() => setEditing(null)}
              onSubmit={async (values) => {
                const result = await saveAddress({
                  id: editing.mode === "edit" ? editing.address.id : undefined,
                  address: values,
                });
                if (result.ok) {
                  setEditing(null);
                  toast.success("Address saved");
                }
                return result;
              }}
            />
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
