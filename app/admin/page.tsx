import { GoalPortal } from "@/components/dashboard/goal-portal";
import { requireProfile } from "@/lib/auth";

export default async function AdminPage() {
  const profile = await requireProfile("admin");
  return <GoalPortal initialRole="admin" profile={profile} />;
}
