"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { isValidDate, monthOf } from "@/lib/date";
import { createClient } from "@/lib/supabase/server";

export type MetricResult = { error: string } | undefined;

// numeric(x,1) のため小数第1位まで。浮動小数点誤差を許容して判定する
const oneDecimal = (v: number) => Math.abs(Math.round(v * 10) - v * 10) < 1e-9;

const metricSchema = z
  .object({
    date: z.string().refine(isValidDate, "日付が正しくありません"),
    weight_kg: z
      .number()
      .min(20, "体重は20〜300kgの範囲で入力してください")
      .max(300, "体重は20〜300kgの範囲で入力してください")
      .refine(oneDecimal, "体重は小数第1位までで入力してください")
      .nullable(),
    body_fat_pct: z
      .number()
      .min(1, "体脂肪率は1〜70%の範囲で入力してください")
      .max(70, "体脂肪率は1〜70%の範囲で入力してください")
      .refine(oneDecimal, "体脂肪率は小数第1位までで入力してください")
      .nullable(),
  })
  .refine((v) => v.weight_kg !== null || v.body_fat_pct !== null, {
    message: "体重か体脂肪率のどちらかを入力してください",
  });

function homeUrl(date: string) {
  return `/?month=${monthOf(date)}&date=${date}`;
}

// 同じ日付は上書き (user_id は DB の default auth.uid())
export async function saveMetric(input: unknown): Promise<MetricResult> {
  const parsed = metricSchema.safeParse(input);
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  const supabase = await createClient();
  const { error } = await supabase
    .from("body_metrics")
    .upsert(parsed.data, { onConflict: "user_id,date" });
  if (error) return { error: "保存に失敗しました。時間をおいて再度お試しください" };

  redirect(homeUrl(parsed.data.date));
}

export async function deleteMetric(date: string): Promise<MetricResult> {
  if (!isValidDate(date)) return { error: "削除に失敗しました" };

  const supabase = await createClient();
  const { error } = await supabase.from("body_metrics").delete().eq("date", date);
  if (error) return { error: "削除に失敗しました。時間をおいて再度お試しください" };

  redirect(homeUrl(date));
}
