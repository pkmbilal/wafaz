"use client";

import { ConfirmDialog } from "@/components/admin/confirm-dialog";
import { processDeletion } from "@/app/admin/(protected)/actions";

export function ProcessDeletionButton({ userId, orderCount }: { userId: string; orderCount: number }) {
  return (
    <ConfirmDialog
      trigger="Process"
      variant="outline"
      size="sm"
      title="Process this deletion request?"
      description={
        orderCount === 0
          ? "The customer has no orders, so the account and all its data are deleted. This can't be undone."
          : `The customer has ${orderCount} ${orderCount === 1 ? "order" : "orders"}. Their profile, addresses and cart are wiped and the login is closed; orders and invoices are kept for tax records. This can't be undone.`
      }
      confirm="Process deletion"
      confirmVariant="destructive"
      onConfirm={() => processDeletion(userId)}
    />
  );
}
