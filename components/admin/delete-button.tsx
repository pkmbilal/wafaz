"use client";

import { Trash2 } from "lucide-react";
import { ConfirmDialog } from "@/components/admin/confirm-dialog";
import {
  deleteBanner,
  deleteCategory,
  deleteCollection,
  deleteSizeChart,
  deleteTag,
} from "@/app/admin/(protected)/catalog/actions";

const ACTIONS = {
  category: { run: deleteCategory, noun: "category" },
  collection: { run: deleteCollection, noun: "collection" },
  tag: { run: deleteTag, noun: "tag" },
  sizeChart: { run: deleteSizeChart, noun: "size chart" },
  banner: { run: deleteBanner, noun: "banner" },
} as const;

// Icon button that confirms, then deletes one catalog row.
export function DeleteButton({
  kind,
  id,
  name,
  withLabel = false,
}: {
  kind: keyof typeof ACTIONS;
  id: string;
  name: string;
  withLabel?: boolean;
}) {
  const { run, noun } = ACTIONS[kind];
  return (
    <ConfirmDialog
      trigger={
        <>
          <Trash2 aria-hidden />
          {withLabel && `Delete ${noun}`}
        </>
      }
      triggerLabel={withLabel ? undefined : `Delete ${name}`}
      variant={withLabel ? "destructive" : "ghost"}
      size={withLabel ? "default" : "icon"}
      title={`Delete “${name}”?`}
      description={`This removes the ${noun} for good. It can't be undone.`}
      confirm={`Delete ${noun}`}
      confirmVariant="destructive"
      onConfirm={() => run(id)}
    />
  );
}
