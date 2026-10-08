import { fulfilmentPdfResponse } from "@/lib/orders/fulfilment-pdf-response";
import { renderLabelPdf } from "@/pdf/label";

export async function GET(_req: Request, ctx: RouteContext<"/admin/orders/[id]/label">) {
  return fulfilmentPdfResponse(ctx.params, renderLabelPdf, "label");
}
