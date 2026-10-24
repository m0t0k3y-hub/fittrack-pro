import { addDays, diffDays } from "./date";

export type Measured = { date: string; value: number };
export type DailyPoint = { date: string; value: number | null; measured: boolean };

// from〜to を日次に展開する。
// interpolate=true: 実測点の間を線形補間（表示用。最初/最後の実測点の外側は null のまま）
// interpolate=false: 実測のない日は null
export function toDailySeries(
  points: Measured[],
  from: string,
  to: string,
  interpolate: boolean,
): DailyPoint[] {
  const sorted = [...points].sort((a, b) => a.date.localeCompare(b.date));
  const byDate = new Map(sorted.map((p) => [p.date, p.value]));
  const out: DailyPoint[] = [];

  let next = 0; // 次に出会う実測点の index
  let prev: Measured | null = null;
  const total = diffDays(from, to);

  for (let i = 0; i <= total; i++) {
    const date = addDays(from, i);
    while (next < sorted.length && sorted[next].date < date) {
      prev = sorted[next];
      next++;
    }
    const exact = byDate.get(date);
    if (exact !== undefined) {
      out.push({ date, value: exact, measured: true });
      continue;
    }
    const after = sorted[next];
    if (interpolate && prev && after) {
      const span = diffDays(prev.date, after.date);
      const t = diffDays(prev.date, date) / span;
      out.push({ date, value: prev.value + (after.value - prev.value) * t, measured: false });
    } else {
      out.push({ date, value: null, measured: false });
    }
  }
  return out;
}
