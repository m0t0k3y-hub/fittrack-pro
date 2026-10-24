import Link from "next/link";
import { Suspense } from "react";
import { z } from "zod";
import { addDays, todayString } from "@/lib/date";
import { toDailySeries, type Measured } from "@/lib/series";
import { createClient } from "@/lib/supabase/server";
import { ExerciseSelect } from "./exercise-select";
import { LineChartCard } from "./line-chart-card";

const RANGES = [
  { key: "1w", label: "1週間", days: 7 },
  { key: "1m", label: "1ヶ月", days: 30 },
  { key: "3m", label: "3ヶ月", days: 90 },
  { key: "all", label: "全期間", days: null },
] as const;
type RangeKey = (typeof RANGES)[number]["key"];

const METRICS = {
  max: { label: "最大挙上重量", column: "max_weight_kg", decimals: 1 },
  volume: { label: "総負荷量", column: "total_volume", decimals: 0 },
} as const;
type MetricKey = keyof typeof METRICS;

// PostgREST の既定上限(1000行)で切れても古い側が落ちるよう、新しい順に取得して反転する
const ROW_LIMIT = 1000;

type Query = { range: RangeKey; ex?: string; metric: MetricKey };

function href({ range, ex, metric }: Query) {
  const p = new URLSearchParams({ range, metric });
  if (ex) p.set("ex", ex);
  return `/analytics?${p}`;
}

function Segmented<T extends string>({
  label,
  items,
  current,
  hrefOf,
}: {
  label: string;
  items: readonly { key: T; label: string }[];
  current: T;
  hrefOf: (key: T) => string;
}) {
  return (
    <nav aria-label={label} className="flex overflow-hidden rounded-lg border border-neutral-300 dark:border-neutral-700">
      {items.map((it) => (
        <Link
          key={it.key}
          href={hrefOf(it.key)}
          replace
          aria-current={it.key === current ? "true" : undefined}
          className={`flex h-11 flex-1 items-center justify-center text-sm ${
            it.key === current ? "bg-blue-600 font-semibold text-white" : ""
          }`}
        >
          {it.label}
        </Link>
      ))}
    </nav>
  );
}

