// Every cacheTag / revalidateTag name lives here so mutations and readers can't drift apart.
export const cacheTags = {
  catalog: "catalog",
  settings: "settings",
  product: (id: string) => `product:${id}`,
  collection: (slug: string) => `collection:${slug}`,
  page: (slug: string) => `page:${slug}`,
} as const;
