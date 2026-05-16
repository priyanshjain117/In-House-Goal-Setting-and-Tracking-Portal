import { GoalPortal } from "@/components/dashboard/goal-portal";
import { requireProfile } from "@/lib/auth";

export default async function ManagerPage() {
  const profile = await requireProfile("manager");
  return <GoalPortal initialRole="manager" profile={profile} />;
}
