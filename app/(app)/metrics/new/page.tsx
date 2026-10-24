import { Suspense } from "react";
import { connection } from "next/server";
import { isValidDate, todayString } from "@/lib/date";
import { createClient } from "@/lib/supabase/server";
import { MetricForm, type LastMetric } from "../metric-form";

async function MetricContent({ searchParams }: Pick<PageProps<"/metrics/new">, "searchParams">) {
  // 「今日」はリクエスト時に決まる値。事前描画中に new Date() を評価しないよう明示する
  await connection();
  const params = await searchParams;
  const dateParam = typeof params.date === "string" ? params.date : undefined;
  const date = isValidDate(dateParam) ? dateParam : todayString();

  const supabase = await createClient();
  const [currentRes, lastRes] = await Promise.all([
    supabase
      .from("body_metrics")
      .select("weight_kg, body_fat_pct")
      .eq("date", date)
      .maybeSingle(),
    // 入力日より前で直近の記録（目安表示用）
    supabase
      .from("body_metrics")
      .select("date, weight_kg, body_fat_pct")
      .lt("date", date)
      .order("date", { ascending: false })
      .limit(1)
      .maybeSingle(),
  ]);

  if (currentRes.error || lastRes.error) {
    return (
      <p role="alert" className="p-4 text-sm text-red-600">
        データの取得に失敗しました。時間をおいて再度お試しください
      </p>
    );
  }

  const current = currentRes.data;

  return (
    // 日付が変わったらフォーム状態を作り直す
    <MetricForm
      key={date}
      date={date}
      initial={{
        weight: current?.weight_kg != null ? String(current.weight_kg) : "",
        bodyFat: current?.body_fat_pct != null ? String(current.body_fat_pct) : "",
        exists: current != null,
      }}
      last={lastRes.data as LastMetric | null}
    />
  );
}

export default function NewMetricPage({ searchParams }: PageProps<"/metrics/new">) {
  return (
    <main className="flex flex-1 flex-col">
      <header className="px-4 pt-4">
        <h1 className="text-lg font-bold">身体計測を入力</h1>
      </header>
      <Suspense fallback={<div className="m-4 h-72 animate-pulse rounded-xl bg-neutral-100 dark:bg-neutral-900" />}>
        <MetricContent searchParams={searchParams} />
      </Suspense>
    </main>
  );
}
