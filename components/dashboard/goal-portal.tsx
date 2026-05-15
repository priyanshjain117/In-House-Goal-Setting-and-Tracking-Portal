"use client";

import { BarChart3, CheckCircle2, ClipboardList, FileLock2, LayoutDashboard, Plus, ShieldCheck, Users } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { GoalFormDialog } from "@/components/goals/goal-form-dialog";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Toast, ToastDescription, ToastProvider, ToastTitle, ToastViewport } from "@/components/ui/toast";
import { seedUsers } from "@/lib/data/seed";
import { MAX_GOALS, validateGoalSet } from "@/lib/domain/goal-validation";
import type { Goal, GoalFormValues, Role, User } from "@/lib/domain/types";
import { cn } from "@/lib/utils";
import {
  createGoal,
  decideEmployeeGoals,
  loadGoals,
  loadReviews,
  saveGoals,
  saveReviews,
  submitEmployeeGoals,
  updateGoal
} from "@/lib/services/goal-service";
import { StatusBadge } from "./status-badge";

const roleCopy: Record<Role, { title: string; subtitle: string }> = {
  employee: {
    title: "My Goals",
    subtitle: "Draft, validate, and submit measurable goals for approval."
  },
  manager: {
    title: "Team Review Queue",
    subtitle: "Monitor submitted plans, tune targets, and complete approvals."
  },
  admin: {
    title: "Governance Console",
    subtitle: "View goal health across users and unlock approved goals when needed."
  }
};

export function GoalPortal() {
  const [role, setRole] = useState<Role>("employee");
  const [goals, setGoals] = useState<Goal[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingGoal, setEditingGoal] = useState<Goal | null>(null);
  const [toast, setToast] = useState<{ title: string; description: string } | null>(null);

  useEffect(() => {
    setGoals(loadGoals());
    loadReviews();
    setLoaded(true);
  }, []);

  const currentUser = seedUsers.find((user) => user.role === role) as User;
  const employee = seedUsers.find((user) => user.id === "u_employee") as User;
  const employeeGoals = goals.filter((goal) => goal.ownerId === employee.id);
  const validation = validateGoalSet(employeeGoals);

  function persist(nextGoals: Goal[]) {
    setGoals(nextGoals);
    saveGoals(nextGoals);
  }

  function notify(title: string, description: string) {
    setToast({ title, description });
  }

  function saveGoal(values: GoalFormValues) {
    if (editingGoal) {
      persist(goals.map((goal) => (goal.id === editingGoal.id ? updateGoal(goal, values) : goal)));
      notify("Goal updated", "The draft goal has been saved.");
      return;
    }
    if (employeeGoals.length >= MAX_GOALS) {
      notify("Goal limit reached", `Employees can create up to ${MAX_GOALS} goals.`);
      return;
    }
    persist([...goals, createGoal(employee.id, values)]);
    notify("Goal created", "The new goal is ready in draft.");
  }

  function removeGoal(goalId: string) {
    persist(goals.filter((goal) => goal.id !== goalId));
    notify("Goal deleted", "The draft goal was removed.");
  }

  function submitGoals() {
    persist(submitEmployeeGoals(goals, employee.id));
    notify("Submitted for approval", "Your manager can now review these goals.");
  }

  if (!loaded) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="rounded-xl border bg-card px-5 py-4 text-sm shadow-soft">Loading workspace...</div>
      </div>
    );
  }

  return (
    <ToastProvider>
      <div className="min-h-screen bg-background">
        <aside className="fixed inset-y-0 left-0 hidden w-64 border-r bg-card px-4 py-5 lg:block">
          <div className="mb-8 flex items-center gap-3 px-2">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary text-primary-foreground">
              <LayoutDashboard className="h-5 w-5" />
            </div>
            <div>
              <p className="font-semibold">GoalOS</p>
              <p className="text-xs text-muted-foreground">Phase 1 MVP</p>
            </div>
          </div>
          <nav className="grid gap-1 text-sm">
            {[
              ["Dashboard", LayoutDashboard],
              ["Goals", ClipboardList],
              ["Reviews", CheckCircle2],
              ["Governance", ShieldCheck]
            ].map(([label, Icon]) => (
              <button
                key={label as string}
                className="flex items-center gap-3 rounded-lg px-3 py-2 text-left text-muted-foreground hover:bg-muted hover:text-foreground"
              >
                <Icon className="h-4 w-4" />
                {label as string}
              </button>
            ))}
          </nav>
        </aside>

        <main className="lg:pl-64">
          <header className="sticky top-0 z-20 border-b bg-background/85 px-4 py-3 backdrop-blur sm:px-6">
            <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
              <div>
                <h1 className="text-xl font-semibold">{roleCopy[role].title}</h1>
                <p className="text-sm text-muted-foreground">{roleCopy[role].subtitle}</p>
              </div>
              <div className="flex items-center gap-3">
                <Select value={role} onValueChange={(value: Role) => setRole(value)}>
                  <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="employee">Employee</SelectItem>
                    <SelectItem value="manager">Manager</SelectItem>
                    <SelectItem value="admin">Admin</SelectItem>
                  </SelectContent>
                </Select>
                <div className="hidden text-right text-sm sm:block">
                  <p className="font-medium">{currentUser.name}</p>
                  <p className="text-xs text-muted-foreground">{currentUser.title}</p>
                </div>
              </div>
            </div>
          </header>

          <section className="grid gap-6 px-4 py-6 sm:px-6">
            <MetricGrid goals={goals} role={role} />
            {role === "employee" ? (
              <EmployeeDashboard
                goals={employeeGoals}
                validation={validation}
                onCreate={() => {
                  setEditingGoal(null);
                  setDialogOpen(true);
                }}
                onEdit={(goal) => {
                  setEditingGoal(goal);
                  setDialogOpen(true);
                }}
                onDelete={removeGoal}
                onSubmit={submitGoals}
              />
            ) : null}
            {role === "manager" ? (
              <ManagerDashboard goals={goals} setGoals={persist} notify={notify} />
            ) : null}
            {role === "admin" ? <AdminDashboard goals={goals} setGoals={persist} notify={notify} /> : null}
          </section>
        </main>
      </div>

      <GoalFormDialog open={dialogOpen} goal={editingGoal} onOpenChange={setDialogOpen} onSubmit={saveGoal} />
      {toast ? (
        <Toast open onOpenChange={(open) => !open && setToast(null)}>
          <ToastTitle className="font-semibold">{toast.title}</ToastTitle>
          <ToastDescription className="text-muted-foreground">{toast.description}</ToastDescription>
        </Toast>
      ) : null}
      <ToastViewport />
    </ToastProvider>
  );
}

