"use client";

import { seedAchievements, seedGoals, seedReviews } from "@/lib/data/seed";
import { calculateProgressPercent } from "@/lib/domain/progress";
import type { AchievementFormValues, AchievementUpdate, Goal, GoalFormValues, ManagerReview } from "@/lib/domain/types";

const GOALS_KEY = "goal_portal_goals";
const REVIEWS_KEY = "goal_portal_reviews";
const ACHIEVEMENTS_KEY = "goal_portal_achievements";

function now() {
  return new Date().toISOString();
}

function readJson<T>(key: string, fallback: T): T {
  if (typeof window === "undefined") return fallback;
  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) {
      safeSetJson(key, fallback);
      return fallback;
    }
    return JSON.parse(raw) as T;
  } catch {
    safeSetJson(key, fallback);
    return fallback;
  }
}

function safeSetJson<T>(key: string, value: T) {
  window.localStorage.setItem(key, JSON.stringify(value));
}

function writeJson<T>(key: string, value: T) {
  try {
    safeSetJson(key, value);
  } catch {
    throw new Error("Unable to save changes in this browser session.");
  }
}

export function resetWorkspaceData() {
  if (typeof window === "undefined") return;
  safeSetJson(GOALS_KEY, seedGoals);
  safeSetJson(REVIEWS_KEY, seedReviews);
  safeSetJson(ACHIEVEMENTS_KEY, seedAchievements);
}

export function loadGoals(): Goal[] {
  return readJson(GOALS_KEY, seedGoals);
}

export function saveGoals(goals: Goal[]) {
  writeJson(GOALS_KEY, goals);
}

export function loadReviews(): ManagerReview[] {
  return readJson(REVIEWS_KEY, seedReviews);
}

export function saveReviews(reviews: ManagerReview[]) {
  writeJson(REVIEWS_KEY, reviews);
}

export function loadAchievements(): AchievementUpdate[] {
  return readJson(ACHIEVEMENTS_KEY, seedAchievements);
}

export function saveAchievements(achievements: AchievementUpdate[]) {
  writeJson(ACHIEVEMENTS_KEY, achievements);
}

export function createGoal(ownerId: string, values: GoalFormValues): Goal {
  return {
    id: `g_${crypto.randomUUID()}`,
    ownerId,
    ...values,
    status: "draft",
    locked: false,
    createdAt: now(),
    updatedAt: now()
  };
}

export function updateGoal(goal: Goal, values: Partial<GoalFormValues>): Goal {
  return {
    ...goal,
    ...values,
    updatedAt: now()
  };
}

export function submitEmployeeGoals(goals: Goal[], ownerId: string) {
  return goals.map((goal) =>
    goal.ownerId === ownerId && (goal.status === "draft" || goal.status === "rejected")
      ? { ...goal, status: "submitted" as const, updatedAt: now() }
      : goal
  );
}

export function decideEmployeeGoals(
  goals: Goal[],
  reviews: ManagerReview[],
  ownerId: string,
  managerId: string,
  status: "approved" | "rejected",
  comment: string
) {
  const updatedGoals = goals.map((goal) =>
    goal.ownerId === ownerId && goal.status === "submitted"
      ? {
          ...goal,
          status,
          locked: status === "approved" ? true : false,
          updatedAt: now()
        }
      : goal
  );

  const newReviews = goals
    .filter((goal) => goal.ownerId === ownerId && goal.status === "submitted")
    .map<ManagerReview>((goal) => ({
      id: `r_${crypto.randomUUID()}`,
      goalId: goal.id,
      managerId,
      status,
      comment,
      createdAt: now()
    }));

  return { updatedGoals, updatedReviews: [...reviews, ...newReviews] };
}

export function upsertAchievement(achievements: AchievementUpdate[], goal: Goal, values: AchievementFormValues) {
  const existing = achievements.find((achievement) => achievement.goalId === goal.id && achievement.quarter === values.quarter);
  const updatedAchievement: AchievementUpdate = {
    id: existing?.id ?? `a_${crypto.randomUUID()}`,
    goalId: goal.id,
    employeeId: goal.ownerId,
    ...values,
    progressPercent: calculateProgressPercent(goal, values.actualValue, values.status),
    createdAt: existing?.createdAt ?? now(),
    updatedAt: now()
  };

  if (existing) {
    return achievements.map((achievement) => (achievement.id === existing.id ? updatedAchievement : achievement));
  }

  return [...achievements, updatedAchievement];
}
