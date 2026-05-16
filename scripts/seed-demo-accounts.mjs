import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { createClient } from "@supabase/supabase-js";

const demoAccounts = [
  {
    name: "Aarav Mehta",
    email: "employee@demo.com",
    password: "Employee123",
    role: "employee",
    managerEmail: "manager@demo.com"
  },
  {
    name: "Nisha Rao",
    email: "nisha@demo.com",
    password: "Employee123",
    role: "employee",
    managerEmail: "manager@demo.com"
  },
  {
    name: "Rohan Iyer",
    email: "rohan@demo.com",
    password: "Employee123",
    role: "employee",
    managerEmail: "manager@demo.com"
  },
  {
    name: "Priya Menon",
    email: "priya@demo.com",
    password: "Employee123",
    role: "employee",
    managerEmail: "manager@demo.com"
  },
  {
    name: "Meera Shah",
    email: "manager@demo.com",
    password: "Manager123",
    role: "manager",
    managerEmail: null
  },
  {
    name: "Kabir Sethi",
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

await seedDemoWorkspace();

console.log("Demo Supabase Auth accounts, users, goals, approvals, and achievements are ready.");

async function seedDemoWorkspace() {
  const employeeId = idsByEmail.get("employee@demo.com");
  const nishaId = idsByEmail.get("nisha@demo.com");
  const rohanId = idsByEmail.get("rohan@demo.com");
  const priyaId = idsByEmail.get("priya@demo.com");
  const managerId = idsByEmail.get("manager@demo.com");

  const demoGoals = [
    approvedGoal("11111111-1111-4111-8111-111111111111", employeeId, "Revenue Growth", "Increase Sales Revenue", "Grow monthly revenue from strategic accounts.", "percentage", "min", "18%", 30),
    approvedGoal("11111111-1111-4111-8111-111111111112", employeeId, "Customer Experience", "Reduce Ticket Resolution Time", "Lower average customer ticket turnaround time.", "numeric", "max", "24 hours", 25),
    approvedGoal("11111111-1111-4111-8111-111111111113", employeeId, "Reliability", "Maintain Zero Critical Incidents", "Keep Sev-1 operational incidents at zero.", "zero_based", "min", "0 incidents", 20),
    approvedGoal("11111111-1111-4111-8111-111111111114", employeeId, "Capability Building", "Employee Training Completion", "Complete quarterly enablement certification.", "percentage", "min", "100%", 25, "22222222-2222-4222-8222-222222222222", managerId),
    submittedGoal("11111111-1111-4111-8111-111111111115", nishaId, "Planning", "Improve Forecast Accuracy", "Improve monthly forecast accuracy for priority SKUs.", "percentage", "min", "95%", 40),
    submittedGoal("11111111-1111-4111-8111-111111111116", nishaId, "Operational Efficiency", "Reduce Operational Cost", "Reduce controllable fulfilment cost.", "percentage", "max", "4%", 35),
    submittedGoal("11111111-1111-4111-8111-111111111117", nishaId, "Execution", "Project Delivery: West Zone Launch", "Complete launch readiness checklist.", "timeline", "min", "2026-07-31", 25),
    approvedGoal("11111111-1111-4111-8111-111111111118", rohanId, "Customer Experience", "Improve Customer Satisfaction", "Raise post-service CSAT.", "percentage", "min", "92%", 45),
    approvedGoal("11111111-1111-4111-8111-111111111119", rohanId, "Quality", "Reduce Repeat Complaints", "Reduce repeat complaint count.", "numeric", "max", "40 tickets", 35),
    approvedGoal("11111111-1111-4111-8111-111111111120", rohanId, "Capability Building", "Employee Training Completion", "Complete quarterly enablement certification.", "percentage", "min", "100%", 20, "22222222-2222-4222-8222-222222222222", managerId),
    approvedGoal("11111111-1111-4111-8111-111111111121", priyaId, "Revenue Growth", "Increase Qualified Pipeline", "Increase qualified pipeline from enterprise leads.", "numeric", "min", "120 leads", 50),
    approvedGoal("11111111-1111-4111-8111-111111111122", priyaId, "Capability Building", "Employee Training Completion", "Complete quarterly enablement certification.", "percentage", "min", "100%", 20, "22222222-2222-4222-8222-222222222222", managerId),
    {
      ...submittedGoal("11111111-1111-4111-8111-111111111123", priyaId, "Channel Growth", "Partner Activation", "Activate new channel partners.", "numeric", "min", "18 partners", 30),
      status: "rejected",
      locked: false,
      approved: false,
      manager_comment: "Please split partner activation into lead generation and activation quality."
    }
  ];

  const { error: goalError } = await admin.from("goals").upsert(demoGoals, { onConflict: "id" });
  if (goalError) fail(goalError.message);

  const reviews = [
    review("33333333-3333-4333-8333-333333333331", "11111111-1111-4111-8111-111111111111", managerId, "approved", "Targets are ambitious but realistic."),
    review("33333333-3333-4333-8333-333333333332", "11111111-1111-4111-8111-111111111118", managerId, "approved", "Strong customer-first plan."),
    review("33333333-3333-4333-8333-333333333333", "11111111-1111-4111-8111-111111111123", managerId, "rejected", "Please split partner activation into lead generation and activation quality.")
  ];
  const { error: reviewError } = await admin.from("manager_reviews").upsert(reviews, { onConflict: "id" });
  if (reviewError) fail(reviewError.message);

  const achievements = [
    achievement("44444444-4444-4444-8444-444444444441", "11111111-1111-4111-8111-111111111111", employeeId, "14%", "on_track", 78, "Strategic account pipeline moved faster.", "Focus on two late-stage renewals."),
    achievement("44444444-4444-4444-8444-444444444442", "11111111-1111-4111-8111-111111111112", employeeId, "22 hours", "completed", 100, "Queue triage reduced handoffs.", "Document the triage pattern."),
    achievement("44444444-4444-4444-8444-444444444443", "11111111-1111-4111-8111-111111111113", employeeId, "0", "completed", 100, "No Sev-1 incidents.", "Keep prevention checklist active."),
    achievement("44444444-4444-4444-8444-444444444444", "11111111-1111-4111-8111-111111111114", employeeId, "96%", "on_track", 96, "Final assessment scheduled.", "Close final module this week."),
    achievement("44444444-4444-4444-8444-444444444445", "11111111-1111-4111-8111-111111111118", rohanId, "88%", "on_track", 96, "Weekend backlog needs focus.", "Review staffing for weekend queues."),
    achievement("44444444-4444-4444-8444-444444444446", "11111111-1111-4111-8111-111111111119", rohanId, "48 tickets", "on_track", 83, "Repeat complaints trending down.", "Add root-cause tags."),
    achievement("44444444-4444-4444-8444-444444444447", "11111111-1111-4111-8111-111111111121", priyaId, "132 leads", "completed", 100, "Campaign optimization improved quality.", "Strong delivery."),
    achievement("44444444-4444-4444-8444-444444444448", "11111111-1111-4111-8111-111111111122", priyaId, "100%", "completed", 100, "Training certification completed.", "Completed on time.")
  ];
  const { error: achievementError } = await admin.from("achievement_updates").upsert(achievements, { onConflict: "id" });
  if (achievementError) fail(achievementError.message);
}

function approvedGoal(id, employeeId, thrustArea, title, description, uom, goalType, target, weightage, sharedGoalGroupId = null, primaryOwnerId = null) {
  return {
    id,
    employee_id: employeeId,
    shared_goal_group_id: sharedGoalGroupId,
    primary_owner_id: primaryOwnerId,
    thrust_area: thrustArea,
    title,
    description,
    uom,
    goal_type: goalType,
    target,
    weightage,
    status: "approved",
    approved: true,
    locked: true
  };
}

function submittedGoal(id, employeeId, thrustArea, title, description, uom, goalType, target, weightage) {
  return {
    id,
    employee_id: employeeId,
    thrust_area: thrustArea,
    title,
    description,
    uom,
    goal_type: goalType,
    target,
    weightage,
    status: "submitted",
    approved: false,
    locked: false
  };
}

function review(id, goalId, managerId, action, comment) {
  return { id, goal_id: goalId, manager_id: managerId, action, comment };
}

function achievement(id, goalId, employeeId, actualValue, status, progressPercent, employeeComment, managerComment) {
  return {
    id,
    goal_id: goalId,
    employee_id: employeeId,
    quarter: "Q1",
    actual_value: actualValue,
    status,
    employee_comment: employeeComment,
    manager_comment: managerComment,
    progress_percent: progressPercent
  };
}

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
