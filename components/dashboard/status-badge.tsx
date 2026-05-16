import { cn } from "@/lib/utils";
import type { GoalStatus } from "@/lib/domain/types";

const styles: Record<GoalStatus, string> = {
  draft: "bg-slate-100 text-slate-700",
  submitted: "bg-blue-50 text-blue-700",
  approved: "bg-emerald-50 text-emerald-700",
  rejected: "bg-rose-50 text-rose-700"
};

const labels: Record<GoalStatus, string> = {
  draft: "Draft",
  submitted: "Submitted",
  approved: "Approved",
  rejected: "Returned"
};

export function StatusBadge({ status }: { status: GoalStatus }) {
  return (
    <span className={cn("inline-flex rounded-full px-2.5 py-1 text-xs font-medium", styles[status])}>
      {labels[status]}
    </span>
  );
}
