import "server-only";
import { z } from "zod";
import { requireAdmin } from "@/lib/auth/guards";
import { type FulfilmentDoc, getFulfilmentDoc } from "@/lib/orders/fulfilment-doc";

// Shared handler for the admin packing slip and label routes. Layouts don't guard route handlers,
// so the role is checked here.

const paramsSchema = z.object({ id: z.uuid() });

export async function fulfilmentPdfResponse(
  params: Promise<unknown>,
  render: (doc: FulfilmentDoc) => Promise<Buffer>,
  fileSuffix: string,
): Promise<Response> {
  await requireAdmin();
  const parsed = paramsSchema.safeParse(await params);
  const doc = parsed.success ? await getFulfilmentDoc(parsed.data.id) : null;
  if (!doc) return new Response("Not found", { status: 404, headers: { "Cache-Control": "no-store" } });

  const pdf = await render(doc);
  return new Response(new Uint8Array(pdf), {
    headers: {
      "Content-Type": "application/pdf",
      // Opens in the browser's viewer, ready to print.
      "Content-Disposition": `inline; filename="${doc.orderNumber}-${fileSuffix}.pdf"`,
      "Cache-Control": "private, no-store",
      "X-Robots-Tag": "noindex",
    },
  });
}
