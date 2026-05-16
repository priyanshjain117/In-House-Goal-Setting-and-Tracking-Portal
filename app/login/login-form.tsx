"use client";

import { useActionState } from "react";
import { Loader2, ShieldCheck } from "lucide-react";
import { loginAction, seedDemoAccountsAction } from "./actions";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const demos = [
  ["Employee", "employee@demo.com", "Employee123"],
  ["Manager", "manager@demo.com", "Manager123"],
  ["Admin/HR", "admin@demo.com", "Admin123"]
];

export function LoginForm() {
  const [loginState, loginFormAction, isLoggingIn] = useActionState(loginAction, {});
  const [seedState, seedFormAction, isSeeding] = useActionState(seedDemoAccountsAction, {});

  return (
    <Card className="w-full max-w-md shadow-soft">
      <CardHeader className="space-y-3">
        <div className="flex h-11 w-11 items-center justify-center rounded-lg bg-primary text-primary-foreground">
          <ShieldCheck className="h-5 w-5" />
        </div>
        <div>
          <CardTitle className="text-2xl">Sign in to GoalOS</CardTitle>
          <p className="mt-1 text-sm text-muted-foreground">Use your Supabase Auth account to continue.</p>
        </div>
      </CardHeader>
      <CardContent className="grid gap-5">
        <form action={loginFormAction} className="grid gap-4">
          <div className="grid gap-2">
            <Label htmlFor="email">Email</Label>
            <Input id="email" name="email" type="email" placeholder="employee@demo.com" autoComplete="email" required />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="password">Password</Label>
            <Input id="password" name="password" type="password" placeholder="••••••••" autoComplete="current-password" required />
          </div>
          {loginState.error ? <p className="rounded-lg bg-destructive/10 p-3 text-sm text-destructive">{loginState.error}</p> : null}
          <Button type="submit" disabled={isLoggingIn}>
            {isLoggingIn ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            Sign in
          </Button>
        </form>

        <div className="rounded-lg border bg-muted/40 p-3">
          <p className="text-sm font-medium">Demo accounts</p>
          <div className="mt-2 grid gap-1 text-xs text-muted-foreground">
            {demos.map(([label, email, password]) => (
              <p key={email}>
                {label}: {email} / {password}
              </p>
            ))}
          </div>
          <form action={seedFormAction} className="mt-3">
            <Button type="submit" variant="outline" className="w-full" disabled={isSeeding}>
              {isSeeding ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              Create demo accounts
            </Button>
          </form>
          {seedState.error ? <p className="mt-2 text-xs text-destructive">{seedState.error}</p> : null}
          {!seedState.error && !isSeeding ? <p className="mt-2 text-xs text-muted-foreground">Requires server role key for local setup.</p> : null}
        </div>
      </CardContent>
    </Card>
  );
}
