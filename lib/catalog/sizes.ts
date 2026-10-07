// Display order for apparel sizes; unknown sizes sort after these, alphabetically.
export const SIZE_ORDER = ["XS", "S", "M", "L", "XL", "XXL", "3XL", "Free Size"] as const;

export function compareSizes(a: string, b: string): number {
  const ia = SIZE_ORDER.indexOf(a as (typeof SIZE_ORDER)[number]);
  const ib = SIZE_ORDER.indexOf(b as (typeof SIZE_ORDER)[number]);
  if (ia !== ib) return (ia === -1 ? Infinity : ia) - (ib === -1 ? Infinity : ib);
  return a.localeCompare(b);
}
