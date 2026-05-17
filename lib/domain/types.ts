export type Role = "employee" | "manager" | "admin";

export type GoalStatus = "draft" | "submitted" | "approved" | "rejected";
export type GoalUom = "numeric" | "percentage" | "timeline" | "zero_based";
export type GoalType = "min" | "max";
export type GoalProgressStatus = "not_started" | "on_track" | "completed";
export type Quarter = "Q1" | "Q2" | "Q3" | "Q4";

export interface User {
  id: string;
  authUserId?: string;
  name: string;
  email: string;
  role: Role;
  managerId?: string | null;
  department?: string | null;
  title?: string | null;
  createdAt?: string;
}

export interface Goal {
  id: string;
  ownerId: string;
  sharedGoalGroupId?: string | null;
  primaryOwnerId?: string | null;
  thrustArea: string;
  title: string;
  description: string;
  uom: GoalUom;
  goalType: GoalType;
  target: string;
  weightage: number;
  status: GoalStatus;
  locked: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface AuthProfile {
  id: string;
  name: string;
  email: string;
  role: Role;
  managerId: string | null;
  createdAt: string;
}

export interface ManagerReview {
  id: string;
  goalId: string;
  managerId: string;
  status: "approved" | "rejected";
  comment: string;
  createdAt: string;
}

export interface GoalFormValues {
  thrustArea: string;
  title: string;
  description: string;
  uom: GoalUom;
  goalType: GoalType;
  target: string;
  weightage: number;
}

export interface AchievementUpdate {
  id: string;
  goalId: string;
  employeeId: string;
  quarter: Quarter;
  actualValue: string;
  status: GoalProgressStatus;
  employeeComment: string;
  managerComment: string;
  progressPercent: number;
  createdAt: string;
  updatedAt: string;
}

export interface AchievementFormValues {
  quarter: Quarter;
  actualValue: string;
  status: GoalProgressStatus;
  employeeComment: string;
  managerComment: string;
}

export type NotificationEventType = "goal_submitted" | "goals_approved" | "goals_rejected" | "quarterly_checkin_reminder";

export interface NotificationItem {
  id: string;
  recipientId: string;
  actorId: string | null;
  eventType: NotificationEventType;
  title: string;
  message: string;
  ctaHref: string | null;
  readAt: string | null;
  createdAt: string;
}
