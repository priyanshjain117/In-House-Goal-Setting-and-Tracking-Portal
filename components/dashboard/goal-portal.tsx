"use client";

import {
  AlertCircle,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  ClipboardList,
  LayoutDashboard,
  Loader2,
  LogOut,
  Menu,
  Plus,
  ShieldCheck,
  Users,
  X
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { GoalFormDialog } from "@/components/goals/goal-form-dialog";
import { logoutAction } from "@/app/login/actions";
import { AchievementTracking } from "@/components/dashboard/achievement-tracking";
import { VisualDashboard } from "@/components/dashboard/visual-dashboard";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { Textarea } from "@/components/ui/textarea";
import { Toast, ToastDescription, ToastProvider, ToastTitle, ToastViewport } from "@/components/ui/toast";
import { MAX_GOALS, isEmployeeEditableStatus, validateGoalSet } from "@/lib/domain/goal-validation";
import type { AchievementFormValues, AchievementUpdate, AuthProfile, Goal, GoalFormValues, ManagerReview, Role, User } from "@/lib/domain/types";
import { cn } from "@/lib/utils";
import {
  decideGoals,
  deleteGoal,
  insertGoal,
  loadWorkspace,
  pushSharedGoal,
  submitGoals as submitWorkspaceGoals,
  unlockGoal,
  updateGoal,
  updateGoalFields,
  upsertAchievement
} from "@/lib/services/workspace-api-client";
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
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [users, setUsers] = useState<User[]>([]);
  const [goals, setGoals] = useState<Goal[]>([]);
  const [reviews, setReviews] = useState<ManagerReview[]>([]);
  const [achievements, setAchievements] = useState<AchievementUpdate[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [startupError, setStartupError] = useState<string | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingGoal, setEditingGoal] = useState<Goal | null>(null);
  const [savingGoal, setSavingGoal] = useState(false);
  const [toast, setToast] = useState<{ title: string; description: string } | null>(null);

  useEffect(() => {
    let isMounted = true;

    async function loadDatabaseWorkspace() {
      try {
        const workspace = await loadWorkspace();
        if (!isMounted) return;
        setGoals(workspace.goals);
        setReviews(workspace.reviews);
        setAchievements(workspace.achievements);
        setUsers(workspace.users);
      } catch (error) {
        if (!isMounted) return;
        setGoals([]);
        setUsers([]);
        setReviews([]);
        setAchievements([]);
        setStartupError(error instanceof Error ? error.message : "Unable to load workspace data.");
      } finally {
        if (isMounted) setLoaded(true);
      }
    }

    loadDatabaseWorkspace();

    return () => {
      isMounted = false;
    };
  }, []);

  const currentUser = profile ?? users.find((user) => user.role === role);
  const employee = role === "employee" ? currentUser : users.find((user) => user.role === "employee");
  const employeeGoals = employee ? goals.filter((goal) => goal.ownerId === employee.id) : [];
  const activeSubmissionGoals = employeeGoals.filter((goal) => !goal.locked && goal.status !== "approved");
  const validation = validateGoalSet(activeSubmissionGoals);

  function notify(title: string, description: string) {
    setToast({ title, description });
  }

  function navigateToSection(sectionId: string) {
    document.getElementById(sectionId)?.scrollIntoView({ behavior: "smooth", block: "start" });
    setSidebarOpen(false);
  }

  async function saveGoal(values: GoalFormValues) {
    if (!employee) return false;
    if (savingGoal) return false;
    setSavingGoal(true);

    try {
      if (editingGoal) {
        const nextValues =
          editingGoal.sharedGoalGroupId && editingGoal.primaryOwnerId !== employee.id
            ? { ...editingGoal, weightage: values.weightage }
            : values;
        const updatedGoal = await updateGoal(editingGoal.id, nextValues);
        setGoals((currentGoals) => currentGoals.map((goal) => (goal.id === updatedGoal.id ? updatedGoal : goal)));
        setDialogOpen(false);
        setEditingGoal(null);
        notify("Goal updated", "The draft goal has been saved.");
        return true;
      }

      if (employeeGoals.length >= MAX_GOALS) {
        notify("Goal limit reached", `Employees can create up to ${MAX_GOALS} goals.`);
        return false;
      }

      const newGoal = await insertGoal(employee.id, values);
      setGoals((currentGoals) => [...currentGoals, newGoal]);
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
      await deleteGoal(goalId);
      setGoals((currentGoals) => currentGoals.filter((goal) => goal.id !== goalId));
      notify("Goal deleted", "The draft goal was removed.");
    } catch (error) {
      notify("Delete failed", error instanceof Error ? error.message : "Please try again.");
    }
  }

  async function submitGoals() {
    if (!employee) return;
    try {
      const submittedGoals = await submitWorkspaceGoals(employee.id);
      setGoals((currentGoals) =>
        currentGoals.map((goal) => submittedGoals.find((submittedGoal) => submittedGoal.id === goal.id) ?? goal)
      );
      notify("Submitted for approval", "Your manager can now review these goals.");
    } catch (error) {
      notify("Submit failed", error instanceof Error ? error.message : "Please try again.");
    }
  }

  async function saveAchievement(goal: Goal, values: AchievementFormValues) {
    try {
      const savedAchievement = await upsertAchievement(goal, values);
      setAchievements((currentAchievements) => {
        const exists = currentAchievements.some((achievement) => achievement.id === savedAchievement.id);
        return exists
          ? currentAchievements.map((achievement) => (achievement.id === savedAchievement.id ? savedAchievement : achievement))
          : [...currentAchievements, savedAchievement];
      });

      notify("Quarterly update saved", "Progress tracking has been updated.");
    } catch (error) {
      notify("Update failed", error instanceof Error ? error.message : "Please try again.");
    }
  }

  if (!loaded) {
    return (
      <div className="min-h-screen bg-background p-6 lg:pl-72">
        <div className="mb-6 flex items-center gap-3 rounded-xl border bg-card px-5 py-4 text-sm shadow-soft">
          <Loader2 className="h-4 w-4 animate-spin" />
          Loading workspace...
        </div>
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {Array.from({ length: 4 }).map((_, index) => (
            <div key={index} className="h-28 animate-pulse rounded-xl border bg-card" />
          ))}
        </div>
        <div className="mt-6 grid gap-6 xl:grid-cols-2">
          <div className="h-80 animate-pulse rounded-xl border bg-card" />
          <div className="h-80 animate-pulse rounded-xl border bg-card" />
        </div>
      </div>
    );
  }

  if (!currentUser || !employee) {
    return (
      <div className="min-h-screen bg-background p-6">
        <Card className="border-amber-200 bg-amber-50">
          <CardContent className="p-5">
            <p className="font-medium text-amber-900">Workspace data is not available</p>
            <p className="text-sm text-amber-800">Run the database seed and sign in with a demo account.</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <ToastProvider>
      <div className="min-h-screen bg-background">
        <aside
          className={cn(
            "fixed inset-y-0 left-0 z-30 hidden border-r bg-card px-3 py-5 transition-[width] duration-200 ease-out lg:block",
            sidebarCollapsed ? "w-20" : "w-64"
          )}
        >
          <SidebarContent
            role={role}
            collapsed={sidebarCollapsed}
            onNavigate={navigateToSection}
            onToggleCollapse={() => setSidebarCollapsed((current) => !current)}
          />
        </aside>

        {sidebarOpen ? (
          <button
            type="button"
            aria-label="Close navigation overlay"
            className="fixed inset-0 z-40 bg-slate-950/30 backdrop-blur-sm lg:hidden"
            onClick={() => setSidebarOpen(false)}
          />
        ) : null}

        <aside
          className={cn(
            "fixed inset-y-0 left-0 z-50 w-[min(18rem,calc(100vw-2rem))] border-r bg-card px-4 py-5 shadow-soft transition-transform duration-200 ease-out lg:hidden",
            sidebarOpen ? "translate-x-0" : "-translate-x-full"
          )}
          aria-hidden={!sidebarOpen}
        >
          <div className="mb-4 flex items-center justify-end">
            <Button type="button" variant="ghost" size="icon" aria-label="Close navigation" onClick={() => setSidebarOpen(false)}>
              <X className="h-4 w-4" />
            </Button>
          </div>
          <SidebarContent role={role} collapsed={false} onNavigate={navigateToSection} />
        </aside>

        <main className={cn("min-w-0 transition-[padding] duration-200 ease-out", sidebarCollapsed ? "lg:pl-20" : "lg:pl-64")}>
          <header className="sticky top-0 z-20 border-b bg-background/85 px-4 py-3 backdrop-blur sm:px-6">
            <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
              <div className="flex min-w-0 items-start gap-3">
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  className="shrink-0 lg:hidden"
                  aria-label="Open navigation"
                  aria-expanded={sidebarOpen}
                  onClick={() => setSidebarOpen(true)}
                >
                  <Menu className="h-4 w-4" />
                </Button>
                <div className="min-w-0">
                  <h1 className="truncate text-xl font-semibold">{roleCopy[role].title}</h1>
                  <p className="text-sm text-muted-foreground">{roleCopy[role].subtitle}</p>
                </div>
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

          <section className="grid min-w-0 gap-6 px-4 py-6 sm:px-6">
            {startupError ? (
              <Card className="border-amber-200 bg-amber-50">
                <CardContent className="flex flex-col gap-3 p-5 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <p className="font-medium text-amber-900">Workspace data could not be loaded</p>
                    <p className="text-sm text-amber-800">{startupError}</p>
                  </div>
                </CardContent>
              </Card>
            ) : null}
            <div id="dashboard" className="scroll-mt-24">
              <VisualDashboard
                role={role}
                currentUser={currentUser}
                users={users}
                goals={goals}
                reviews={reviews}
                achievements={achievements}
              />
            </div>
            {role === "employee" ? (
              <div id="goals" className="scroll-mt-24">
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
              </div>
            ) : null}
            {role === "manager" ? (
              <div id="reviews" className="scroll-mt-24">
                <ManagerDashboard
                  goals={goals}
                  users={users}
                  currentUser={currentUser}
                  setGoals={setGoals}
                  reviews={reviews}
                  setReviews={setReviews}
                  notify={notify}
                  onPushSharedGoal={async (ownerIds) => {
                    try {
                      const sharedGoals = await pushSharedGoal(ownerIds);
                      setGoals((currentGoals) => [...currentGoals, ...sharedGoals]);
                      notify("Shared KPI pushed", "Departmental training goal was added to selected employees.");
                    } catch (error) {
                      notify("Push failed", error instanceof Error ? error.message : "Please try again.");
                    }
                  }}
                />
              </div>
            ) : null}
            {role === "admin" ? (
              <div id="governance" className="scroll-mt-24">
                <AdminDashboard goals={goals} users={users} reviews={reviews} setGoals={setGoals} notify={notify} />
              </div>
            ) : null}
            <div id="tracking" className="scroll-mt-24">
              <AchievementTracking
                role={role}
                currentUser={currentUser}
                users={users}
                goals={goals}
                achievements={achievements}
                onSave={saveAchievement}
              />
            </div>
          </section>
        </main>
      </div>

      <GoalFormDialog
        open={dialogOpen}
        goal={editingGoal}
        isSaving={savingGoal}
        lockSharedFields={Boolean(editingGoal?.sharedGoalGroupId && editingGoal.primaryOwnerId !== employee.id)}
        onOpenChange={setDialogOpen}
        onSubmit={saveGoal}
      />
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

function SidebarContent({
  role,
  collapsed,
  onNavigate,
  onToggleCollapse
}: {
  role: Role;
  collapsed: boolean;
  onNavigate: (sectionId: string) => void;
  onToggleCollapse?: () => void;
}) {
  const navItems = [
    { label: "Dashboard", sectionId: "dashboard", icon: LayoutDashboard },
    { label: "Goals", sectionId: role === "employee" ? "goals" : "dashboard", icon: ClipboardList },
    { label: "Reviews", sectionId: role === "manager" ? "reviews" : "tracking", icon: CheckCircle2 },
    { label: "Tracking", sectionId: "tracking", icon: Users },
    { label: "Governance", sectionId: role === "admin" ? "governance" : "dashboard", icon: ShieldCheck }
  ];

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className={cn("mb-8 flex items-center gap-3 px-2", collapsed && "flex-col px-0")}>
        <div className={cn("flex min-w-0 items-center gap-3", collapsed && "flex-col")}>
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary text-primary-foreground">
            <LayoutDashboard className="h-5 w-5" />
          </div>
          <div className={cn("min-w-0", collapsed && "hidden")}>
            <p className="font-semibold">GoalOS</p>
            <p className="text-xs text-muted-foreground">Hackathon MVP</p>
          </div>
        </div>
        {onToggleCollapse ? (
          <Button
            type="button"
            variant="outline"
            size="icon"
            className={cn("ml-auto h-8 w-8 shrink-0", collapsed && "ml-0")}
            aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
            title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
            onClick={onToggleCollapse}
          >
            {collapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
          </Button>
        ) : null}
      </div>

      <nav className="grid gap-1 text-sm">
        {navItems.map(({ label, sectionId, icon: Icon }) => (
          <button
            type="button"
            key={`${label}-${sectionId}`}
            title={collapsed ? label : undefined}
            className={cn(
              "flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
              collapsed && "justify-center px-0"
            )}
            onClick={() => onNavigate(sectionId)}
          >
            <Icon className="h-4 w-4 shrink-0" />
            <span className={cn(collapsed && "sr-only")}>{label}</span>
          </button>
        ))}
      </nav>

      <div className="mt-auto grid gap-3">
        <div className={cn("rounded-xl border bg-muted/30 p-3 text-xs text-muted-foreground", collapsed && "p-2 text-center")}>
          <p className={cn("font-medium text-foreground", collapsed && "sr-only")}>Current role</p>
          <p className={cn("mt-1 capitalize", collapsed && "mt-0 text-[10px]")}>{role === "admin" ? (collapsed ? "HR" : "Admin / HR") : role}</p>
        </div>
      </div>
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
              <span className="text-muted-foreground">Active submission weightage</span>
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
  onPushSharedGoal
}: {
  goals: Goal[];
  users: User[];
  currentUser: User;
  setGoals: (goals: Goal[]) => void;
  reviews: ManagerReview[];
  setReviews: (reviews: ManagerReview[]) => void;
  notify: (title: string, description: string) => void;
  onPushSharedGoal: (ownerIds: string[]) => Promise<void>;
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

    try {
      const updatedGoal = await updateGoalFields(goalId, patch);
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
      const result = await decideGoals(ownerId, status, comment.trim());
      const decidedGoals = result.goals;
      setGoals(goals.map((goal) => decidedGoals.find((decidedGoal) => decidedGoal.id === goal.id) ?? goal));
      setReviews([...reviews, ...result.reviews]);
      notify(status === "approved" ? "Goals approved" : "Goals rejected", "The employee plan has been updated.");
    } catch (error) {
      notify("Review failed", error instanceof Error ? error.message : "Please try again.");
    }
  }

  if (!submittedOwners.length) {
    return (
      <div className="grid gap-6">
        <SharedGoalPanel users={users} currentUser={currentUser} goals={goals} onPushSharedGoal={onPushSharedGoal} />
        <EmptyPanel icon={Users} title="No submitted goals" text="Team submissions will appear here for manager review." />
      </div>
    );
  }

  return (
    <div className="grid gap-6">
      <SharedGoalPanel users={users} currentUser={currentUser} goals={goals} onPushSharedGoal={onPushSharedGoal} />
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

function SharedGoalPanel({
  users,
  currentUser,
  goals,
  onPushSharedGoal
}: {
  users: User[];
  currentUser: User;
  goals: Goal[];
  onPushSharedGoal: (ownerIds: string[]) => Promise<void>;
}) {
  const teamMembers = users.filter((user) => user.managerId === currentUser.id);
  const alreadyAssigned = new Set(goals.filter((goal) => goal.title === "Employee Training Completion").map((goal) => goal.ownerId));
  const pendingOwners = teamMembers.filter((user) => !alreadyAssigned.has(user.id)).map((user) => user.id);

  return (
    <Card>
      <CardHeader className="flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <CardTitle>Shared departmental KPI</CardTitle>
          <p className="text-sm text-muted-foreground">
            Push Employee Training Completion to direct reports. Recipients can adjust weightage only.
          </p>
        </div>
        <Button type="button" variant="outline" disabled={!pendingOwners.length} onClick={() => onPushSharedGoal(pendingOwners)}>
          Push KPI
        </Button>
      </CardHeader>
      <CardContent>
        <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
          {teamMembers.map((user) => {
            const assigned = goals.some((goal) => goal.ownerId === user.id && goal.title === "Employee Training Completion");
            return (
              <div key={user.id} className="rounded-lg border bg-muted/30 px-3 py-2 text-sm">
                <div className="flex items-center justify-between gap-2">
                  <span className="font-medium">{user.name}</span>
                  <span className={cn("rounded-full px-2 py-0.5 text-[11px] font-medium", assigned ? "bg-emerald-50 text-emerald-700" : "bg-slate-100 text-slate-700")}>
                    {assigned ? "Assigned" : "Ready"}
                  </span>
                </div>
                <p className="mt-1 text-xs text-muted-foreground">{user.department ?? "Team member"}</p>
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}

function AdminDashboard({
  goals,
  users,
  reviews,
  setGoals,
  notify
}: {
  goals: Goal[];
  users: User[];
  reviews: ManagerReview[];
  setGoals: (goals: Goal[]) => void;
  notify: (title: string, description: string) => void;
}) {
  async function unlock(goalId: string) {
    try {
      const unlockedGoal = await unlockGoal(goalId);
      setGoals(goals.map((goal) => (goal.id === unlockedGoal.id ? unlockedGoal : goal)));
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
