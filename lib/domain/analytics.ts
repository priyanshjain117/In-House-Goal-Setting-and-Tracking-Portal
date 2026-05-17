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
const goalTypeOrder = ["min", "max"] as const;

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

export function buildDashboardAnalytics(
  role: Role,
  currentUser: User,
  users: User[],
  goals: Goal[],
  reviews: ManagerReview[],
  achievements: AchievementUpdate[]
) {
  const visibleGoals = getVisibleGoals(role, currentUser, users, goals);
  const visibleGoalIds = new Set(visibleGoals.map((goal) => goal.id));
  const visibleAchievements = achievements.filter((achievement) => visibleGoalIds.has(achievement.goalId));
  const approvedGoals = visibleGoals.filter((goal) => goal.status === "approved");
  const pendingGoals = visibleGoals.filter((goal) => goal.status === "submitted");
  const lockedGoals = visibleGoals.filter((goal) => goal.locked);
  const unlockedGoals = visibleGoals.filter((goal) => !goal.locked);
  const uniqueCheckedInGoalIds = new Set(visibleAchievements.map((achievement) => achievement.goalId));
  const weightedProgress = getWeightedProgress(approvedGoals, achievements);
  const completionRate = approvedGoals.length
    ? Math.round(
        (approvedGoals.filter((goal) => getLatestAchievement(goal.id, achievements)?.status === "completed").length / approvedGoals.length) * 100
      )
    : 0;
  const checkInCompletionRate = approvedGoals.length
    ? Math.round((approvedGoals.filter((goal) => uniqueCheckedInGoalIds.has(goal.id)).length / approvedGoals.length) * 100)
    : 0;
  const pendingCheckIns = Math.max(approvedGoals.length - approvedGoals.filter((goal) => uniqueCheckedInGoalIds.has(goal.id)).length, 0);

  const statusDistribution = statusOrder.map((status) => ({
    name: formatStatus(status),
    value: visibleGoals.filter((goal) => goal.status === status).length
  }));

  const uomDistribution = uomOrder.map((uom) => ({
    name: formatUom(uom),
    value: visibleGoals.filter((goal) => goal.uom === uom).length
  }));

  const goalTypeDistribution = goalTypeOrder.map((goalType) => ({
    name: goalType === "min" ? "Minimize gap / hit minimum" : "Stay below maximum",
    value: visibleGoals.filter((goal) => goal.goalType === goalType).length
  }));

  const thrustAreaDistribution = groupCount(visibleGoals.map((goal) => goal.thrustArea || "Unassigned"));
  const departmentDistribution = groupCount(
    visibleGoals.map((goal) => departmentForUser(users.find((user) => user.id === goal.ownerId), goals))
  );

  const quarterlyTrend = quarters.map((quarter) => {
    const quarterUpdates = visibleAchievements.filter((achievement) => achievement.quarter === quarter);
    const average = quarterUpdates.length
      ? Math.round(quarterUpdates.reduce((total, achievement) => total + achievement.progressPercent, 0) / quarterUpdates.length)
      : 0;
    const completed = quarterUpdates.filter((achievement) => achievement.status === "completed").length;
    const completion = quarterUpdates.length ? Math.round((completed / quarterUpdates.length) * 100) : 0;

    return {
      quarter,
      progress: average,
      completion,
      completed,
      checkIns: quarterUpdates.length
    };
  });
  const trendDelta = quarterlyTrend.length > 1 ? quarterlyTrend.at(-1)!.progress - quarterlyTrend.at(-2)!.progress : 0;

  const visibleUsers = users.filter((user) => {
    if (role === "employee") return user.id === currentUser.id;
    if (role === "manager") return user.managerId === currentUser.id;
    return user.role === "employee";
  });

  const ownerCards = visibleUsers
    .map((user) => {
      const userGoals = goals.filter((goal) => goal.ownerId === user.id);
      const userApprovedGoals = userGoals.filter((goal) => goal.status === "approved");
      const userAchievements = achievements.filter((achievement) => userGoals.some((goal) => goal.id === achievement.goalId));
      return {
        id: user.id,
        name: user.name,
        department: departmentForUser(user, goals),
        total: userGoals.length,
        pending: userGoals.filter((goal) => goal.status === "submitted").length,
        approved: userApprovedGoals.length,
        completed: userApprovedGoals.filter((goal) => getLatestAchievement(goal.id, achievements)?.status === "completed").length,
        checkIns: userAchievements.length,
        progress: getWeightedProgress(userApprovedGoals, achievements)
      };
    });

  const progressRows = ownerCards
    .map((owner) => ({
      ...owner,
      completionRate: owner.approved ? Math.round((owner.completed / owner.approved) * 100) : 0
    }))
    .sort((a, b) => b.progress - a.progress);

  const heatmapRows = visibleUsers.map((user) => {
    const userGoals = goals.filter((goal) => goal.ownerId === user.id);
    const cells = quarters.map((quarter) => {
      const quarterUpdates = achievements.filter(
        (achievement) => achievement.quarter === quarter && userGoals.some((goal) => goal.id === achievement.goalId)
      );
      const progress = quarterUpdates.length
        ? Math.round(quarterUpdates.reduce((total, achievement) => total + achievement.progressPercent, 0) / quarterUpdates.length)
        : 0;
      return {
        quarter,
        progress,
        checkIns: quarterUpdates.length,
        completed: quarterUpdates.filter((achievement) => achievement.status === "completed").length
      };
    });
    return {
      id: user.id,
      name: user.name,
      department: departmentForUser(user, goals),
      cells
    };
  });

  const managerEffectiveness = users
    .filter((user) => user.role === "manager" && (role === "admin" || user.id === currentUser.id))
    .map((manager) => {
      const team = users.filter((user) => user.managerId === manager.id);
      const teamIds = new Set(team.map((user) => user.id));
      const teamGoals = goals.filter((goal) => teamIds.has(goal.ownerId));
      const teamApproved = teamGoals.filter((goal) => goal.status === "approved");
      const teamSubmitted = teamGoals.filter((goal) => goal.status === "submitted");
      const teamAchievements = achievements.filter((achievement) => teamGoals.some((goal) => goal.id === achievement.goalId));
      const reviewedGoalIds = new Set(reviews.filter((review) => teamGoals.some((goal) => goal.id === review.goalId)).map((review) => review.goalId));
      const approvalTurnaroundDays = averageApprovalDays(teamGoals, reviews);
      const checkInRate = teamApproved.length
        ? Math.round((teamApproved.filter((goal) => teamAchievements.some((achievement) => achievement.goalId === goal.id)).length / teamApproved.length) * 100)
        : 0;
      const employeeCompletionRate = teamApproved.length
        ? Math.round(
            (teamApproved.filter((goal) => getLatestAchievement(goal.id, achievements)?.status === "completed").length / teamApproved.length) * 100
          )
        : 0;
      const score = Math.round(checkInRate * 0.4 + employeeCompletionRate * 0.4 + Math.max(0, 100 - approvalTurnaroundDays * 10) * 0.2);

      return {
        id: manager.id,
        name: manager.name,
        teamSize: team.length,
        totalGoals: teamGoals.length,
        pendingApprovals: teamSubmitted.length,
        reviewedGoals: reviewedGoalIds.size,
        approvalTurnaroundDays,
        checkInRate,
        employeeCompletionRate,
        score
      };
    })
    .sort((a, b) => b.score - a.score);

  const departmentTrend = groupByDepartment(visibleUsers, goals, achievements);
  const stackedStatusByDepartment = departmentTrend.map((department) => ({
    department: department.department,
    Draft: department.draft,
    Pending: department.submitted,
    Approved: department.approved,
    Returned: department.rejected
  }));

  return {
    visibleGoals,
    approvedGoals,
    pendingGoals,
    totalGoals: visibleGoals.length,
    approvedCount: approvedGoals.length,
    pendingCount: pendingGoals.length,
    lockedCount: lockedGoals.length,
    unlockedCount: unlockedGoals.length,
    pendingCheckIns,
    completedReviews: visibleAchievements.length,
    checkInCompletionRate,
    weightedProgress,
    completionRate,
    trendDelta,
    statusDistribution,
    uomDistribution,
    goalTypeDistribution,
    thrustAreaDistribution,
    departmentDistribution,
    quarterlyTrend,
    ownerCards,
    progressRows,
    heatmapRows,
    managerEffectiveness,
    departmentTrend,
    stackedStatusByDepartment
  };
}

