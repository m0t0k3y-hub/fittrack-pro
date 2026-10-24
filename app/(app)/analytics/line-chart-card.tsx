"use client";

import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { DailyPoint } from "@/lib/series";

type Props = {
  title: string;
  unit: string;
  decimals: number;
  // CSS カスタムプロパティ名 (例: "--series-1")
  colorVar: string;
  data: DailyPoint[];
  // true: 実測のない日を補間した値で線をつなぐ。ツールチップに「補間」と表示する
  interpolated: boolean;
  emptyMessage: string;
};

const NICE_STEPS = [0.1, 0.2, 0.5, 1, 2, 5, 10, 20, 50, 100, 200, 500, 1000, 2000, 5000];

// 値の変化が見える範囲（0始まりにはしない）に、切りのよい刻みの目盛りを振る
function niceScale(values: number[]): { domain: [number, number]; ticks: number[] } {
  if (values.length === 0) return { domain: [0, 1], ticks: [0, 1] };
  const lo = Math.min(...values);
  const hi = Math.max(...values);
  // 値が1種類だけでも線が潰れないよう、最低限の幅を持たせる
  const span = Math.max(hi - lo, Math.abs(hi) * 0.02, 0.5);
  const step = NICE_STEPS.find((s) => s >= (span * 1.3) / 4) ?? NICE_STEPS[NICE_STEPS.length - 1];
  const min = Math.floor((lo - span * 0.1) / step) * step;
  const max = Math.ceil((hi + span * 0.1) / step) * step;
  const ticks: number[] = [];
  for (let t = min; t <= max + step / 2; t += step) ticks.push(Math.round(t * 1e6) / 1e6);
  return { domain: [ticks[0], ticks[ticks.length - 1]], ticks };
}

const md = (date: string) => `${Number(date.slice(5, 7))}/${Number(date.slice(8, 10))}`;

type TooltipPayload = { payload: DailyPoint };

function ChartTooltip({
  active,
  payload,
  unit,
  decimals,
  colorVar,
}: {
  active?: boolean;
  payload?: TooltipPayload[];
  unit: string;
  decimals: number;
  colorVar: string;
}) {
  const point = payload?.[0]?.payload;
  if (!active || !point || point.value === null) return null;
  return (
    <div className="rounded-lg border border-neutral-200 bg-background px-3 py-2 text-sm shadow-md dark:border-neutral-700">
      <p className="text-xs text-neutral-500">{point.date}</p>
      <p className="flex items-center gap-2">
        {/* 線のキー（色は印で示し、文字は本文色のまま） */}
        <span className="inline-block h-0.5 w-4 rounded" style={{ background: `var(${colorVar})` }} />
        <span className="font-bold">
          {point.value.toFixed(decimals)}
          {unit}
        </span>
        {!point.measured && <span className="text-xs text-neutral-500">補間</span>}
      </p>
    </div>
  );
}

export function LineChartCard({
  title,
  unit,
  decimals,
  colorVar,
  data,
  interpolated,
  emptyMessage,
}: Props) {
  const measured = data.filter((d) => d.measured && d.value !== null);
  const latest = measured[measured.length - 1];
  const values = measured.map((d) => d.value as number);

  const { domain, ticks } = niceScale(values);

  return (
    <section
      aria-label={title}
      className="flex flex-col gap-2 rounded-xl border border-neutral-200 p-3 dark:border-neutral-800"
    >
      <header className="flex items-baseline justify-between gap-2">
        <h2 className="text-sm font-bold">{title}</h2>
        {latest && (
          <p className="text-right">
            <span className="text-2xl font-bold">{(latest.value as number).toFixed(decimals)}</span>
            <span className="ml-0.5 text-sm text-neutral-500">{unit}</span>
            <span className="ml-2 text-xs text-neutral-500">{md(latest.date)}</span>
          </p>
        )}
      </header>

      {measured.length === 0 ? (
        <p className="py-10 text-center text-sm text-neutral-500">{emptyMessage}</p>
      ) : (
        <>
          <div className="h-52 w-full" role="img" aria-label={`${title}の推移グラフ`}>
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={data} margin={{ top: 8, right: 12, bottom: 0, left: 0 }}>
                <CartesianGrid stroke="var(--chart-grid)" strokeWidth={1} vertical={false} />
                <XAxis
                  dataKey="date"
                  tickFormatter={md}
                  tick={{ fill: "var(--chart-axis)", fontSize: 11 }}
                  axisLine={{ stroke: "var(--chart-grid)" }}
                  tickLine={false}
                  minTickGap={32}
                  interval="preserveStartEnd"
                />
                <YAxis
                  domain={domain}
                  ticks={ticks}
                  tick={{ fill: "var(--chart-axis)", fontSize: 11 }}
                  axisLine={false}
                  tickLine={false}
                  width={44}
                />
                <Tooltip
                  cursor={{ stroke: "var(--chart-axis)", strokeWidth: 1 }}
                  content={(p) => (
                    <ChartTooltip
                      active={p.active}
                      payload={p.payload as unknown as TooltipPayload[]}
                      unit={unit}
                      decimals={decimals}
                      colorVar={colorVar}
                    />
                  )}
                />
                <Line
                  type="linear"
                  dataKey="value"
                  stroke={`var(${colorVar})`}
                  strokeWidth={2}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  // 補間しない系列(種目別)は、実測点どうしを線でつなぐ
                  connectNulls={!interpolated}
                  isAnimationActive={false}
                  // 実測点だけに印を付ける（補間区間は線のみ）。8px、背景色の2pxリング
                  dot={(p) => {
                    const { cx, cy, payload, index } = p as unknown as {
                      cx: number;
                      cy: number;
                      payload: DailyPoint;
                      index: number;
                    };
                    return payload.measured && payload.value !== null ? (
                      <circle
                        key={index}
                        cx={cx}
                        cy={cy}
                        r={4}
                        fill={`var(${colorVar})`}
                        stroke="var(--background)"
                        strokeWidth={2}
                      />
                    ) : (
                      <g key={index} />
                    );
                  }}
                  activeDot={{ r: 5, fill: `var(${colorVar})`, stroke: "var(--background)", strokeWidth: 2 }}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>

          {interpolated && (
            <p className="text-xs text-neutral-500">● は実測値、実測のない日は前後の値から補間しています</p>
          )}

          <details className="text-sm">
            <summary className="flex h-11 cursor-pointer items-center text-neutral-600 dark:text-neutral-400">
              表で見る
            </summary>
            <div className="max-h-60 overflow-y-auto">
              <table className="w-full text-left">
                <thead className="sticky top-0 bg-background text-xs text-neutral-500">
                  <tr>
                    <th className="py-1 font-normal">日付</th>
                    <th className="py-1 text-right font-normal">
                      {title}（{unit}）
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {[...measured].reverse().map((d) => (
                    <tr key={d.date} className="border-t border-neutral-100 dark:border-neutral-800">
                      <td className="py-1">{d.date}</td>
                      <td className="py-1 text-right">{(d.value as number).toFixed(decimals)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </details>
        </>
      )}
    </section>
  );
}
