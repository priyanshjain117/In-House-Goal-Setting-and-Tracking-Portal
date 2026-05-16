"use client";

import {
  AlertCircle,
  BarChart3,
  CheckCircle2,
  ClipboardList,
  FileLock2,
  LayoutDashboard,
  Loader2,
  LogOut,
  Plus,
  ShieldCheck,
  Users
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { GoalFormDialog } from "@/components/goals/goal-form-dialog";
import { logoutAction } from "@/app/login/actions";
import { AchievementTracking } from "@/components/dashboard/achievement-tracking";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { Textarea } from "@/components/ui/textarea";
import { Toast, ToastDescription, ToastProvider, ToastTitle, ToastViewport } from "@/components/ui/toast";
import { seedUsers } from "@/lib/data/seed";
import { MAX_GOALS, isEmployeeEditableStatus, validateGoalSet } from "@/lib/domain/goal-validation";
import type { AchievementFormValues, AchievementUpdate, AuthProfile, Goal, GoalFormValues, ManagerReview, Role, User } from "@/lib/domain/types";
import { cn } from "@/lib/utils";
import {
  createGoal,
  decideEmployeeGoals,
  loadGoals,
  loadReviews,
  loadAchievements,
  resetWorkspaceData,
  saveAchievements,
  saveGoals,
  saveReviews,
  submitEmployeeGoals,
  updateGoal,
  upsertAchievement
} from "@/lib/services/goal-service";
import {
  decideSupabaseGoals,
  deleteSupabaseGoal,
  insertSupabaseGoal,
  loadSupabaseWorkspace,
  submitSupabaseGoals,
  unlockSupabaseGoal,
  upsertSupabaseAchievement,
  updateSupabaseGoal,
  updateSupabaseGoalFields
} from "@/lib/services/supabase-goal-service";
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

type GoalPortalProps = {
  initialRole?: Role;
  profile?: AuthProfile;
};

export function GoalPortal({ initialRole = "employee", profile }: GoalPortalProps) {
  const [role] = useState<Role>(initialRole);
  const [users, setUsers] = useState<User[]>(seedUsers);
  const [goals, setGoals] = useState<Goal[]>([]);
  const [reviews, setReviews] = useState<ManagerReview[]>([]);
  const [achievements, setAchievements] = useState<AchievementUpdate[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [startupError, setStartupError] = useState<string | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingGoal, setEditingGoal] = useState<Goal | null>(null);
  const [savingGoal, setSavingGoal] = useState(false);
  const [toast, setToast] = useState<{ title: string; description: string } | null>(null);
  const useSupabase = Boolean(profile);

  useEffect(() => {
    let isMounted = true;

    async function loadWorkspace() {
      try {
        if (useSupabase) {
          const workspace = await loadSupabaseWorkspace();
          if (!isMounted) return;
          setGoals(workspace.goals);
          setReviews(workspace.reviews);
          setAchievements(workspace.achievements);
          setUsers(workspace.users);
        } else {
          setGoals(loadGoals());
          setReviews(loadReviews());
          setAchievements(loadAchievements());
        }
      } catch (error) {
        if (!isMounted) return;
        setGoals([]);
        setReviews([]);
        setAchievements([]);
        setStartupError(error instanceof Error ? error.message : "Unable to load workspace data.");
      } finally {
        if (isMounted) setLoaded(true);
      }
    }

    loadWorkspace();

    return () => {
      isMounted = false;
    };
  }, [useSupabase]);

  const currentUser: User =
    profile ??
    (users.find((user) => user.role === role) as User) ??
    (seedUsers.find((user) => user.role === role) as User);
  const employee =
    role === "employee" ? currentUser : users.find((user) => user.role === "employee") ?? (seedUsers.find((user) => user.role === "employee") as User);
  const employeeGoals = goals.filter((goal) => goal.ownerId === employee.id);
  const validation = validateGoalSet(employeeGoals);
  const visibleMetricGoals = role === "employee" ? employeeGoals : goals;

  function persist(nextGoals: Goal[]) {
    try {
      setGoals(nextGoals);
      saveGoals(nextGoals);
    } catch (error) {
      notify("Unable to save", error instanceof Error ? error.message : "Please try again.");
    }
  }

  function notify(title: string, description: string) {
    setToast({ title, description });
  }

  function resetDemoData() {
    try {
      resetWorkspaceData();
      setGoals(loadGoals());
      setReviews(loadReviews());
      setAchievements(loadAchievements());
      setStartupError(null);
      notify("Workspace reset", "Demo data has been restored.");
    } catch (error) {
      notify("Reset failed", error instanceof Error ? error.message : "Please clear site data and reload.");
    }
  }

  async function saveGoal(values: GoalFormValues) {
    if (savingGoal) return false;
    setSavingGoal(true);

    try {
      if (editingGoal) {
        if (useSupabase) {
          const updatedGoal = await updateSupabaseGoal(editingGoal.id, values);
          setGoals((currentGoals) => currentGoals.map((goal) => (goal.id === updatedGoal.id ? updatedGoal : goal)));
        } else {
          persist(goals.map((goal) => (goal.id === editingGoal.id ? updateGoal(goal, values) : goal)));
        }
        setDialogOpen(false);
        setEditingGoal(null);
        notify("Goal updated", "The draft goal has been saved.");
        return true;
      }

      if (employeeGoals.length >= MAX_GOALS) {
        notify("Goal limit reached", `Employees can create up to ${MAX_GOALS} goals.`);
        return false;
      }

      if (useSupabase) {
        const newGoal = await insertSupabaseGoal(employee.id, values);
        setGoals((currentGoals) => [...currentGoals, newGoal]);
      } else {
        persist([...goals, createGoal(employee.id, values)]);
      }
      setDialogOpen(false);
      notify("Goal created", "The new goal is ready in draft.");
      return true;
    } catch (error) {
      notify("Unable to save goal", error instanceof Error ? error.message : "Please try again.");
      return false;
    } finally {
      setSavingGoal(false);
    }
  }

  async function removeGoal(goalId: string) {
    try {
      if (useSupabase) {
        await deleteSupabaseGoal(goalId);
        setGoals((currentGoals) => currentGoals.filter((goal) => goal.id !== goalId));
      } else {
        persist(goals.filter((goal) => goal.id !== goalId));
      }
      notify("Goal deleted", "The draft goal was removed.");
    } catch (error) {
      notify("Delete failed", error instanceof Error ? error.message : "Please try again.");
    }
  }

  async function submitGoals() {
    try {
      if (useSupabase) {
        const submittedGoals = await submitSupabaseGoals(employee.id);
        setGoals((currentGoals) =>
          currentGoals.map((goal) => submittedGoals.find((submittedGoal) => submittedGoal.id === goal.id) ?? goal)
        );
      } else {
        persist(submitEmployeeGoals(goals, employee.id));
      }
      notify("Submitted for approval", "Your manager can now review these goals.");
    } catch (error) {
      notify("Submit failed", error instanceof Error ? error.message : "Please try again.");
    }
  }

  async function saveAchievement(goal: Goal, values: AchievementFormValues) {
    try {
      if (useSupabase) {
        const savedAchievement = await upsertSupabaseAchievement(goal, values);
        setAchievements((currentAchievements) => {
          const exists = currentAchievements.some((achievement) => achievement.id === savedAchievement.id);
          return exists
            ? currentAchievements.map((achievement) => (achievement.id === savedAchievement.id ? savedAchievement : achievement))
            : [...currentAchievements, savedAchievement];
        });
      } else {
        const nextAchievements = upsertAchievement(achievements, goal, values);
        setAchievements(nextAchievements);
        saveAchievements(nextAchievements);
      }

      notify("Quarterly update saved", "Progress tracking has been updated.");
    } catch (error) {
      notify("Update failed", error instanceof Error ? error.message : "Please try again.");
    }
  }

  if (!loaded) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="flex items-center gap-3 rounded-xl border bg-card px-5 py-4 text-sm shadow-soft">
          <Loader2 className="h-4 w-4 animate-spin" />
          Loading workspace...
        </div>
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
                type="button"
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
                <div className="hidden text-right text-sm sm:block">
                  <p className="font-medium">{currentUser.name}</p>
                  <p className="text-xs capitalize text-muted-foreground">{currentUser.role === "admin" ? "Admin/HR" : currentUser.role}</p>
                </div>
                {profile ? (
                  <form action={logoutAction}>
                    <Button type="submit" variant="outline">
                      <LogOut className="h-4 w-4" />
                      Logout
                    </Button>
                  </form>
                ) : null}
              </div>
            </div>
          </header>

          <section className="grid gap-6 px-4 py-6 sm:px-6">
            {startupError ? (
              <Card className="border-amber-200 bg-amber-50">
                <CardContent className="flex flex-col gap-3 p-5 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <p className="font-medium text-amber-900">Workspace data could not be loaded</p>
                    <p className="text-sm text-amber-800">{startupError}</p>
                  </div>
                  <Button type="button" variant="outline" onClick={resetDemoData}>
                    Reset demo data
                  </Button>
                </CardContent>
              </Card>
            ) : null}
            <MetricGrid goals={visibleMetricGoals} role={role} />
            {role === "employee" ? (
              <EmployeeDashboard
                goals={employeeGoals}
                reviews={reviews}
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
              <ManagerDashboard
                goals={goals}
                users={users}
                currentUser={currentUser}
                setGoals={useSupabase ? setGoals : persist}
                reviews={reviews}
                setReviews={setReviews}
                notify={notify}
                useSupabase={useSupabase}
              />
            ) : null}
            {role === "admin" ? (
              <AdminDashboard goals={goals} users={users} reviews={reviews} setGoals={useSupabase ? setGoals : persist} notify={notify} useSupabase={useSupabase} />
            ) : null}
            <AchievementTracking
              role={role}
              currentUser={currentUser}
              users={users}
              goals={goals}
              achievements={achievements}
              onSave={saveAchievement}
            />
          </section>
        </main>
      </div>

      <GoalFormDialog open={dialogOpen} goal={editingGoal} isSaving={savingGoal} onOpenChange={setDialogOpen} onSubmit={saveGoal} />
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
  reviews,
  validation,
  onCreate,
  onEdit,
  onDelete,
  onSubmit
}: {
  goals: Goal[];
  reviews: ManagerReview[];
  validation: ReturnType<typeof validateGoalSet>;
  onCreate: () => void;
  onEdit: (goal: Goal) => void;
  onDelete: (goalId: string) => void;
  onSubmit: () => void;
}) {
  const hasSubmittedGoals = goals.some((goal) => goal.status === "submitted");
  const editableGoalCount = goals.filter((goal) => isEmployeeEditableStatus(goal.status) && !goal.locked).length;
  const canSubmit = validation.canSubmit && editableGoalCount > 0 && !hasSubmittedGoals;
  return (
    <div className="grid gap-6 xl:grid-cols-[1fr_340px]">
      <Card>
        <CardHeader className="flex-row items-center justify-between">
          <div>
            <CardTitle>Goal plan</CardTitle>
            <p className="text-sm text-muted-foreground">Up to 8 goals, each with at least 10% weightage.</p>
          </div>
          <Button onClick={onCreate} disabled={goals.length >= MAX_GOALS}>
            <Plus className="h-4 w-4" />
            New Goal
          </Button>
        </CardHeader>
        <CardContent>
          <GoalTable goals={goals} reviews={reviews} onEdit={onEdit} onDelete={onDelete} />
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
          {hasSubmittedGoals ? (
            <div className="rounded-xl bg-blue-50 p-3 text-sm text-blue-800">
              Submitted goals are with your manager. Returned goals can be edited and resubmitted.
            </div>
          ) : null}
          <Button disabled={!canSubmit} onClick={onSubmit}>
            Submit goals
          </Button>
          <p className="text-sm text-muted-foreground">Approved goals stay visible but locked. Admins can unlock exceptions.</p>
        </CardContent>
      </Card>
    </div>
  );
}

