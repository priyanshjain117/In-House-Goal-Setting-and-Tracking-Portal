"use client";

import type { AchievementFormValues, AchievementUpdate, Goal, GoalFormValues, ManagerReview, User } from "@/lib/domain/types";

type Workspace = {
  users: User[];
  goals: Goal[];
  reviews: ManagerReview[];
  achievements: AchievementUpdate[];
};

async function workspaceRequest<T>(payload?: Record<string, unknown>): Promise<T> {
  const response = await fetch("/api/workspace", {
    method: payload ? "POST" : "GET",
    headers: payload ? { "Content-Type": "application/json" } : undefined,
    body: payload ? JSON.stringify(payload) : undefined
  });

  const data = await response.json();
  if (!response.ok) {
    throw new Error(data.error ?? "Workspace API request failed.");
  }

  return data as T;
}

export function loadWorkspace() {
  return workspaceRequest<Workspace>();
}

export function insertGoal(ownerId: string, values: GoalFormValues) {
  return workspaceRequest<Goal>({ action: "insertGoal", ownerId, values });
}

export function updateGoal(goalId: string, values: GoalFormValues) {
  return workspaceRequest<Goal>({ action: "updateGoal", goalId, values });
}

export async function deleteGoal(goalId: string) {
  await workspaceRequest<{ ok: true }>({ action: "deleteGoal", goalId });
}

export function submitGoals(ownerId: string) {
  return workspaceRequest<Goal[]>({ action: "submitGoals", ownerId });
}

export function updateGoalFields(goalId: string, patch: Partial<Pick<Goal, "target" | "weightage">>) {
  return workspaceRequest<Goal>({ action: "updateGoalFields", goalId, patch });
}

export function decideGoals(ownerId: string, status: "approved" | "rejected", comment: string) {
  return workspaceRequest<{ goals: Goal[]; reviews: ManagerReview[] }>({ action: "decideGoals", ownerId, status, comment });
}

export function pushSharedGoal(ownerIds: string[]) {
  return workspaceRequest<Goal[]>({ action: "pushSharedGoal", ownerIds });
}

export function unlockGoal(goalId: string) {
  return workspaceRequest<Goal>({ action: "unlockGoal", goalId });
}

export function upsertAchievement(goal: Goal, values: AchievementFormValues) {
  return workspaceRequest<AchievementUpdate>({ action: "upsertAchievement", goal, values });
}
