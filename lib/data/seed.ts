import type { Goal, ManagerReview, User } from "@/lib/domain/types";

export const seedUsers: User[] = [
  {
    id: "u_employee",
    name: "Aarav Mehta",
    email: "aarav@atomberg.example",
    role: "employee",
    managerId: "u_manager",
    department: "Product Operations",
    title: "Senior Associate"
  },
  {
    id: "u_employee_2",
    name: "Nisha Rao",
    email: "nisha@atomberg.example",
    role: "employee",
    managerId: "u_manager",
    department: "Supply Chain",
    title: "Program Lead"
  },
  {
    id: "u_manager",
    name: "Meera Shah",
    email: "meera@atomberg.example",
    role: "manager",
    department: "Business Excellence",
    title: "Manager"
  },
  {
    id: "u_admin",
    name: "Kabir Sethi",
    email: "kabir@atomberg.example",
    role: "admin",
    department: "People Systems",
    title: "Admin"
  }
];

export const seedGoals: Goal[] = [
  {
    id: "g_1",
    ownerId: "u_employee",
    thrustArea: "Operational Excellence",
    title: "Reduce closure cycle time",
    description: "Improve cross-functional closure time for recurring product operations requests.",
    uom: "percentage",
    goalType: "max",
    target: "18% reduction",
    weightage: 30,
    status: "draft",
    locked: false,
    createdAt: "2026-04-01T09:00:00.000Z",
    updatedAt: "2026-04-01T09:00:00.000Z"
  },
  {
    id: "g_2",
    ownerId: "u_employee",
    thrustArea: "Customer Experience",
    title: "Improve escalation quality",
    description: "Increase first-pass acceptance for escalation notes and action plans.",
    uom: "percentage",
    goalType: "max",
    target: "92%",
    weightage: 25,
    status: "draft",
    locked: false,
    createdAt: "2026-04-02T09:00:00.000Z",
    updatedAt: "2026-04-02T09:00:00.000Z"
  },
  {
    id: "g_3",
    ownerId: "u_employee_2",
    thrustArea: "Planning",
    title: "Forecast adherence",
    description: "Maintain monthly forecast adherence for priority SKUs across channels.",
    uom: "percentage",
    goalType: "max",
    target: "95%",
    weightage: 60,
    status: "submitted",
    locked: false,
    createdAt: "2026-04-03T09:00:00.000Z",
    updatedAt: "2026-04-04T09:00:00.000Z"
  },
  {
    id: "g_4",
    ownerId: "u_employee_2",
    thrustArea: "Execution",
    title: "Launch readiness",
    description: "Complete readiness checklist for upcoming regional launch milestones.",
    uom: "timeline",
    goalType: "min",
    target: "Jun 30",
    weightage: 40,
    status: "submitted",
    locked: false,
    createdAt: "2026-04-03T09:00:00.000Z",
    updatedAt: "2026-04-04T09:00:00.000Z"
  }
];

export const seedReviews: ManagerReview[] = [];
