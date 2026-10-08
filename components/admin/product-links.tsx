"use client";

import { ChecklistEditor } from "@/components/admin/checklist-editor";
import { setProductCollections, setProductTags } from "@/app/admin/(protected)/products/actions";

type Option = { id: string; label: string };

export function ProductTagsEditor({ productId, tags, selected }: { productId: string; tags: Option[]; selected: string[] }) {
  return (
    <ChecklistEditor
      legend="Tags"
      options={tags}
      selected={selected}
      emptyText="No tags yet."
      manageHref="/admin/catalog/tags"
      onSave={(tagIds) => setProductTags({ productId, tagIds })}
    />
  );
}

export function ProductCollectionsEditor({
  productId,
  collections,
  selected,
}: {
  productId: string;
  collections: Option[];
  selected: string[];
}) {
  return (
    <ChecklistEditor
      legend="Collections"
      options={collections}
      selected={selected}
      emptyText="No collections yet."
      manageHref="/admin/catalog/collections"
      onSave={(collectionIds) => setProductCollections({ productId, collectionIds })}
    />
  );
}
