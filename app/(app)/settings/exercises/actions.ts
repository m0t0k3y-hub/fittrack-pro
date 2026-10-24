"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";

export type SettingsResult = { error?: string; ok?: true };

const MUSCLES = ["chest", "back", "legs", "shoulders", "arms", "abs", "other"] as const;

const exerciseSchema = z.object({
  name: z.string().trim().min(1, "種目名を入力してください").max(30, "種目名は30文字以内で入力してください"),
  target_muscle: z.enum(MUSCLES, "部位が正しくありません"),
});

const profileSchema = z.object({
  nickname: z.string().trim().min(1, "ニックネームを入力してください").max(30, "ニックネームは30文字以内で入力してください"),
  height_cm: z
    .number()
    .min(50, "身長は50〜250cmの範囲で入力してください")
    .max(250, "身長は50〜250cmの範囲で入力してください")
    .refine((v) => Math.abs(Math.round(v * 10) - v * 10) < 1e-9, "身長は小数第1位までで入力してください")
    .nullable(),
});

const PATH = "/settings/exercises";
const UNIQUE_VIOLATION = "23505";
const DUPLICATE_MESSAGE = "同じ名前の種目がすでにあります";

function exerciseError(code: string | undefined): SettingsResult {
  return code === UNIQUE_VIOLATION
    ? { error: DUPLICATE_MESSAGE }
    : { error: "保存に失敗しました。時間をおいて再度お試しください" };
}

// デフォルト種目を含む、見える範囲の有効な種目に同名があるか（選択肢に同名が並ぶのを防ぐ）
async function nameTaken(
  supabase: Awaited<ReturnType<typeof createClient>>,
  name: string,
  excludeId?: string,
) {
  let q = supabase.from("exercises").select("id").eq("name", name).is("archived_at", null).limit(1);
  if (excludeId) q = q.neq("id", excludeId);
  const { data, error } = await q;
  return !error && (data?.length ?? 0) > 0;
}

export async function addExercise(input: unknown): Promise<SettingsResult> {
  const parsed = exerciseSchema.safeParse(input);
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  const userId = data?.claims?.sub;
  if (!userId) return { error: "ログインが必要です" };

  if (await nameTaken(supabase, parsed.data.name)) return { error: DUPLICATE_MESSAGE };

  const { error } = await supabase.from("exercises").insert({ ...parsed.data, user_id: userId });
  if (error) return exerciseError(error.code);

  revalidatePath(PATH);
  return { ok: true };
}

export async function updateExercise(id: string, input: unknown): Promise<SettingsResult> {
  if (!z.uuid().safeParse(id).success) return { error: "種目が正しくありません" };
  const parsed = exerciseSchema.safeParse(input);
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  const supabase = await createClient();
  if (await nameTaken(supabase, parsed.data.name, id)) return { error: DUPLICATE_MESSAGE };
  // RLS によりデフォルト種目・他人の種目は更新対象にならない（0行）
  const { data, error } = await supabase
    .from("exercises")
    .update(parsed.data)
    .eq("id", id)
    .is("archived_at", null)
    .select("id");
  if (error) return exerciseError(error.code);
  if (!data?.length) return { error: "種目が見つかりません" };

  revalidatePath(PATH);
  return { ok: true };
}

// 過去の記録を壊さないよう、削除は論理削除（archived_at を設定）
export async function archiveExercise(id: string): Promise<SettingsResult> {
  if (!z.uuid().safeParse(id).success) return { error: "種目が正しくありません" };

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("exercises")
    .update({ archived_at: new Date().toISOString() })
    .eq("id", id)
    .is("archived_at", null)
    .select("id");
  if (error) return { error: "削除に失敗しました。時間をおいて再度お試しください" };
  if (!data?.length) return { error: "種目が見つかりません" };

  revalidatePath(PATH);
  return { ok: true };
}

export async function updateProfile(input: unknown): Promise<SettingsResult> {
  const parsed = profileSchema.safeParse(input);
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  const userId = data?.claims?.sub;
  if (!userId) return { error: "ログインが必要です" };

  const { error } = await supabase.from("profiles").update(parsed.data).eq("id", userId);
  if (error) return { error: "保存に失敗しました。時間をおいて再度お試しください" };

  revalidatePath(PATH);
  return { ok: true };
}
