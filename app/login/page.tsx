import { LoginForm } from "./login-form";

export default function LoginPage() {
  return (
    <main className="min-h-screen bg-background">
      <div className="grid min-h-screen lg:grid-cols-[1fr_560px]">
        <section className="hidden bg-slate-950 px-10 py-12 text-white lg:flex lg:flex-col lg:justify-between">
          <div>
            <p className="text-sm font-medium text-cyan-200">GoalOS</p>
            <h1 className="mt-5 max-w-xl text-5xl font-semibold tracking-normal">Enterprise goals with clean role-based access.</h1>
            <p className="mt-5 max-w-lg text-base text-slate-300">
              Employees draft measurable plans, managers review submissions, and HR keeps governance tight without slowing teams down.
            </p>
          </div>
          <div className="grid max-w-lg grid-cols-3 gap-3 text-sm">
            {["Employee", "Manager", "Admin/HR"].map((role) => (
              <div key={role} className="rounded-lg border border-white/10 bg-white/5 p-3">
                <p className="font-medium">{role}</p>
                <p className="mt-1 text-xs text-slate-400">Protected dashboard</p>
              </div>
            ))}
          </div>
        </section>
        <section className="flex items-center justify-center px-4 py-10 sm:px-6">
          <LoginForm />
        </section>
      </div>
    </main>
  );
}