function MetricGrid({ goals, role }: { goals: Goal[]; role: Role }) {
  const approved = goals.filter((goal) => goal.status === "approved").length;
  const submitted = goals.filter((goal) => goal.status === "submitted").length;
  const locked = goals.filter((goal) => goal.locked).length;
  const cards = [
    { label: role === "employee" ? "My Goals" : "Total Goals", value: goals.length, icon: ClipboardList },
    { label: "Submitted", value: submitted, icon: BarChart3 },
    { label: "Approved", value: approved, icon: CheckCircle2 },
    { label: "Locked", value: locked, icon: FileLock2 }
  ];

  return (
    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
      {cards.map(({ label, value, icon: Icon }) => (
        <Card key={label}>
          <CardContent className="flex items-center justify-between p-5">
            <div>
              <p className="text-sm text-muted-foreground">{label}</p>
              <p className="mt-1 text-3xl font-semibold">{value}</p>
            </div>
            <div className="rounded-xl bg-accent p-3 text-accent-foreground">
              <Icon className="h-5 w-5" />
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

function EmployeeDashboard({
  goals,
  validation,
  onCreate,
  onEdit,
  onDelete,
  onSubmit
}: {
  goals: Goal[];
  validation: ReturnType<typeof validateGoalSet>;
  onCreate: () => void;
  onEdit: (goal: Goal) => void;
  onDelete: (goalId: string) => void;
  onSubmit: () => void;
}) {
  const locked = goals.some((goal) => goal.locked);
  return (
    <div className="grid gap-6 xl:grid-cols-[1fr_340px]">
      <Card>
        <CardHeader className="flex-row items-center justify-between">
          <div>
            <CardTitle>Goal plan</CardTitle>
            <p className="text-sm text-muted-foreground">Up to 8 goals, each with at least 10% weightage.</p>
          </div>
          <Button onClick={onCreate} disabled={locked || goals.length >= MAX_GOALS}>
            <Plus className="h-4 w-4" />
            New Goal
          </Button>
        </CardHeader>
        <CardContent>
          <GoalTable goals={goals} onEdit={onEdit} onDelete={onDelete} editable={!locked} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Submission health</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4">
          <div>
            <div className="mb-2 flex justify-between text-sm">
              <span className="text-muted-foreground">Total weightage</span>
              <span className={cn("font-medium", validation.totalWeightage === 100 ? "text-emerald-700" : "text-slate-700")}>
                {validation.totalWeightage}%
              </span>
            </div>
            <Progress value={Math.min(validation.totalWeightage, 100)} />
          </div>
          {validation.issues.length ? (
            <div className="rounded-xl bg-amber-50 p-3 text-sm text-amber-800">
              {validation.issues.map((issue) => (
                <p key={issue}>{issue}</p>
              ))}
            </div>
          ) : (
            <div className="rounded-xl bg-emerald-50 p-3 text-sm text-emerald-800">Ready for manager approval.</div>
          )}
          <Button disabled={!validation.canSubmit || locked} onClick={onSubmit}>
            Submit goals
          </Button>
          {locked ? <p className="text-sm text-muted-foreground">Approved goals are locked for employees.</p> : null}
        </CardContent>
      </Card>
    </div>
  );
}

function GoalTable({
  goals,
  editable,
  onEdit,
  onDelete
}: {
  goals: Goal[];
  editable: boolean;
  onEdit?: (goal: Goal) => void;
  onDelete?: (goalId: string) => void;
}) {
  if (!goals.length) {
    return (
      <div className="flex min-h-56 flex-col items-center justify-center rounded-xl border border-dashed bg-muted/30 p-8 text-center">
        <ClipboardList className="mb-3 h-8 w-8 text-muted-foreground" />
        <p className="font-medium">No goals yet</p>
        <p className="text-sm text-muted-foreground">Create draft goals to begin the approval workflow.</p>
      </div>
    );
  }
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[820px] text-left text-sm">
        <thead className="border-b text-xs uppercase text-muted-foreground">
          <tr>
            <th className="py-3 pr-4">Goal</th>
            <th className="py-3 pr-4">UoM</th>
            <th className="py-3 pr-4">Target</th>
            <th className="py-3 pr-4">Weight</th>
            <th className="py-3 pr-4">Status</th>
            <th className="py-3 text-right">Actions</th>
          </tr>
        </thead>
        <tbody className="divide-y">
          {goals.map((goal) => (
            <tr key={goal.id} className="align-top">
              <td className="py-4 pr-4">
                <p className="font-medium">{goal.title}</p>
                <p className="text-xs text-muted-foreground">{goal.thrustArea}</p>
              </td>
              <td className="py-4 pr-4 capitalize">{goal.uom.replace("_", " ")}</td>
              <td className="py-4 pr-4">{goal.target}</td>
              <td className="py-4 pr-4">{goal.weightage}%</td>
              <td className="py-4 pr-4"><StatusBadge status={goal.status} /></td>
              <td className="py-4 text-right">
                <div className="flex justify-end gap-2">
                  <Button size="sm" variant="outline" disabled={!editable || goal.status !== "draft"} onClick={() => onEdit?.(goal)}>
                    Edit
                  </Button>
                  <Button size="sm" variant="ghost" disabled={!editable || goal.status !== "draft"} onClick={() => onDelete?.(goal.id)}>
                    Delete
                  </Button>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function ManagerDashboard({
  goals,
  setGoals,
  notify
}: {
  goals: Goal[];
  setGoals: (goals: Goal[]) => void;
  notify: (title: string, description: string) => void;
}) {
  const submittedOwners = useMemo(() => {
    const ownerIds = new Set(goals.filter((goal) => goal.status === "submitted").map((goal) => goal.ownerId));
    return seedUsers.filter((user) => ownerIds.has(user.id));
  }, [goals]);
  const [comment, setComment] = useState("Looks aligned to the quarter priorities.");

  function updateInline(goalId: string, patch: Partial<Pick<Goal, "target" | "weightage">>) {
    setGoals(goals.map((goal) => (goal.id === goalId ? { ...goal, ...patch, updatedAt: new Date().toISOString() } : goal)));
  }

  function decide(ownerId: string, status: "approved" | "rejected") {
    const result = decideEmployeeGoals(goals, loadReviews(), ownerId, "u_manager", status, comment);
    setGoals(result.updatedGoals);
    saveReviews(result.updatedReviews);
    notify(status === "approved" ? "Goals approved" : "Goals rejected", "The employee plan has been updated.");
  }

  if (!submittedOwners.length) {
    return <EmptyPanel icon={Users} title="No submitted goals" text="Team submissions will appear here for manager review." />;
  }

  return (
    <div className="grid gap-6">
      {submittedOwners.map((owner) => {
        const ownerGoals = goals.filter((goal) => goal.ownerId === owner.id && goal.status === "submitted");
        return (
          <Card key={owner.id}>
            <CardHeader className="flex-row items-start justify-between">
              <div>
                <CardTitle>{owner.name}</CardTitle>
                <p className="text-sm text-muted-foreground">{owner.department} · {owner.title}</p>
              </div>
              <StatusBadge status="submitted" />
            </CardHeader>
            <CardContent className="grid gap-4">
              <div className="overflow-x-auto">
                <table className="w-full min-w-[760px] text-left text-sm">
                  <thead className="border-b text-xs uppercase text-muted-foreground">
                    <tr>
                      <th className="py-3 pr-4">Goal</th>
                      <th className="py-3 pr-4">Type</th>
                      <th className="py-3 pr-4">Target</th>
                      <th className="py-3 pr-4">Weightage</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {ownerGoals.map((goal) => (
                      <tr key={goal.id}>
                        <td className="py-3 pr-4">
                          <p className="font-medium">{goal.title}</p>
                          <p className="text-xs text-muted-foreground">{goal.thrustArea}</p>
                        </td>
                        <td className="py-3 pr-4 uppercase">{goal.goalType}</td>
                        <td className="py-3 pr-4">
                          <Input value={goal.target} onChange={(event) => updateInline(goal.id, { target: event.target.value })} />
                        </td>
                        <td className="py-3 pr-4">
                          <Input
                            type="number"
                            min={10}
                            value={goal.weightage}
                            onChange={(event) => updateInline(goal.id, { weightage: Number(event.target.value) })}
                          />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <Textarea value={comment} onChange={(event) => setComment(event.target.value)} />
              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={() => decide(owner.id, "rejected")}>Reject</Button>
                <Button onClick={() => decide(owner.id, "approved")}>Approve</Button>
              </div>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}

function AdminDashboard({
  goals,
  setGoals,
  notify
}: {
  goals: Goal[];
  setGoals: (goals: Goal[]) => void;
  notify: (title: string, description: string) => void;
}) {
  function unlock(goalId: string) {
    setGoals(goals.map((goal) => (goal.id === goalId ? { ...goal, locked: false, status: "draft", updatedAt: new Date().toISOString() } : goal)));
    notify("Goal unlocked", "The employee can edit and resubmit this goal.");
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>All goals and users</CardTitle>
        <p className="text-sm text-muted-foreground">Administrative view for Phase 1 governance and exception handling.</p>
      </CardHeader>
      <CardContent>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[900px] text-left text-sm">
            <thead className="border-b text-xs uppercase text-muted-foreground">
              <tr>
                <th className="py-3 pr-4">User</th>
                <th className="py-3 pr-4">Department</th>
                <th className="py-3 pr-4">Goal</th>
                <th className="py-3 pr-4">Weight</th>
                <th className="py-3 pr-4">Status</th>
                <th className="py-3 pr-4">Locked</th>
                <th className="py-3 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {goals.map((goal) => {
                const owner = seedUsers.find((user) => user.id === goal.ownerId);
                return (
                  <tr key={goal.id}>
                    <td className="py-4 pr-4 font-medium">{owner?.name}</td>
                    <td className="py-4 pr-4 text-muted-foreground">{owner?.department}</td>
                    <td className="py-4 pr-4">{goal.title}</td>
                    <td className="py-4 pr-4">{goal.weightage}%</td>
                    <td className="py-4 pr-4"><StatusBadge status={goal.status} /></td>
                    <td className="py-4 pr-4">{goal.locked ? "Yes" : "No"}</td>
                    <td className="py-4 text-right">
                      <Button size="sm" variant="outline" disabled={!goal.locked} onClick={() => unlock(goal.id)}>
                        Unlock
                      </Button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  );
}

function EmptyPanel({ icon: Icon, title, text }: { icon: typeof Users; title: string; text: string }) {
  return (
    <Card>
      <CardContent className="flex min-h-72 flex-col items-center justify-center p-8 text-center">
        <Icon className="mb-3 h-9 w-9 text-muted-foreground" />
        <p className="font-medium">{title}</p>
        <p className="text-sm text-muted-foreground">{text}</p>
      </CardContent>
    </Card>
  );
}
