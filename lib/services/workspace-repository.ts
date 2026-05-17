import "server-only";

import { calculateProgressPercent } from "@/lib/domain/progress";
import type {
  AchievementFormValues,
  AchievementUpdate,
  Goal,
  GoalFormValues,
  GoalProgressStatus,
  GoalStatus,
  GoalType,
  GoalUom,
  ManagerReview,
  Quarter,
  Role,
  User
} from "@/lib/domain/types";
import { createClient } from "@/lib/supabase/server";

type GoalRow = {
  id: string;
  employee_id: string;
  shared_goal_group_id?: string | null;
  primary_owner_id?: string | null;
  thrust_area: string;
  title: string;
  description: string;
  uom: GoalUom;
  goal_type: GoalType;
  target: string;
  weightage: number | string;
  status: GoalStatus;
  locked: boolean;
  created_at: string;
  updated_at?: string;
};

type UserRow = {
  id: string;
  name: string;
  email: string;
  role: Role;
  manager_id: string | null;
  created_at: string;
};

type ReviewRow = {
  id: string;
  goal_id: string;
  manager_id: string;
  action: "approved" | "rejected";
  comment: string | null;
  created_at: string;
};

type AchievementRow = {
  id: string;
  goal_id: string;
  employee_id: string;
  quarter: Quarter;
  actual_value: string;
  status: GoalProgressStatus;
  employee_comment: string | null;
  manager_comment: string | null;
  progress_percent: number | string;
  created_at: string;
  updated_at: string;
};

function toGoal(row: GoalRow): Goal {
  return {
    id: row.id,
    ownerId: row.employee_id,
    sharedGoalGroupId: row.shared_goal_group_id ?? null,
    primaryOwnerId: row.primary_owner_id ?? null,
    thrustArea: row.thrust_area,
    title: row.title,
    description: row.description,
    uom: row.uom,
    goalType: row.goal_type,
    target: row.target,
    weightage: Number(row.weightage),
    status: row.status,
    locked: row.locked,
    createdAt: row.created_at,
    updatedAt: row.updated_at ?? row.created_at
  };
}

function toUser(row: UserRow): User {
  return {
    id: row.id,
    name: row.name,
    email: row.email,
    role: row.role,
    managerId: row.manager_id,
    department: null,
    title: null,
    createdAt: row.created_at
  };
}

function toReview(row: ReviewRow): ManagerReview {
  return {
    id: row.id,
    goalId: row.goal_id,
    managerId: row.manager_id,
    status: row.action,
    comment: row.comment ?? "",
    createdAt: row.created_at
  };
}

function toAchievement(row: AchievementRow): AchievementUpdate {
  return {
    id: row.id,
    goalId: row.goal_id,
    employeeId: row.employee_id,
    quarter: row.quarter,
    actualValue: row.actual_value,
    status: row.status,
    employeeComment: row.employee_comment ?? "",
    managerComment: row.manager_comment ?? "",
    progressPercent: Number(row.progress_percent),
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

export async function loadWorkspace() {
  const supabase = await createClient();
  const [
    { data: goalRows, error: goalsError },
    { data: userRows, error: usersError },
    { data: reviewRows, error: reviewsError },
    { data: achievementRows, error: achievementsError }
  ] = await Promise.all([
    supabase.from("goals").select("*").order("created_at", { ascending: true }),
    supabase.from("users").select("id, name, email, role, manager_id, created_at").order("created_at"),
    supabase.from("manager_reviews").select("*").order("created_at", { ascending: true }),
    supabase.from("achievement_updates").select("*").order("updated_at", { ascending: false })
  ]);

  if (goalsError) throw new Error(goalsError.message);
  if (usersError) throw new Error(usersError.message);
  if (reviewsError) throw new Error(reviewsError.message);
  if (achievementsError) throw new Error(achievementsError.message);

  return {
    goals: (goalRows ?? []).map((row) => toGoal(row as GoalRow)),
    users: (userRows ?? []).map((row) => toUser(row as UserRow)),
    reviews: (reviewRows ?? []).map((row) => toReview(row as ReviewRow)),
    achievements: (achievementRows ?? []).map((row) => toAchievement(row as AchievementRow))
  };
}

export async function insertGoal(ownerId: string, values: GoalFormValues) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("goals")
    .insert({
      employee_id: ownerId,
      thrust_area: values.thrustArea,
      title: values.title,
      description: values.description,
      uom: values.uom,
      goal_type: values.goalType,
      target: values.target,
      weightage: values.weightage
    })
    .select("*")
    .single();

  if (error) throw new Error(error.message);
  return toGoal(data as GoalRow);
}

export async function updateGoal(goalId: string, values: GoalFormValues) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("goals")
    .update({
      thrust_area: values.thrustArea,
      title: values.title,
      description: values.description,
      uom: values.uom,
      goal_type: values.goalType,
      target: values.target,
      weightage: values.weightage
    })
    .eq("id", goalId)
    .select("*")
    .single();

  if (error) throw new Error(error.message);
  return toGoal(data as GoalRow);
}

