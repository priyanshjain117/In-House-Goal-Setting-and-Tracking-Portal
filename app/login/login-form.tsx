"use client";

import { useActionState, useState } from "react";
import { BriefcaseBusiness, Loader2, ShieldCheck, UserRound, UsersRound } from "lucide-react";
import { loginAction } from "./actions";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const demoAccounts = [
  {
    role: "Employee",
    email: "employee@demo.com",
    password: "Employee123",
    description: "Goal creation and progress updates",
    cta: "Login as Employee",
    icon: UserRound
  },
  {
    role: "Manager",
    email: "manager@demo.com",
    password: "Manager123",
    description: "Approvals, team check-ins, and coaching",
    cta: "Login as Manager",
    icon: UsersRound
  },
  {
    role: "Admin/HR",
    email: "admin@demo.com",
    password: "Admin123",
    description: "Analytics, governance, and escalations",
    cta: "Login as Admin",
    icon: BriefcaseBusiness
  }
];

export function LoginForm() {
  const [loginState, loginFormAction, isLoggingIn] = useActionState(loginAction, {});
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  function fillDemoAccount(account: (typeof demoAccounts)[number]) {
    setEmail(account.email);
    setPassword(account.password);
  }

  return (
    <div className="grid w-full max-w-lg gap-4">
      <Card className="shadow-soft">
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
              <Input
                id="email"
                name="email"
                type="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                placeholder="employee@demo.com"
                autoComplete="email"
                required
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                name="password"
                type="password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                placeholder="••••••••"
                autoComplete="current-password"
                required
              />
            </div>
            {loginState.error ? <p className="rounded-lg bg-destructive/10 p-3 text-sm text-destructive">{loginState.error}</p> : null}
            <Button type="submit" disabled={isLoggingIn}>
              {isLoggingIn ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              Sign in
            </Button>
          </form>
        </CardContent>
      </Card>

      <Card className="border-primary/15 shadow-soft">
        <CardHeader className="pb-3">
          <div className="flex items-start justify-between gap-3">
            <div>
              <CardTitle>Hackathon Demo Accounts</CardTitle>
              <p className="mt-1 text-sm text-muted-foreground">Seeded credentials for testing each role journey.</p>
            </div>
            <span className="rounded-full bg-accent px-3 py-1 text-xs font-medium text-accent-foreground">Demo only</span>
          </div>
        </CardHeader>
        <CardContent className="grid gap-3">
          {demoAccounts.map((account) => {
            const Icon = account.icon;

            return (
              <div key={account.email} className="rounded-lg border bg-background p-3">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div className="flex gap-3">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-secondary text-primary">
                      <Icon className="h-5 w-5" />
                    </div>
                    <div>
                      <p className="font-medium">{account.role}</p>
                      <p className="mt-1 text-xs text-muted-foreground">{account.description}</p>
                    </div>
                  </div>
                  <Button type="button" variant="outline" size="sm" onClick={() => fillDemoAccount(account)} disabled={isLoggingIn}>
                    {account.cta}
                  </Button>
                </div>
                <dl className="mt-3 grid gap-2 rounded-lg bg-muted/50 p-3 text-xs sm:grid-cols-2">
                  <div>
                    <dt className="font-medium text-muted-foreground">Email</dt>
                    <dd className="mt-1 break-all font-medium text-foreground">{account.email}</dd>
                  </div>
                  <div>
                    <dt className="font-medium text-muted-foreground">Password</dt>
                    <dd className="mt-1 font-medium text-foreground">{account.password}</dd>
                  </div>
                </dl>
              </div>
            );
          })}
          <p className="text-xs text-muted-foreground">
            These are seeded demo users only. The normal authentication flow is unchanged.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
