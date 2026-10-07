// India Post doesn't support deep links to a consignment, so customers land on the tracking page
// and paste the number shown next to the link.
export function indiaPostTrackingUrl(): string {
  return "https://www.indiapost.gov.in/_layouts/15/dop.portal.tracking/trackconsignment.aspx";
}
