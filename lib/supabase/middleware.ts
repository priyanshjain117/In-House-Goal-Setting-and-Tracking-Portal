import { type NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import type { Role } from "@/lib/domain/types";
import { getSupabaseConfig } from "./config";

const protectedRoutes: Record<string, Role> = {
  "/employee": "employee",
  "/manager": "manager",
  "/admin": "admin"
};

const roleHome: Record<Role, string> = {
  employee: "/employee",
  manager: "/manager",
  admin: "/admin"
};

export async function updateSession(request: NextRequest) {
  let response = NextResponse.next({ request });
  const { url, anonKey } = getSupabaseConfig();

  const supabase = createServerClient(url, anonKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
        response = NextResponse.next({ request });
        cookiesToSet.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
      }
    }
  });

  const {
    data: { user }
  } = await supabase.auth.getUser();
  const pathname = request.nextUrl.pathname;
  const protectedRoute = Object.entries(protectedRoutes).find(([route]) => pathname === route || pathname.startsWith(`${route}/`));
  const requiredRole = protectedRoute?.[1];

  if (!user && requiredRole) {
    const urlToLogin = request.nextUrl.clone();
    urlToLogin.pathname = "/login";
    urlToLogin.searchParams.set("next", pathname);
    return NextResponse.redirect(urlToLogin);
  }

  if (user && pathname === "/login") {
    const { data: profile } = await supabase.from("users").select("role").eq("id", user.id).single();
    const home = profile?.role ? roleHome[profile.role as Role] : "/employee";
    return NextResponse.redirect(new URL(home, request.url));
  }

  if (user && requiredRole) {
    const { data: profile } = await supabase.from("users").select("role").eq("id", user.id).single();
    if (!profile?.role) {
      return NextResponse.redirect(new URL("/login?error=profile", request.url));
    }
    if (profile.role !== requiredRole) {
      return NextResponse.redirect(new URL(roleHome[profile.role as Role], request.url));
    }
  }

  return response;
}
