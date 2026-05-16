export type Role = "employee" | "manager" | "admin";

export type GoalStatus = "draft" | "submitted" | "approved" | "rejected";
export type GoalUom = "numeric" | "percentage" | "timeline" | "zero_based";
export type GoalType = "min" | "max";

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
