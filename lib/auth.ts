import "server-only";

import { redirect } from "next/navigation";
import type { AuthProfile, Role } from "@/lib/domain/types";
import { createClient } from "@/lib/supabase/server";

const roleHome: Record<Role, string> = {
  employee: "/employee",
  manager: "/manager",
  admin: "/admin"
};

export function getRoleHome(role: Role) {
  return roleHome[role];
}

export async function getCurrentProfile(): Promise<AuthProfile | null> {
  const supabase = await createClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();

  if (!user) return null;

  const { data, error } = await supabase
    .from("users")
    .select("id, name, email, role, manager_id, created_at")
    .eq("id", user.id)
    .single();

  if (error || !data) return null;

  return {
    id: data.id,
    name: data.name,
    email: data.email,
    role: data.role as Role,
    managerId: data.manager_id,
    createdAt: data.created_at
  };
}

export async function requireProfile(role?: Role) {
  const profile = await getCurrentProfile();

  if (!profile) {
    redirect("/login");
  }

  if (role && profile.role !== role) {
    redirect(getRoleHome(profile.role));
  }

  return profile;
}
