import { NextResponse } from "next/server";
import { getCurrentProfile } from "@/lib/auth";
import type { Goal } from "@/lib/domain/types";
import {
  decideGoals,
  deleteGoal,
  insertGoal,
  loadWorkspace,
  pushSharedGoal,
  submitGoals,
  unlockGoal,
  updateGoal,
  updateGoalFields,
  upsertAchievement
} from "@/lib/services/workspace-repository";

export async function GET() {
  const profile = await getCurrentProfile();
  if (!profile) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  return NextResponse.json(await loadWorkspace());
}

export async function POST(request: Request) {
  const profile = await getCurrentProfile();
  if (!profile) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const body = await request.json();

    switch (body.action) {
      case "insertGoal":
        return NextResponse.json(await insertGoal(body.ownerId, body.values));
      case "updateGoal":
        return NextResponse.json(await updateGoal(body.goalId, body.values));
      case "deleteGoal":
        await deleteGoal(body.goalId);
        return NextResponse.json({ ok: true });
      case "submitGoals":
        return NextResponse.json(await submitGoals(body.ownerId));
      case "updateGoalFields":
        return NextResponse.json(await updateGoalFields(body.goalId, body.patch));
      case "decideGoals":
        return NextResponse.json(await decideGoals(body.ownerId, profile.id, body.status, body.comment));
      case "pushSharedGoal":
        return NextResponse.json(await pushSharedGoal(body.ownerIds, profile.id));
      case "unlockGoal":
        return NextResponse.json(await unlockGoal(body.goalId));
      case "upsertAchievement":
        return NextResponse.json(await upsertAchievement(body.goal as Goal, body.values));
      default:
        return NextResponse.json({ error: "Unsupported workspace action." }, { status: 400 });
    }
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Workspace request failed." },
      { status: 500 }
    );
  }
}
