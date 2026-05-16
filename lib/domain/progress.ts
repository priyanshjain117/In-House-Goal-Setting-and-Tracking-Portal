import type { AchievementUpdate, Goal, GoalProgressStatus } from "./types";

export const quarters = ["Q1", "Q2", "Q3", "Q4"] as const;

export const progressStatusLabels: Record<GoalProgressStatus, string> = {
  not_started: "Not Started",
  on_track: "On Track",
  completed: "Completed"
};

export function parseMeasurement(value: string) {
  const match = value.match(/-?\d+(\.\d+)?/);
  return match ? Number(match[0]) : null;
}

export function calculateProgressPercent(goal: Pick<Goal, "goalType" | "target" | "uom">, actualValue: string, status: GoalProgressStatus) {
  if (status === "not_started" || actualValue.trim().length === 0) return 0;

  if (goal.uom === "timeline") {
    return calculateTimelineProgress(goal.target, actualValue, status);
  }

  if (goal.uom === "zero_based") {
    const actual = parseMeasurement(actualValue);
    return actual === 0 ? 100 : 0;
  }

  const target = parseMeasurement(goal.target);
  const actual = parseMeasurement(actualValue);

  if (!target || !actual || target <= 0 || actual < 0) return status === "completed" ? 100 : 0;

  const raw = goal.goalType === "min" ? (actual / target) * 100 : (target / actual) * 100;
  return clampProgress(raw);
}

export function getLatestAchievement(goalId: string, achievements: AchievementUpdate[]) {
  return achievements
    .filter((achievement) => achievement.goalId === goalId)
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))[0];
}

export function getWeightedProgress(goals: Goal[], achievements: AchievementUpdate[]) {
  const approvedGoals = goals.filter((goal) => goal.status === "approved");
  const totalWeight = approvedGoals.reduce((total, goal) => total + goal.weightage, 0);

  if (!approvedGoals.length || totalWeight === 0) return 0;

  const weighted = approvedGoals.reduce((total, goal) => {
    const latest = getLatestAchievement(goal.id, achievements);
    return total + (latest?.progressPercent ?? 0) * goal.weightage;
  }, 0);

  return Math.round(weighted / totalWeight);
}

function calculateTimelineProgress(targetValue: string, actualValue: string, status: GoalProgressStatus) {
  const targetDate = parseDate(targetValue);
  const actualDate = parseDate(actualValue);

  if (status === "completed") {
    if (!targetDate || !actualDate) return 100;
    return actualDate.getTime() <= targetDate.getTime() ? 100 : 0;
  }

  if (!targetDate) return status === "on_track" ? 50 : 0;
  return Date.now() <= targetDate.getTime() && status === "on_track" ? 50 : 0;
}

function parseDate(value: string) {
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function clampProgress(value: number) {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.min(100, Math.round(value)));
}
