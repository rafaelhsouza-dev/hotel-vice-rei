import { STATUS_LABEL, type BookingStatus } from "@/lib/repo/bookings";
import { Badge } from "./ui";

const TONE: Record<BookingStatus, "neutral" | "success" | "warning" | "danger" | "info"> = {
  pending: "warning",
  confirmed: "success",
  checked_in: "info",
  checked_out: "neutral",
  cancelled: "danger",
  no_show: "danger",
};

export function StatusBadge({ status }: { status: BookingStatus }) {
  return <Badge tone={TONE[status] ?? "neutral"}>{STATUS_LABEL[status] ?? status}</Badge>;
}
