import { Badge } from "@/components/ui/badge";

export function StatusBadge({ status }: { status: string }) {
  const variant =
    status === "active"
      ? "green"
      : status === "creating"
        ? "amber"
        : status === "error"
          ? "red"
          : "gray";
  return (
    <Badge variant={variant} size="sm" contrast="low">
      {status}
    </Badge>
  );
}