export async function deleteGoal(goalId: string) {
  const supabase = await createClient();
  const { error } = await supabase.from("goals").delete().eq("id", goalId);
  if (error) throw new Error(error.message);
}

export async function submitGoals(ownerId: string) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("goals")
    .update({ status: "submitted" })
    .eq("employee_id", ownerId)
    .in("status", ["draft", "rejected"])
    .select("*");

  if (error) throw new Error(error.message);
  return (data ?? []).map((row) => toGoal(row as GoalRow));
}

export async function updateGoalFields(goalId: string, patch: Partial<Pick<Goal, "target" | "weightage">>) {
  const supabase = await createClient();
  const { data, error } = await supabase.from("goals").update(patch).eq("id", goalId).select("*").single();

  if (error) throw new Error(error.message);
  return toGoal(data as GoalRow);
}

export async function decideGoals(ownerId: string, managerId: string, status: "approved" | "rejected", comment: string) {
  const supabase = await createClient();
  const { data: updatedRows, error: updateError } = await supabase
    .from("goals")
    .update({
      status,
      approved: status === "approved",
      locked: status === "approved",
      manager_comment: comment
    })
    .eq("employee_id", ownerId)
    .eq("status", "submitted")
    .select("*");

  if (updateError) throw new Error(updateError.message);

  const reviewRows = (updatedRows ?? []).map((goal) => ({
    goal_id: goal.id,
    manager_id: managerId,
    action: status,
    comment
  }));

  let reviews: ManagerReview[] = [];
  if (reviewRows.length) {
    const { data, error } = await supabase.from("manager_reviews").insert(reviewRows).select("*");
    if (error) throw new Error(error.message);
    reviews = (data ?? []).map((row) => toReview(row as ReviewRow));
  }

  return {
    goals: (updatedRows ?? []).map((row) => toGoal(row as GoalRow)),
    reviews
  };
}

export async function pushSharedGoal(ownerIds: string[], primaryOwnerId: string) {
  const supabase = await createClient();
  const sharedGoalGroupId = crypto.randomUUID();
  const { data, error } = await supabase
    .from("goals")
    .insert(
      ownerIds.map((ownerId) => ({
        employee_id: ownerId,
        shared_goal_group_id: sharedGoalGroupId,
        primary_owner_id: primaryOwnerId,
        thrust_area: "Capability Building",
        title: "Employee Training Completion",
        description: "Complete quarterly enablement certification for operating rhythm and governance practices.",
        uom: "percentage",
        goal_type: "min",
        target: "100%",
        weightage: 10
      }))
    )
    .select("*");

  if (error) throw new Error(error.message);
  return (data ?? []).map((row) => toGoal(row as GoalRow));
}

export async function unlockGoal(goalId: string) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("goals")
    .update({ locked: false, approved: false, status: "draft", manager_comment: null })
    .eq("id", goalId)
    .select("*")
    .single();

  if (error) throw new Error(error.message);
  return toGoal(data as GoalRow);
}

export async function upsertAchievement(goal: Goal, values: AchievementFormValues) {
  const supabase = await createClient();
  const progressPercent = calculateProgressPercent(goal, values.actualValue, values.status);
  const { data, error } = await supabase
    .from("achievement_updates")
    .upsert(
      {
        goal_id: goal.id,
        employee_id: goal.ownerId,
        quarter: values.quarter,
        actual_value: values.actualValue,
        status: values.status,
        employee_comment: values.employeeComment,
        manager_comment: values.managerComment,
        progress_percent: progressPercent
      },
      { onConflict: "goal_id,quarter" }
    )
    .select("*")
    .single();

  if (error) throw new Error(error.message);
  return toAchievement(data as AchievementRow);
}
