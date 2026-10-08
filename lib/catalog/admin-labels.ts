import type { ProductStatus } from "@/lib/validators/admin-catalog";

// Admin wording for product statuses.
export const productStatusLabels: Record<ProductStatus, string> = {
  draft: "Draft",
  active: "Active",
  archived: "Archived",
};