async function AnalyticsContent({ searchParams }: Pick<PageProps<"/analytics">, "searchParams">) {
  const params = await searchParams;
  const today = todayString();

  const range: RangeKey = RANGES.some((r) => r.key === params.range) ? (params.range as RangeKey) : "1m";
  const metric: MetricKey = params.metric === "volume" ? "volume" : "max";
  const days = RANGES.find((r) => r.key === range)!.days;
  const periodFrom = days === null ? undefined : addDays(today, -(days - 1));

  const supabase = await createClient();

  let bodyQuery = supabase
    .from("body_metrics")
    .select("date, weight_kg, body_fat_pct")
    .lte("date", today)
    .order("date", { ascending: false })
    .limit(ROW_LIMIT);
  if (periodFrom) bodyQuery = bodyQuery.gte("date", periodFrom);

  const [bodyRes, statsIndexRes, exercisesRes] = await Promise.all([
    bodyQuery,
    // 実績のある種目の一覧と、直近に実施した種目(既定の選択)を決めるための索引
    supabase
      .from("exercise_daily_stats")
      .select("exercise_id, date")
      .order("date", { ascending: false })
      .limit(ROW_LIMIT),
    supabase.from("exercises").select("id, name"),
  ]);

  if (bodyRes.error || statsIndexRes.error || exercisesRes.error) {
    return (
      <p role="alert" className="p-4 text-sm text-red-600">
        データの取得に失敗しました。時間をおいて再度お試しください
      </p>
    );
  }

  // 体組成
  const body = [...bodyRes.data].reverse();
  const series = (pick: (r: (typeof body)[number]) => number | null): Measured[] =>
    body.flatMap((r) => {
      const v = pick(r);
      return v == null ? [] : [{ date: r.date, value: Number(v) }];
    });
  const weightPts = series((r) => r.weight_kg);
  const fatPts = series((r) => r.body_fat_pct);
  const daily = (pts: Measured[]) =>
    toDailySeries(pts, periodFrom ?? pts[0]?.date ?? today, today, true);

  // 種目の選択肢（直近に実施した順）
  const names = new Map(exercisesRes.data.map((e) => [e.id, e.name]));
  const optionIds = [...new Set(statsIndexRes.data.map((r) => r.exercise_id))];
  const options = optionIds.map((id) => ({ id, name: names.get(id) ?? "（不明な種目）" }));
  const exParam = typeof params.ex === "string" && z.uuid().safeParse(params.ex).success ? params.ex : undefined;
  const selectedId = exParam && optionIds.includes(exParam) ? exParam : optionIds[0];

  // 選択した種目の推移
  let exercisePts: Measured[] = [];
  if (selectedId) {
    const col = METRICS[metric].column;
    let q = supabase
      .from("exercise_daily_stats")
      .select(`date, ${col}`)
      .eq("exercise_id", selectedId)
      .lte("date", today)
      .order("date", { ascending: false })
      .limit(ROW_LIMIT);
    if (periodFrom) q = q.gte("date", periodFrom);
    const { data, error } = await q;
    if (error) {
      return (
        <p role="alert" className="p-4 text-sm text-red-600">
          データの取得に失敗しました。時間をおいて再度お試しください
        </p>
      );
    }
    exercisePts = (data as unknown as Record<string, string | number>[])
      .reverse()
      .map((r) => ({ date: String(r.date), value: Number(r[col]) }));
  }
  const exerciseDaily = toDailySeries(
    exercisePts,
    periodFrom ?? exercisePts[0]?.date ?? today,
    today,
    false,
  );

  const hrefFor = (q: Partial<Query>) => href({ range, ex: selectedId, metric, ...q });
  const exHrefs = Object.fromEntries(options.map((o) => [o.id, hrefFor({ ex: o.id })]));

  return (
    <div className="flex flex-col gap-4 px-4 py-4">
      <Segmented label="期間" items={RANGES} current={range} hrefOf={(k) => hrefFor({ range: k })} />

      <LineChartCard
        title="体重"
        unit="kg"
        decimals={1}
        colorVar="--series-1"
        data={daily(weightPts)}
        interpolated
        emptyMessage="この期間の体重の記録がありません"
      />
      <LineChartCard
        title="体脂肪率"
        unit="%"
        decimals={1}
        colorVar="--series-2"
        data={daily(fatPts)}
        interpolated
        emptyMessage="この期間の体脂肪率の記録がありません"
      />

      <section aria-label="筋トレ実績" className="flex flex-col gap-3">
        <h2 className="text-base font-bold">筋トレ実績</h2>
        {options.length === 0 ? (
          <p className="rounded-xl border border-neutral-200 p-4 text-sm text-neutral-500 dark:border-neutral-800">
            グラフには、ステータスが「実績」で完了チェックを付けたセットが使われます。まだ該当する記録がありません
          </p>
        ) : (
          <>
            <ExerciseSelect options={options} value={selectedId!} buildHref={exHrefs} />
            <Segmented
              label="指標"
              items={[
                { key: "max", label: METRICS.max.label },
                { key: "volume", label: METRICS.volume.label },
              ]}
              current={metric}
              hrefOf={(k) => hrefFor({ metric: k })}
            />
            <LineChartCard
              title={`${names.get(selectedId!) ?? "種目"}の${METRICS[metric].label}`}
              unit="kg"
              decimals={METRICS[metric].decimals}
              colorVar="--series-3"
              data={exerciseDaily}
              interpolated={false}
              emptyMessage="この期間に実績がありません"
            />
          </>
        )}
      </section>
    </div>
  );
}

export default function AnalyticsPage({ searchParams }: PageProps<"/analytics">) {
  return (
    <main className="flex flex-1 flex-col">
      <header className="px-4 pt-4">
        <h1 className="text-lg font-bold">分析</h1>
      </header>
      <Suspense fallback={<div className="m-4 h-96 animate-pulse rounded-xl bg-neutral-100 dark:bg-neutral-900" />}>
        <AnalyticsContent searchParams={searchParams} />
      </Suspense>
    </main>
  );
}