function GoalTable({
  goals,
  reviews,
  onEdit,
  onDelete
}: {
  goals: Goal[];
  reviews?: ManagerReview[];
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
          {goals.map((goal) => {
            const latestReview = reviews
              ?.filter((review) => review.goalId === goal.id)
              .sort((a, b) => b.createdAt.localeCompare(a.createdAt))[0];
            return (
              <tr key={goal.id} className="align-top">
                <td className="py-4 pr-4">
                  <p className="font-medium">{goal.title}</p>
                  <p className="text-xs text-muted-foreground">{goal.thrustArea}</p>
                  <p className="mt-1 line-clamp-2 max-w-md text-xs text-muted-foreground">{goal.description}</p>
                  {latestReview?.comment ? (
                    <p className="mt-2 rounded-lg bg-muted px-2 py-1 text-xs text-muted-foreground">
                      Manager comment: {latestReview.comment}
                    </p>
                  ) : null}
                </td>
                <td className="py-4 pr-4 capitalize">{goal.uom.replace("_", " ")}</td>
                <td className="py-4 pr-4">
                  <div className="flex flex-col gap-1">
                    <span>{goal.target}</span>
                    <span className="w-fit rounded-md bg-muted px-2 py-0.5 text-[11px] font-medium uppercase text-muted-foreground">
                      {goal.goalType}
                    </span>
                  </div>
                </td>
                <td className="py-4 pr-4">{goal.weightage}%</td>
                <td className="py-4 pr-4"><StatusBadge status={goal.status} /></td>
                <td className="py-4 text-right">
                  <div className="flex justify-end gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={goal.locked || !isEmployeeEditableStatus(goal.status)}
                      onClick={() => onEdit?.(goal)}
                    >
                      Edit
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      disabled={goal.locked || !isEmployeeEditableStatus(goal.status)}
                      onClick={() => onDelete?.(goal.id)}
                    >
                      Delete
                    </Button>
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function ManagerDashboard({
  goals,
  users,
  currentUser,
  setGoals,
  reviews,
  setReviews,
  notify,
  useSupabase
}: {
  goals: Goal[];
  users: User[];
  currentUser: User;
  setGoals: (goals: Goal[]) => void;
  reviews: ManagerReview[];
  setReviews: (reviews: ManagerReview[]) => void;
  notify: (title: string, description: string) => void;
  useSupabase: boolean;
}) {
  const submittedOwners = useMemo(() => {
    const ownerIds = new Set(goals.filter((goal) => goal.status === "submitted").map((goal) => goal.ownerId));
    return users.filter((user) => ownerIds.has(user.id) && user.managerId === currentUser.id);
  }, [currentUser.id, goals, users]);
  const [comment, setComment] = useState("Looks aligned to the quarter priorities.");

  async function updateInline(goalId: string, patch: Partial<Pick<Goal, "target" | "weightage">>) {
    const previousGoals = goals;
    const optimisticGoals = goals.map((goal) => (goal.id === goalId ? { ...goal, ...patch, updatedAt: new Date().toISOString() } : goal));
    setGoals(optimisticGoals);

    if (!useSupabase) return;

    try {
      const updatedGoal = await updateSupabaseGoalFields(goalId, patch);
      setGoals(optimisticGoals.map((goal) => (goal.id === updatedGoal.id ? updatedGoal : goal)));
    } catch (error) {
      setGoals(previousGoals);
      notify("Update failed", error instanceof Error ? error.message : "Please try again.");
    }
  }

  async function decide(ownerId: string, status: "approved" | "rejected") {
    const ownerGoals = goals.filter((goal) => goal.ownerId === ownerId && goal.status === "submitted");
    const reviewValidation = validateGoalSet(ownerGoals);
    if (status === "approved" && !reviewValidation.canSubmit) {
      notify("Approval blocked", reviewValidation.issues.join(" "));
      return;
    }
    if (status === "rejected" && comment.trim().length < 3) {
      notify("Comment required", "Add a short rework comment before returning goals.");
      return;
    }
    try {
      if (useSupabase) {
        const result = await decideSupabaseGoals(ownerId, currentUser.id, status, comment.trim());
        const decidedGoals = result.goals;
        setGoals(goals.map((goal) => decidedGoals.find((decidedGoal) => decidedGoal.id === goal.id) ?? goal));
        setReviews([...reviews, ...result.reviews]);
      } else {
        const result = decideEmployeeGoals(goals, reviews, ownerId, "u_manager", status, comment.trim());
        setGoals(result.updatedGoals);
        setReviews(result.updatedReviews);
        saveReviews(result.updatedReviews);
      }
      notify(status === "approved" ? "Goals approved" : "Goals rejected", "The employee plan has been updated.");
    } catch (error) {
      notify("Review failed", error instanceof Error ? error.message : "Please try again.");
    }
  }

  if (!submittedOwners.length) {
    return <EmptyPanel icon={Users} title="No submitted goals" text="Team submissions will appear here for manager review." />;
  }

  return (
    <div className="grid gap-6">
      {submittedOwners.map((owner) => {
        const ownerGoals = goals.filter((goal) => goal.ownerId === owner.id && goal.status === "submitted");
        const reviewValidation = validateGoalSet(ownerGoals);
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
              <div className="rounded-xl border bg-muted/30 p-3">
                <div className="mb-2 flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Submitted weightage</span>
                  <span className={cn("font-medium", reviewValidation.canSubmit ? "text-emerald-700" : "text-amber-700")}>
                    {reviewValidation.totalWeightage}%
                  </span>
                </div>
                <Progress value={Math.min(reviewValidation.totalWeightage, 100)} />
                {reviewValidation.issues.length ? (
                  <div className="mt-3 flex gap-2 rounded-lg bg-amber-50 p-2 text-sm text-amber-800">
                    <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
                    <span>{reviewValidation.issues.join(" ")}</span>
                  </div>
                ) : null}
              </div>
              <Textarea
                aria-label={`Manager review comment for ${owner.name}`}
                value={comment}
                onChange={(event) => setComment(event.target.value)}
                placeholder="Add review comments for the employee."
              />
              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={() => decide(owner.id, "rejected")}>Reject</Button>
                <Button disabled={!reviewValidation.canSubmit} onClick={() => decide(owner.id, "approved")}>Approve</Button>
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
  users,
  reviews,
  setGoals,
  notify,
  useSupabase
}: {
  goals: Goal[];
  users: User[];
  reviews: ManagerReview[];
  setGoals: (goals: Goal[]) => void;
  notify: (title: string, description: string) => void;
  useSupabase: boolean;
}) {
  async function unlock(goalId: string) {
    try {
      if (useSupabase) {
        const unlockedGoal = await unlockSupabaseGoal(goalId);
        setGoals(goals.map((goal) => (goal.id === unlockedGoal.id ? unlockedGoal : goal)));
      } else {
        setGoals(goals.map((goal) => (goal.id === goalId ? { ...goal, locked: false, status: "draft", updatedAt: new Date().toISOString() } : goal)));
      }
      notify("Goal unlocked", "The employee can edit and resubmit this goal.");
    } catch (error) {
      notify("Unlock failed", error instanceof Error ? error.message : "Please try again.");
    }
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
                const owner = users.find((user) => user.id === goal.ownerId);
                const latestReview = reviews
                  .filter((review) => review.goalId === goal.id)
                  .sort((a, b) => b.createdAt.localeCompare(a.createdAt))[0];
                return (
                  <tr key={goal.id}>
                    <td className="py-4 pr-4 font-medium">{owner?.name}</td>
                    <td className="py-4 pr-4 text-muted-foreground">{owner?.department}</td>
                    <td className="py-4 pr-4">
                      <p>{goal.title}</p>
                      {latestReview?.comment ? (
                        <p className="mt-1 max-w-sm text-xs text-muted-foreground">{latestReview.comment}</p>
                      ) : null}
                    </td>
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
