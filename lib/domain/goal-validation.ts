import { z } from "zod";
import type { Goal, GoalFormValues, GoalStatus } from "./types";

export const MAX_GOALS = 8;
export const MIN_WEIGHTAGE = 10;
export const REQUIRED_TOTAL_WEIGHTAGE = 100;

export const goalFormSchema = z.object({
  thrustArea: z.string().min(2, "Thrust area is required"),
  title: z.string().min(3, "Goal title is required"),
  description: z.string().min(10, "Add a little more detail"),
  uom: z.enum(["numeric", "percentage", "timeline", "zero_based"]),
  goalType: z.enum(["min", "max"]),
  target: z.string().min(1, "Target is required"),
  weightage: z.coerce
    .number()
    .min(MIN_WEIGHTAGE, "Each goal must be at least 10%")
    .max(100, "Weightage cannot exceed 100%")
});

export type GoalValidationResult = {
  canSubmit: boolean;
  totalWeightage: number;
  issues: string[];
};

export function isEmployeeEditableStatus(status: GoalStatus) {
  return status === "draft" || status === "rejected";
}

export function getTotalWeightage(goals: Pick<Goal, "weightage">[]) {
  return goals.reduce((total, goal) => total + Number(goal.weightage || 0), 0);
}

export function validateGoalSet(goals: Pick<Goal, "weightage">[]): GoalValidationResult {
  const totalWeightage = getTotalWeightage(goals);
  const issues: string[] = [];

  if (goals.length === 0) issues.push("Add at least one goal.");
  if (goals.length > MAX_GOALS) issues.push(`You can add up to ${MAX_GOALS} goals.`);
  if (goals.some((goal) => goal.weightage < MIN_WEIGHTAGE)) {
    issues.push(`Every goal must have at least ${MIN_WEIGHTAGE}% weightage.`);
  }
  if (totalWeightage !== REQUIRED_TOTAL_WEIGHTAGE) {
    issues.push("Total weightage must equal exactly 100%.");
  }

  return {
    canSubmit: issues.length === 0,
    totalWeightage,
    issues
  };
}

export function emptyGoalForm(): GoalFormValues {
  return {
    thrustArea: "",
    title: "",
    description: "",
    uom: "numeric",
    goalType: "max",
    target: "",
    weightage: 10
  };
}
