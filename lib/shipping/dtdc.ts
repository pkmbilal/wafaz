// TODO(owner): confirm this is the tracking link DTDC customers should use.
// DTDC public tracking page for a consignment number.
export function dtdcTrackingUrl(trackingNumber: string): string {
  return `https://www.dtdc.in/trace.asp?strCnno=${encodeURIComponent(trackingNumber.trim())}`;
}
