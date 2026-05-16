import { GoalPortal } from "@/components/dashboard/goal-portal";
import { requireProfile } from "@/lib/auth";

export default async function EmployeePage() {
  const profile = await requireProfile("employee");
  return <GoalPortal initialRole="employee" profile={profile} />;
}