export function buildActivityFeed(users: User[], goals: Goal[], reviews: ManagerReview[], achievements: AchievementUpdate[]): ActivityItem[] {
  const goalIds = new Set(goals.map((goal) => goal.id));
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

  const achievementActivity = achievements
    .filter((achievement) => goalIds.has(achievement.goalId))
    .map<ActivityItem>((achievement) => ({
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

function groupCount(values: string[]) {
  const counts = new Map<string, number>();
  values.forEach((value) => counts.set(value, (counts.get(value) ?? 0) + 1));
  return [...counts.entries()]
    .map(([name, value]) => ({ name, value }))
    .sort((a, b) => b.value - a.value || a.name.localeCompare(b.name));
}

function departmentForUser(user: User | undefined, goals: Goal[]) {
  if (user?.department) return user.department;
  if (!user) return "Unassigned";

  const userGoals = goals.filter((goal) => goal.ownerId === user.id);
  const topThrustArea = groupCount(userGoals.map((goal) => goal.thrustArea))[0]?.name;
  if (!topThrustArea) return user.role === "manager" ? "Business Excellence" : "People Systems";

  const departmentMap: Record<string, string> = {
    "Revenue Growth": "Revenue Operations",
    "Customer Experience": "Customer Experience",
    Reliability: "Operations",
    "Capability Building": "People Enablement",
    Planning: "Supply Chain",
    "Operational Efficiency": "Supply Chain",
    Execution: "Program Management",
    Quality: "Quality",
    "Channel Growth": "Revenue Operations"
  };
  return departmentMap[topThrustArea] ?? topThrustArea;
}

function averageApprovalDays(goals: Goal[], reviews: ManagerReview[]) {
  const durations = reviews
    .map((review) => {
      const goal = goals.find((candidate) => candidate.id === review.goalId);
      if (!goal) return null;
      const started = new Date(goal.createdAt).getTime();
      const reviewed = new Date(review.createdAt).getTime();
      if (Number.isNaN(started) || Number.isNaN(reviewed) || reviewed < started) return null;
      return (reviewed - started) / 86_400_000;
    })
    .filter((duration): duration is number => duration !== null);

  if (!durations.length) return 0;
  return Number((durations.reduce((total, duration) => total + duration, 0) / durations.length).toFixed(1));
}

function groupByDepartment(users: User[], goals: Goal[], achievements: AchievementUpdate[]) {
  return groupCount(users.map((user) => departmentForUser(user, goals))).map(({ name }) => {
    const departmentUsers = users.filter((user) => departmentForUser(user, goals) === name);
    const userIds = new Set(departmentUsers.map((user) => user.id));
    const departmentGoals = goals.filter((goal) => userIds.has(goal.ownerId));
    const approved = departmentGoals.filter((goal) => goal.status === "approved");

    return {
      department: name,
      goals: departmentGoals.length,
      draft: departmentGoals.filter((goal) => goal.status === "draft").length,
      submitted: departmentGoals.filter((goal) => goal.status === "submitted").length,
      approved: approved.length,
      rejected: departmentGoals.filter((goal) => goal.status === "rejected").length,
      progress: getWeightedProgress(approved, achievements)
    };
  });
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
