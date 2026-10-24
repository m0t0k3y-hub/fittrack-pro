import { createClient } from "@/lib/supabase/server";
import type { WorkoutLogRow, WorkoutSetRow } from "../calendar-types";
import type {
  ExerciseBlockInit,
  ExerciseOption,
  RecentLog,
  SetHints,
} from "./workout-types";

const SETS_SELECT =
  "id, date, status, memo, workout_sets(exercise_id, set_order, weight_kg, reps, is_done, exercises(name))";

// アーカイブ済みも含めて取得する（過去ログの種目名表示に必要）。選択肢側で除外する
export async function loadExercises(): Promise<ExerciseOption[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("exercises")
    .select("id, name, target_muscle, archived_at")
    .order("name");
  if (error) throw new Error("exercises の取得に失敗しました");
  return (data ?? []).map((e) => ({
    id: e.id,
    name: e.name,
    target_muscle: e.target_muscle,
    archived: e.archived_at != null,
  }));
}

// 直近の実績ログ。重量目安とコピー元の候補の両方に使う
export async function loadRecentDoneLogs(excludeId?: string) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("workout_logs")
    .select(SETS_SELECT)
    .eq("status", "done")
    .order("date", { ascending: false })
    .order("created_at", { ascending: false })
    .limit(30);
  if (error) throw new Error("実績ログの取得に失敗しました");

  const logs = (data as unknown as WorkoutLogRow[]).filter((l) => l.id !== excludeId);

  // 新しい順に走査するので、種目ごとに最初に見つかったログが直近。そのログ内の最終セットを採用する
  const hints: SetHints = {};
  const hintLogId: Record<string, string> = {};
  for (const log of logs) {
    const sorted = [...log.workout_sets].sort((a, b) => a.set_order - b.set_order);
    for (const s of sorted) {
      if (hintLogId[s.exercise_id] && hintLogId[s.exercise_id] !== log.id) continue;
      hintLogId[s.exercise_id] = log.id;
      hints[s.exercise_id] = { weight: s.weight_kg, reps: s.reps, date: log.date };
    }
  }

  const recent: RecentLog[] = logs.slice(0, 5).map((l) => ({
    id: l.id,
    date: l.date,
    exerciseNames: [...new Set(l.workout_sets.map((s) => s.exercises?.name ?? "（不明）"))],
  }));

  return { hints, recent };
}

export async function loadWorkout(id: string): Promise<WorkoutLogRow | null> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("workout_logs")
    .select(SETS_SELECT)
    .eq("id", id)
    .maybeSingle();
  if (error) throw new Error("ワークアウトの取得に失敗しました");
  return data as unknown as WorkoutLogRow | null;
}

// セットを set_order 順に並べ、同じ種目が続く範囲を1ブロックにまとめる
export function toBlocks(sets: WorkoutSetRow[], resetDone = false): ExerciseBlockInit[] {
  const blocks: ExerciseBlockInit[] = [];
  [...sets]
    .sort((a, b) => a.set_order - b.set_order)
    .forEach((s) => {
      const set = { weight: s.weight_kg, reps: s.reps, isDone: resetDone ? false : s.is_done };
      const last = blocks[blocks.length - 1];
      if (last && last.exerciseId === s.exercise_id) last.sets.push(set);
      else blocks.push({ exerciseId: s.exercise_id, sets: [set] });
    });
  return blocks;
}
