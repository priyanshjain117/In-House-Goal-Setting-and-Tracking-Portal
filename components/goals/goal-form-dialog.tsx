"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { emptyGoalForm, goalFormSchema } from "@/lib/domain/goal-validation";
import type { Goal, GoalFormValues, GoalType, GoalUom } from "@/lib/domain/types";

type Props = {
  open: boolean;
  goal?: Goal | null;
  onOpenChange: (open: boolean) => void;
  onSubmit: (values: GoalFormValues) => void;
};

export function GoalFormDialog({ open, goal, onOpenChange, onSubmit }: Props) {
  const form = useForm<GoalFormValues>({
    resolver: zodResolver(goalFormSchema),
    defaultValues: emptyGoalForm()
  });

  useEffect(() => {
    form.reset(goal ? { ...goal } : emptyGoalForm());
  }, [form, goal, open]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{goal ? "Edit goal" : "Create goal"}</DialogTitle>
          <DialogDescription>Define measurable work outcomes before submitting them for approval.</DialogDescription>
        </DialogHeader>

        <form
          className="grid gap-4"
          onSubmit={form.handleSubmit((values) => {
            onSubmit(values);
            onOpenChange(false);
          })}
        >
          <Field label="Thrust Area" error={form.formState.errors.thrustArea?.message}>
            <Input {...form.register("thrustArea")} placeholder="Operational Excellence" />
          </Field>
          <Field label="Goal Title" error={form.formState.errors.title?.message}>
            <Input {...form.register("title")} placeholder="Reduce cycle time" />
          </Field>
          <Field label="Description" error={form.formState.errors.description?.message}>
            <Textarea {...form.register("description")} placeholder="Describe the intended business outcome." />
          </Field>

          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="UoM" error={form.formState.errors.uom?.message}>
              <Select
                value={form.watch("uom")}
                onValueChange={(value: GoalUom) => form.setValue("uom", value, { shouldValidate: true })}
              >
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="numeric">Numeric</SelectItem>
                  <SelectItem value="percentage">%</SelectItem>
                  <SelectItem value="timeline">Timeline</SelectItem>
                  <SelectItem value="zero_based">Zero-based</SelectItem>
                </SelectContent>
              </Select>
            </Field>
            <Field label="Goal Type" error={form.formState.errors.goalType?.message}>
              <Select
                value={form.watch("goalType")}
                onValueChange={(value: GoalType) => form.setValue("goalType", value, { shouldValidate: true })}
              >
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="max">Max</SelectItem>
                  <SelectItem value="min">Min</SelectItem>
                </SelectContent>
              </Select>
            </Field>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Target" error={form.formState.errors.target?.message}>
              <Input {...form.register("target")} placeholder="95%" />
            </Field>
            <Field label="Weightage" error={form.formState.errors.weightage?.message}>
              <Input type="number" min={10} max={100} {...form.register("weightage", { valueAsNumber: true })} />
            </Field>
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit">Save goal</Button>
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
