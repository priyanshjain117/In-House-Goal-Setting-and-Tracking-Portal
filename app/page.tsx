import { redirect } from "next/navigation";
import { getCurrentProfile, getRoleHome } from "@/lib/auth";

export default async function Home() {
  const profile = await getCurrentProfile();
  redirect(profile ? getRoleHome(profile.role) : "/login");
}
