// DTDC has no consignment deep link we can rely on (the old trace.asp link is dead), so customers land on
// the tracking page and paste the number shown next to the link.
export function dtdcTrackingUrl(): string {
  return "https://www.dtdc.com/track";
}
