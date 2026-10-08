import { fulfilmentPdfResponse } from "@/lib/orders/fulfilment-pdf-response";
import { renderPackingSlipPdf } from "@/pdf/packing-slip";

export async function GET(_req: Request, ctx: RouteContext<"/admin/orders/[id]/packing-slip">) {
  return fulfilmentPdfResponse(ctx.params, renderPackingSlipPdf, "packing-slip");
}
