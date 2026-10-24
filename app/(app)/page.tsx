import { Suspense } from "react";
import { logout } from "../(auth)/actions";
import {
  dateOf,
  daysInMonth,
  isValidDate,
  isValidMonth,
  monthOf,
  todayString,
} from "@/lib/date";
import { createClient } from "@/lib/supabase/server";
import { AddFab } from "./add-fab";
import type { BodyMetricRow, WorkoutLogRow, WorkoutStatus } from "./calendar-types";
import { DaySummary } from "./day-summary";
import { MonthCalendar } from "./month-calendar";

async function CalendarContent({ searchParams }: Pick<PageProps<"/">, "searchParams">) {
  const params = await searchParams;
  const today = todayString();

  const monthParam = typeof params.month === "string" ? params.month : undefined;
  const dateParam = typeof params.date === "string" ? params.date : undefined;

  const month = isValidMonth(monthParam)
    ? monthParam
    : isValidDate(dateParam)
      ? monthOf(dateParam)
      : monthOf(today);

  // 選択日: 指定が表示月内ならそれ、無ければ（今月なら）今日、他の月なら1日
  const selected =
    isValidDate(dateParam) && monthOf(dateParam) === month
      ? dateParam
      : month === monthOf(today)
        ? today
        : dateOf(month, 1);

  const from = dateOf(month, 1);
  const to = dateOf(month, daysInMonth(month));

  const supabase = await createClient();
  const [logsRes, metricsRes] = await Promise.all([
    supabase
      .from("workout_logs")
      .select(
        "id, date, status, memo, workout_sets(exercise_id, set_order, weight_kg, reps, is_done, exercises(name))",
      )
      .gte("date", from)
      .lte("date", to)
      .order("created_at"),
    supabase
      .from("body_metrics")
      .select("date, weight_kg, body_fat_pct")
      .gte("date", from)
      .lte("date", to),
  ]);

  if (logsRes.error || metricsRes.error) {
    return (
      <p role="alert" className="p-4 text-sm text-red-600">
        データの取得に失敗しました。時間をおいて再度お試しください
      </p>
    );
  }

  const logs = logsRes.data as unknown as WorkoutLogRow[];
  const metrics = metricsRes.data as unknown as BodyMetricRow[];

  const statusByDate = new Map<string, Set<WorkoutStatus>>();
  for (const log of logs) {
    const set = statusByDate.get(log.date) ?? new Set<WorkoutStatus>();
    set.add(log.status);
    statusByDate.set(log.date, set);
  }

  return (
    <>
      <MonthCalendar
        month={month}
        selected={selected}
        today={today}
        statusByDate={statusByDate}
      />
      <DaySummary
        date={selected}
        logs={logs.filter((l) => l.date === selected)}
        metric={metrics.find((m) => m.date === selected)}
      />
      <AddFab date={selected} />
    </>
  );
}

function CalendarSkeleton() {
  return <div className="h-96 animate-pulse rounded-xl bg-neutral-100 dark:bg-neutral-900" />;
}

export default function Home({ searchParams }: PageProps<"/">) {
  return (
    <main className="flex flex-1 flex-col">
      <header className="flex items-center justify-between px-4 pt-3">
        <h1 className="text-lg font-bold">Bodymenter</h1>
        <form action={logout}>
          <button className="h-11 px-2 text-sm text-neutral-500">ログアウト</button>
        </form>
      </header>
      <Suspense fallback={<CalendarSkeleton />}>
        <CalendarContent searchParams={searchParams} />
      </Suspense>
    </main>
  );
}
