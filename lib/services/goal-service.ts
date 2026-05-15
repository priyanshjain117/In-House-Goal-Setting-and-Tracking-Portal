"use client";

import { seedGoals, seedReviews } from "@/lib/data/seed";
import type { Goal, GoalFormValues, ManagerReview } from "@/lib/domain/types";

const GOALS_KEY = "goal_portal_goals";
const REVIEWS_KEY = "goal_portal_reviews";

function now() {
  return new Date().toISOString();
}

function readJson<T>(key: string, fallback: T): T {
  if (typeof window === "undefined") return fallback;
  const raw = window.localStorage.getItem(key);
  if (!raw) {
    window.localStorage.setItem(key, JSON.stringify(fallback));
    return fallback;
  }
  return JSON.parse(raw) as T;
}

function writeJson<T>(key: string, value: T) {
  window.localStorage.setItem(key, JSON.stringify(value));
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
    goal.ownerId === ownerId && goal.status !== "approved"
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
          locked: status === "approved",
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
