import Link from "next/link";
import { formatDateLabel } from "@/lib/date";
import type { BodyMetricRow, WorkoutLogRow, WorkoutSetRow } from "./calendar-types";

// 種目ごとに「60kg × 10 / 60kg × 8」の形へまとめる（set_order 順を保つ）
function groupByExercise(sets: WorkoutSetRow[]) {
  const groups = new Map<string, { name: string; sets: WorkoutSetRow[] }>();
  [...sets]
    .sort((a, b) => a.set_order - b.set_order)
    .forEach((s) => {
      const g = groups.get(s.exercise_id) ?? { name: s.exercises?.name ?? "（不明な種目）", sets: [] };
      g.sets.push(s);
      groups.set(s.exercise_id, g);
    });
  return [...groups.values()];
}

type Props = {
  date: string;
  logs: WorkoutLogRow[];
  metric: BodyMetricRow | undefined;
};

export function DaySummary({ date, logs, metric }: Props) {
  const planned = logs.filter((l) => l.status === "planned");
  const done = logs.filter((l) => l.status === "done");

  return (
    <section aria-label="選択日のサマリー" className="flex flex-col gap-4 px-4 py-4">
      <h2 className="text-base font-bold">{formatDateLabel(date)}</h2>

      {logs.length === 0 && !metric && (
        <p className="text-sm text-neutral-500">この日の記録はありません</p>
      )}

      {[
        { title: "予定", badge: "bg-amber-100 text-amber-900", items: planned },
        { title: "実績", badge: "bg-green-100 text-green-900", items: done },
      ].map(({ title, badge, items }) =>
        items.map((log) => (
          <Link
            key={log.id}
            href={`/workouts/${log.id}`}
            className="flex flex-col gap-2 rounded-xl border border-neutral-200 p-3 dark:border-neutral-800"
          >
            <span className={`w-fit rounded-full px-2 py-0.5 text-xs font-semibold ${badge}`}>
              {title}
            </span>
            {log.workout_sets.length === 0 ? (
              <span className="text-sm text-neutral-500">種目が未登録です</span>
            ) : (
              <ul className="flex flex-col gap-1 text-sm">
                {groupByExercise(log.workout_sets).map((g) => (
                  <li key={g.name}>
                    <span className="font-semibold">{g.name}</span>
                    <span className="ml-2 text-neutral-600 dark:text-neutral-400">
                      {g.sets.map((s) => `${s.weight_kg}kg × ${s.reps}`).join(" / ")}
                    </span>
                  </li>
                ))}
              </ul>
            )}
            {log.memo && <p className="text-xs text-neutral-500">{log.memo}</p>}
          </Link>
        )),
      )}

      {metric && (
        <Link
          href={`/metrics/new?date=${date}`}
          className="flex items-center justify-between rounded-xl border border-neutral-200 p-3 text-sm dark:border-neutral-800"
        >
          <span className="font-semibold">身体計測</span>
          <span>
            {metric.weight_kg != null && `${metric.weight_kg}kg`}
            {metric.weight_kg != null && metric.body_fat_pct != null && " / "}
            {metric.body_fat_pct != null && `${metric.body_fat_pct}%`}
          </span>
        </Link>
      )}
    </section>
  );
}
