"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { isValidDate, monthOf } from "@/lib/date";
import { createClient } from "@/lib/supabase/server";

export type SaveResult = { error: string } | undefined;

const workoutSchema = z.object({
  id: z.uuid().nullable(),
  date: z.string().refine(isValidDate, "日付が正しくありません"),
  status: z.enum(["planned", "done"], "ステータスが正しくありません"),
  memo: z.string().max(1000, "メモは1000文字以内で入力してください"),
  sets: z
    .array(
      z.object({
        exercise_id: z.uuid("種目が正しくありません"),
        weight_kg: z
          .number()
          .min(0, "重量は0以上で入力してください")
          .max(999.5, "重量が大きすぎます")
          .refine((v) => Number.isInteger(v * 2), "重量は0.5kg刻みで入力してください"),
        reps: z
          .number()
          .int("回数は整数で入力してください")
          .min(1, "回数は1以上で入力してください")
          .max(999, "回数が大きすぎます"),
        is_done: z.boolean(),
      }),
    )
    .min(1, "種目とセットを1つ以上入力してください")
    .max(200, "セット数が多すぎます"),
});

function homeUrl(date: string) {
  return `/?month=${monthOf(date)}&date=${date}`;
}

export async function saveWorkout(input: unknown): Promise<SaveResult> {
  const parsed = workoutSchema.safeParse(input);
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const { id, date, status, memo, sets } = parsed.data;

  const supabase = await createClient();
  const { error } = await supabase.rpc("save_workout", {
    p_id: id,
    p_date: date,
    p_status: status,
    p_memo: memo.trim() === "" ? null : memo,
    p_sets: sets,
  });
  if (error) return { error: "保存に失敗しました。時間をおいて再度お試しください" };

  redirect(homeUrl(date));
}

export async function deleteWorkout(id: string, date: string): Promise<SaveResult> {
  if (!z.uuid().safeParse(id).success) return { error: "削除に失敗しました" };

  const supabase = await createClient();
  const { error } = await supabase.from("workout_logs").delete().eq("id", id);
  if (error) return { error: "削除に失敗しました。時間をおいて再度お試しください" };

  redirect(isValidDate(date) ? homeUrl(date) : "/");
}
