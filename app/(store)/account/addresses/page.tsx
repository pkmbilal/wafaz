import type { Metadata } from "next";
import { AddressBook } from "@/components/store/account/address-book";
import { getSavedAddresses } from "@/lib/account/queries";
import { requireUser } from "@/lib/auth/session";
import { getIndianStates } from "@/lib/catalog/queries";

export const metadata: Metadata = { title: "My addresses" };

export default async function AccountAddressesPage() {
  const { id } = await requireUser("/account/addresses");
  const [addresses, states] = await Promise.all([getSavedAddresses(id), getIndianStates()]);

  return (
    <section className="flex flex-col gap-4">
      <h2 className="text-2xl font-semibold">Saved addresses</h2>
      <AddressBook addresses={addresses} states={states} />
    </section>
  );
}
