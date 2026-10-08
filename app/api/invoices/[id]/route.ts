import { z } from "zod";
import { getInvoiceForViewer, invoiceFileName } from "@/lib/orders/invoice";
import { renderInvoicePdf } from "@/pdf/invoice";

// Tax invoice PDF for an order, rendered on demand from the frozen invoice row (AGENTS.md §5.9).
// Access: the order owner's session, an admin, or a valid guest link token (?t=). Anything else
// gets a 404 so the route doesn't reveal which orders exist.

const paramsSchema = z.object({ id: z.uuid() });
const searchSchema = z.object({ t: z.string().min(1).max(100).optional() });

const notFound = () => new Response("Not found", { status: 404, headers: { "Cache-Control": "no-store" } });

export async function GET(req: Request, ctx: RouteContext<"/api/invoices/[id]">) {
  const params = paramsSchema.safeParse(await ctx.params);
  const search = searchSchema.safeParse(Object.fromEntries(new URL(req.url).searchParams));
  if (!params.success || !search.success) return notFound();

  const invoice = await getInvoiceForViewer(params.data.id, search.data.t);
  if (!invoice) return notFound();

  const pdf = await renderInvoicePdf(invoice);
  return new Response(new Uint8Array(pdf), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${invoiceFileName(invoice.number)}"`,
      "Cache-Control": "private, no-store",
      "X-Robots-Tag": "noindex",
    },
  });
}
