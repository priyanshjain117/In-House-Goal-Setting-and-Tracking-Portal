"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import type { Role } from "@/lib/domain/types";
import { getRoleHome } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

type AuthState = {
  error?: string;
};

export async function loginAction(_: AuthState, formData: FormData): Promise<AuthState> {
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const password = String(formData.get("password") ?? "");

  if (!email || !password) {
    return { error: "Email and password are required." };
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({ email, password });

  if (error) {
    return { error: error.message };
  }

  const { data: profile, error: profileError } = await supabase.from("users").select("role").eq("email", email).single();

  if (profileError || !profile?.role) {
    await supabase.auth.signOut();
    if (profileError && isMissingSchemaError(profileError)) {
      return { error: "Supabase tables are missing. Run supabase/schema.sql in Supabase SQL Editor, then try again." };
    }

    return { error: "Your account exists, but no app role is configured." };
  }

  revalidatePath("/", "layout");
  redirect(getRoleHome(profile.role as Role));
}

export async function logoutAction() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  revalidatePath("/", "layout");
  redirect("/login");
}

function isMissingSchemaError(error: { code?: string; message?: string }) {
  return error.code === "42P01" || error.code === "PGRST205" || error.message?.toLowerCase().includes("schema cache");
}
