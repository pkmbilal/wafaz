// DTDC public tracking page; it reads the consignment number from `?awb=` and fills in the form.
export function dtdcTrackingUrl(trackingNumber: string): string {
  return `https://www.dtdc.com/track-your-shipment/?awb=${encodeURIComponent(trackingNumber.trim())}`;
}
