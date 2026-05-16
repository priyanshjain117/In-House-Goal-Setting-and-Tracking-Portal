"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useEffect } from "react";
import { Loader2 } from "lucide-react";
import { Controller, useForm } from "react-hook-form";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { emptyGoalForm, goalFormSchema } from "@/lib/domain/goal-validation";
import type { Goal, GoalFormValues } from "@/lib/domain/types";

type Props = {
  open: boolean;
  goal?: Goal | null;
  isSaving?: boolean;
  lockSharedFields?: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (values: GoalFormValues) => Promise<boolean> | boolean;
};

export function GoalFormDialog({ open, goal, isSaving = false, lockSharedFields = false, onOpenChange, onSubmit }: Props) {
  const form = useForm<GoalFormValues>({
    resolver: zodResolver(goalFormSchema),
    defaultValues: emptyGoalForm()
  });

  useEffect(() => {
    if (!open) return;

    form.reset(
      goal
        ? {
            thrustArea: goal.thrustArea,
            title: goal.title,
            description: goal.description,
            uom: goal.uom,
            goalType: goal.goalType,
            target: goal.target,
            weightage: Number(goal.weightage)
          }
        : emptyGoalForm()
    );
  }, [form, goal, open]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{goal ? "Edit goal" : "Create goal"}</DialogTitle>
          <DialogDescription>
            {lockSharedFields
              ? "This shared goal was pushed by your manager. You can adjust weightage only."
              : "Define measurable work outcomes before submitting them for approval."}
          </DialogDescription>
        </DialogHeader>

        <form
          className="grid gap-4"
          onSubmit={form.handleSubmit(async (values) => {
            const saved = await onSubmit(values);
            if (saved) {
              form.reset(emptyGoalForm());
            }
          })}
        >
          <Field label="Thrust Area" error={form.formState.errors.thrustArea?.message}>
            <Input {...form.register("thrustArea")} placeholder="Operational Excellence" disabled={isSaving || lockSharedFields} />
          </Field>
          <Field label="Goal Title" error={form.formState.errors.title?.message}>
            <Input {...form.register("title")} placeholder="Reduce cycle time" disabled={isSaving || lockSharedFields} />
          </Field>
          <Field label="Description" error={form.formState.errors.description?.message}>
            <Textarea {...form.register("description")} placeholder="Describe the intended business outcome." disabled={isSaving || lockSharedFields} />
          </Field>

          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="UoM" error={form.formState.errors.uom?.message}>
              <Controller
                control={form.control}
                name="uom"
                render={({ field }) => (
                  <Select value={field.value} onValueChange={field.onChange} disabled={isSaving || lockSharedFields}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="numeric">Numeric</SelectItem>
                      <SelectItem value="percentage">%</SelectItem>
                      <SelectItem value="timeline">Timeline</SelectItem>
                      <SelectItem value="zero_based">Zero-based</SelectItem>
                    </SelectContent>
                  </Select>
                )}
              />
            </Field>
            <Field label="Goal Type" error={form.formState.errors.goalType?.message}>
              <Controller
                control={form.control}
                name="goalType"
                render={({ field }) => (
                  <Select value={field.value} onValueChange={field.onChange} disabled={isSaving || lockSharedFields}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="max">Max</SelectItem>
                      <SelectItem value="min">Min</SelectItem>
                    </SelectContent>
                  </Select>
                )}
              />
            </Field>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Target" error={form.formState.errors.target?.message}>
              <Input {...form.register("target")} placeholder="95%" disabled={isSaving || lockSharedFields} />
            </Field>
            <Field label="Weightage" error={form.formState.errors.weightage?.message}>
              <Input type="number" min={10} max={100} disabled={isSaving} {...form.register("weightage", { valueAsNumber: true })} />
            </Field>
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" disabled={isSaving} onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={isSaving}>
              {isSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              Save goal
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function Field({ label, error, children }: { label: string; error?: string; children: React.ReactNode }) {
  return (
    <div className="grid gap-2">
      <Label>{label}</Label>
      {children}
      {error ? <p className="text-xs text-destructive">{error}</p> : null}
    </div>
  );
}
