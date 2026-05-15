"use server";

import { goalFormSchema, validateGoalSet } from "@/lib/domain/goal-validation";
import type { Goal, GoalFormValues } from "@/lib/domain/types";

export async function validateGoalDraftAction(values: GoalFormValues) {
  const result = goalFormSchema.safeParse(values);

  if (result.success) {
    return { success: true, errors: {} };
  }

  return {
    success: false,
    errors: result.error.flatten().fieldErrors
  };
}

export async function validateGoalSetAction(goals: Pick<Goal, "weightage">[]) {
  return validateGoalSet(goals);
}
