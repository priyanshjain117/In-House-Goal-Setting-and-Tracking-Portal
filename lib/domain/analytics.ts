import { getLatestAchievement, getWeightedProgress, quarters } from "./progress";
import type { AchievementUpdate, Goal, GoalStatus, GoalUom, ManagerReview, Role, User } from "./types";

export type ActivityItem = {
  id: string;
  label: string;
  detail: string;
  timestamp: string;
};

export type ExportRow = {
  employee: string;
  email: string;
  goal: string;
  thrustArea: string;
  status: string;
  uom: string;
  target: string;
  weightage: number;
  quarter: string;
  actual: string;
  progress: string | number;
  achievementStatus: string;
};

const statusOrder: GoalStatus[] = ["draft", "submitted", "approved", "rejected"];
const uomOrder: GoalUom[] = ["numeric", "percentage", "timeline", "zero_based"];

export function getVisibleGoals(role: Role, currentUser: User, users: User[], goals: Goal[]) {
  if (role === "employee") {
    return goals.filter((goal) => goal.ownerId === currentUser.id);
  }

  if (role === "manager") {
    const teamIds = new Set(users.filter((user) => user.managerId === currentUser.id).map((user) => user.id));
    return goals.filter((goal) => teamIds.has(goal.ownerId));
  }

  return goals;
}

export function buildDashboardAnalytics(role: Role, currentUser: User, users: User[], goals: Goal[], achievements: AchievementUpdate[]) {
  const visibleGoals = getVisibleGoals(role, currentUser, users, goals);
  const approvedGoals = visibleGoals.filter((goal) => goal.status === "approved");
  const pendingGoals = visibleGoals.filter((goal) => goal.status === "submitted");
  const weightedProgress = getWeightedProgress(approvedGoals, achievements);
  const completionRate = approvedGoals.length
    ? Math.round(
        (approvedGoals.filter((goal) => getLatestAchievement(goal.id, achievements)?.status === "completed").length / approvedGoals.length) * 100
      )
    : 0;

  const statusDistribution = statusOrder.map((status) => ({
    name: formatStatus(status),
    value: visibleGoals.filter((goal) => goal.status === status).length
  }));

  const uomDistribution = uomOrder.map((uom) => ({
    name: formatUom(uom),
    value: visibleGoals.filter((goal) => goal.uom === uom).length
  }));

  const quarterlyTrend = quarters.map((quarter) => {
    const quarterUpdates = achievements.filter((achievement) =>
      visibleGoals.some((goal) => goal.id === achievement.goalId) && achievement.quarter === quarter
    );
    const average = quarterUpdates.length
      ? Math.round(quarterUpdates.reduce((total, achievement) => total + achievement.progressPercent, 0) / quarterUpdates.length)
      : 0;

    return {
      quarter,
      progress: average,
      checkIns: quarterUpdates.length
    };
  });

  const ownerCards = users
    .filter((user) => {
      if (role === "manager") return user.managerId === currentUser.id;
      if (role === "admin") return user.role === "employee";
      return user.id === currentUser.id;
    })
    .map((user) => {
      const userGoals = goals.filter((goal) => goal.ownerId === user.id);
      const userApprovedGoals = userGoals.filter((goal) => goal.status === "approved");
      return {
        id: user.id,
        name: user.name,
        total: userGoals.length,
        pending: userGoals.filter((goal) => goal.status === "submitted").length,
        approved: userApprovedGoals.length,
        progress: getWeightedProgress(userApprovedGoals, achievements)
      };
    });

  return {
    visibleGoals,
    approvedGoals,
    pendingGoals,
    totalGoals: visibleGoals.length,
    approvedCount: approvedGoals.length,
    pendingCount: pendingGoals.length,
    lockedCount: visibleGoals.filter((goal) => goal.locked).length,
    weightedProgress,
    completionRate,
    statusDistribution,
    uomDistribution,
    quarterlyTrend,
    ownerCards
  };
}

export function buildActivityFeed(users: User[], goals: Goal[], reviews: ManagerReview[], achievements: AchievementUpdate[]): ActivityItem[] {
  const goalActivity = goals.map<ActivityItem>((goal) => ({
    id: `goal-${goal.id}`,
    label: `${findUserName(users, goal.ownerId)} updated goal`,
    detail: `${goal.title} is ${formatStatus(goal.status).toLowerCase()}`,
    timestamp: goal.updatedAt
  }));

  const reviewActivity = reviews.map<ActivityItem>((review) => ({
    id: `review-${review.id}`,
    label: `${findUserName(users, review.managerId)} ${review.status} goals`,
    detail: review.comment || "Manager review completed",
    timestamp: review.createdAt
  }));

  const achievementActivity = achievements.map<ActivityItem>((achievement) => ({
    id: `achievement-${achievement.id}`,
    label: `${findUserName(users, achievement.employeeId)} updated ${achievement.quarter}`,
    detail: `${achievement.progressPercent}% progress · ${achievement.status.replace("_", " ")}`,
    timestamp: achievement.updatedAt
  }));

  return [...goalActivity, ...reviewActivity, ...achievementActivity]
    .sort((a, b) => b.timestamp.localeCompare(a.timestamp))
    .slice(0, 8);
}

export function buildExportRows(users: User[], goals: Goal[], achievements: AchievementUpdate[]): ExportRow[] {
  return goals.flatMap<ExportRow>((goal) => {
    const owner = users.find((user) => user.id === goal.ownerId);
    const goalAchievements = achievements.filter((achievement) => achievement.goalId === goal.id);

    if (!goalAchievements.length) {
      return [
        {
          employee: owner?.name ?? "Unknown",
          email: owner?.email ?? "",
          goal: goal.title,
          thrustArea: goal.thrustArea,
          status: goal.status,
          uom: goal.uom,
          target: goal.target,
          weightage: goal.weightage,
          quarter: "",
          actual: "",
          progress: "",
          achievementStatus: ""
        }
      ];
    }

    return goalAchievements.map((achievement) => ({
      employee: owner?.name ?? "Unknown",
      email: owner?.email ?? "",
      goal: goal.title,
      thrustArea: goal.thrustArea,
      status: goal.status,
      uom: goal.uom,
      target: goal.target,
      weightage: goal.weightage,
      quarter: achievement.quarter,
      actual: achievement.actualValue,
      progress: achievement.progressPercent,
      achievementStatus: achievement.status
    }));
  });
}

function findUserName(users: User[], userId: string) {
  return users.find((user) => user.id === userId)?.name ?? "Someone";
}

function formatStatus(status: GoalStatus) {
  const labels: Record<GoalStatus, string> = {
    draft: "Draft",
    submitted: "Pending",
    approved: "Approved",
    rejected: "Returned"
  };
  return labels[status];
}

function formatUom(uom: GoalUom) {
  const labels: Record<GoalUom, string> = {
    numeric: "Numeric",
    percentage: "%",
    timeline: "Timeline",
    zero_based: "Zero-based"
  };
  return labels[uom];
}
