"use client";

import type { Goal, GoalFormValues, GoalStatus, GoalType, GoalUom, ManagerReview, Role, User } from "@/lib/domain/types";
import { createClient } from "@/lib/supabase/client";

type GoalRow = {
  id: string;
  employee_id: string;
  thrust_area: string;
  title: string;
  description: string;
  uom: GoalUom;
  goal_type: GoalType;
  target: string;
  weightage: number | string;
  status: GoalStatus;
  approved: boolean;
  locked: boolean;
  manager_comment: string | null;
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

function toGoal(row: GoalRow): Goal {
  return {
    id: row.id,
    ownerId: row.employee_id,
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

export async function loadSupabaseWorkspace() {
  const supabase = createClient();
  const [{ data: goalRows, error: goalsError }, { data: userRows, error: usersError }, { data: reviewRows, error: reviewsError }] =
    await Promise.all([
      supabase.from("goals").select("*").order("created_at", { ascending: true }),
      supabase.from("users").select("id, name, email, role, manager_id, created_at").order("created_at"),
      supabase.from("manager_reviews").select("*").order("created_at", { ascending: true })
    ]);

  if (goalsError) throw new Error(goalsError.message);
  if (usersError) throw new Error(usersError.message);
  if (reviewsError) throw new Error(reviewsError.message);

  return {
    goals: (goalRows ?? []).map((row) => toGoal(row as GoalRow)),
    users: (userRows ?? []).map((row) => toUser(row as UserRow)),
    reviews: (reviewRows ?? []).map((row) => toReview(row as ReviewRow))
  };
}

export async function insertSupabaseGoal(ownerId: string, values: GoalFormValues) {
  const supabase = createClient();
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

export async function updateSupabaseGoal(goalId: string, values: GoalFormValues) {
  const supabase = createClient();
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

export async function deleteSupabaseGoal(goalId: string) {
  const supabase = createClient();
  const { error } = await supabase.from("goals").delete().eq("id", goalId);
  if (error) throw new Error(error.message);
}

export async function submitSupabaseGoals(ownerId: string) {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("goals")
    .update({ status: "submitted" })
    .eq("employee_id", ownerId)
    .in("status", ["draft", "rejected"])
    .select("*");

  if (error) throw new Error(error.message);
  return (data ?? []).map((row) => toGoal(row as GoalRow));
}

export async function updateSupabaseGoalFields(goalId: string, patch: Partial<Pick<Goal, "target" | "weightage">>) {
  const supabase = createClient();
  const { data, error } = await supabase.from("goals").update(patch).eq("id", goalId).select("*").single();

  if (error) throw new Error(error.message);
  return toGoal(data as GoalRow);
}

export async function decideSupabaseGoals(ownerId: string, managerId: string, status: "approved" | "rejected", comment: string) {
  const supabase = createClient();
  const locked = status === "approved";
  const { data: updatedRows, error: updateError } = await supabase
    .from("goals")
    .update({
      status,
      approved: status === "approved",
      locked,
      manager_comment: comment
    })
    .eq("employee_id", ownerId)
    .eq("status", "submitted")
    .select("*");

  if (updateError) throw new Error(updateError.message);

  const reviews = (updatedRows ?? []).map((goal) => ({
    goal_id: goal.id,
    manager_id: managerId,
    action: status,
    comment
  }));

  let insertedReviews: ManagerReview[] = [];

  if (reviews.length) {
    const { data: reviewRows, error: reviewError } = await supabase.from("manager_reviews").insert(reviews).select("*");
    if (reviewError) throw new Error(reviewError.message);
    insertedReviews = (reviewRows ?? []).map((row) => toReview(row as ReviewRow));
  }

  return {
    goals: (updatedRows ?? []).map((row) => toGoal(row as GoalRow)),
    reviews: insertedReviews
  };
}

export async function unlockSupabaseGoal(goalId: string) {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("goals")
    .update({ locked: false, approved: false, status: "draft", manager_comment: null })
    .eq("id", goalId)
    .select("*")
    .single();

  if (error) throw new Error(error.message);
  return toGoal(data as GoalRow);
}
