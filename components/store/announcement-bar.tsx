// Static text in Phase 1 (rotating / admin-managed announcements are Phase 2).
// TODO(owner): final announcement copy.
const ANNOUNCEMENT = "Free shipping across India on orders above ₹1,499";

export function AnnouncementBar() {
  return (
    <div className="bg-primary px-4 py-2 text-center text-xs font-medium tracking-wide text-primary-foreground">
      {ANNOUNCEMENT}
    </div>
  );
}
