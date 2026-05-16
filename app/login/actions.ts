"use server";

import { createClient as createAdminClient, type SupabaseClient } from "@supabase/supabase-js";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import type { Role } from "@/lib/domain/types";
import { getRoleHome } from "@/lib/auth";
import { getSupabaseConfig } from "@/lib/supabase/config";
import { createClient } from "@/lib/supabase/server";

type AuthState = {
  error?: string;
};

const demoAccounts = [
  {
    name: "Demo Employee",
    email: "employee@demo.com",
    password: "Employee123",
    role: "employee" as const,
    managerEmail: "manager@demo.com"
  },
  {
    name: "Demo Manager",
    email: "manager@demo.com",
    password: "Manager123",
    role: "manager" as const,
    managerEmail: null
  },
  {
    name: "Demo Admin HR",
    email: "admin@demo.com",
    password: "Admin123",
    role: "admin" as const,
    managerEmail: null
  }
];

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

export async function seedDemoAccountsAction(_: AuthState): Promise<AuthState> {
  void _;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!serviceRoleKey) {
    return { error: "Add SUPABASE_SERVICE_ROLE_KEY locally to auto-create demo Auth users." };
  }

  const { url } = getSupabaseConfig();
  const admin = createAdminClient(url, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  });

  const schemaReady = await verifySchema(admin);
  if (schemaReady.error) {
    return schemaReady;
  }

  const byEmail = new Map<string, string>();

  for (const account of demoAccounts) {
    const existing = await findUserByEmail(admin, account.email);
    const user =
      existing ??
      (
        await admin.auth.admin.createUser({
          email: account.email,
          password: account.password,
          email_confirm: true,
          user_metadata: {
            name: account.name,
            role: account.role
          }
        })
      ).data.user;

    if (!user) {
      return { error: `Could not create ${account.email}.` };
    }

    byEmail.set(account.email, user.id);
  }

  const managerId = byEmail.get("manager@demo.com") ?? null;
  const rows = demoAccounts.map((account) => ({
    id: byEmail.get(account.email),
    name: account.name,
    email: account.email,
    role: account.role,
    manager_id: account.role === "employee" ? managerId : null
  }));

  const { error } = await admin.from("users").upsert(rows, { onConflict: "id" });

  if (error) {
    if (isMissingSchemaError(error)) {
      return { error: "Supabase tables are missing. Run supabase/schema.sql in Supabase SQL Editor, then try again." };
    }

    return { error: error.message };
  }

  return {};
}

async function findUserByEmail(admin: SupabaseClient, email: string) {
  let page = 1;

  while (page < 20) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 100 });
    if (error) throw new Error(error.message);

    const user = data.users.find((candidate) => candidate.email?.toLowerCase() === email);
    if (user) return user;
    if (data.users.length < 100) return null;
    page += 1;
  }

  return null;
}

async function verifySchema(admin: SupabaseClient): Promise<AuthState> {
  const { error } = await admin.from("users").select("id", { count: "exact", head: true });

  if (!error) return {};

  if (isMissingSchemaError(error)) {
    return { error: "Supabase tables are missing. Run supabase/schema.sql in Supabase SQL Editor, then try again." };
  }

  return { error: error.message };
}

function isMissingSchemaError(error: { code?: string; message?: string }) {
  return error.code === "42P01" || error.code === "PGRST205" || error.message?.toLowerCase().includes("schema cache");
}
