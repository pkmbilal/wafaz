import { z } from "zod";
import { creditNoteFileName, getCreditNoteForViewer } from "@/lib/orders/credit-note";
import { renderCreditNotePdf } from "@/pdf/credit-note";

// Credit note PDF, rendered on demand from the frozen credit_notes row (AGENTS.md §5.9). Same access
// rules as the invoice: the order owner's session, an admin, or a valid guest link token (?t=).
// Anything else gets a 404.

const paramsSchema = z.object({ id: z.uuid() });
const searchSchema = z.object({ t: z.string().min(1).max(100).optional() });

const notFound = () => new Response("Not found", { status: 404, headers: { "Cache-Control": "no-store" } });

export async function GET(req: Request, ctx: RouteContext<"/api/credit-notes/[id]">) {
  const params = paramsSchema.safeParse(await ctx.params);
  const search = searchSchema.safeParse(Object.fromEntries(new URL(req.url).searchParams));
  if (!params.success || !search.success) return notFound();

  const note = await getCreditNoteForViewer(params.data.id, search.data.t);
  if (!note) return notFound();

  const pdf = await renderCreditNotePdf(note);
  return new Response(new Uint8Array(pdf), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${creditNoteFileName(note.number)}"`,
      "Cache-Control": "private, no-store",
      "X-Robots-Tag": "noindex",
    },
  });
}
