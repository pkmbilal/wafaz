import { CatalogNav } from "@/components/admin/catalog-nav";

export default function CatalogLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-6">
      <CatalogNav />
      {children}
    </div>
  );
}
