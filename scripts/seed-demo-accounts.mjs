import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { createClient } from "@supabase/supabase-js";

const demoAccounts = [
  {
    name: "Demo Employee",
    email: "employee@demo.com",
    password: "Employee123",
    role: "employee",
    managerEmail: "manager@demo.com"
  },
  {
    name: "Demo Manager",
    email: "manager@demo.com",
    password: "Manager123",
    role: "manager",
    managerEmail: null
  },
  {
    name: "Demo Admin HR",
    email: "admin@demo.com",
    password: "Admin123",
    role: "admin",
    managerEmail: null
  }
];

loadEnv(".env.local");
loadEnv(".env");

const supabaseUrl = cleanSupabaseUrl(process.env.NEXT_PUBLIC_SUPABASE_URL);
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !serviceRoleKey) {
  fail("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY. Existing env files were not modified.");
}

const admin = createClient(supabaseUrl, serviceRoleKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

await verifySchema();

const idsByEmail = new Map();

for (const account of demoAccounts) {
  const existing = await findUserByEmail(account.email);
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
    fail(`Could not create ${account.email}.`);
  }

  idsByEmail.set(account.email, user.id);
}

const managerId = idsByEmail.get("manager@demo.com") ?? null;
const rows = demoAccounts.map((account) => ({
  id: idsByEmail.get(account.email),
  name: account.name,
  email: account.email,
  role: account.role,
  manager_id: account.role === "employee" ? managerId : null
}));

const { error } = await admin.from("users").upsert(rows, { onConflict: "id" });

if (error) {
  fail(error.message);
}

console.log("Demo Supabase Auth accounts and public.users rows are ready.");

async function verifySchema() {
  const { error } = await admin.from("users").select("id", { count: "exact", head: true });

  if (!error) return;

  const message = error.message ?? "";
  const missingTable = error.code === "42P01" || error.code === "PGRST205" || message.includes("schema cache");

  if (missingTable) {
    fail("public.users is missing from Supabase. Run supabase/schema.sql in the Supabase SQL Editor, then run this seed script again.");
  }

  fail(message);
}

async function findUserByEmail(email) {
  let page = 1;

  while (page < 20) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 100 });
    if (error) fail(error.message);

    const user = data.users.find((candidate) => candidate.email?.toLowerCase() === email);
    if (user) return user;
    if (data.users.length < 100) return null;
    page += 1;
  }

  return null;
}

function loadEnv(fileName) {
  const filePath = resolve(process.cwd(), fileName);
  if (!existsSync(filePath)) return;

  const lines = readFileSync(filePath, "utf8").split(/\r?\n/);

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#") || !trimmed.includes("=")) continue;
    const [key, ...valueParts] = trimmed.split("=");

    if (process.env[key]) continue;

    const rawValue = valueParts.join("=");
    process.env[key] = rawValue.replace(/^['"]|['"]$/g, "");
  }
}

function cleanSupabaseUrl(url) {
  return url?.replace(/\/rest\/v1\/?$/, "").replace(/\/$/, "");
}

function fail(message) {
  console.error(message);
  process.exit(1);
}
