"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { deleteMetric, saveMetric } from "./actions";

const inputClass =
  "h-14 w-full rounded-lg border border-neutral-300 bg-transparent px-3 text-center text-2xl dark:border-neutral-700";

export type MetricInit = { weight: string; bodyFat: string; exists: boolean };
export type LastMetric = { date: string; weight_kg: number | null; body_fat_pct: number | null };

function parseOptional(v: string) {
  return v.trim() === "" ? null : Number(v);
}

export function MetricForm({
  date,
  initial,
  last,
}: {
  date: string;
  initial: MetricInit;
  last: LastMetric | null;
}) {
  const router = useRouter();
  const [weight, setWeight] = useState(initial.weight);
  const [bodyFat, setBodyFat] = useState(initial.bodyFat);
  const [error, setError] = useState<string>();
  const [pending, startTransition] = useTransition();

  const submit = () => {
    setError(undefined);
    const w = parseOptional(weight);
    const b = parseOptional(bodyFat);
    if ((w !== null && Number.isNaN(w)) || (b !== null && Number.isNaN(b))) {
      setError("数値を入力してください");
      return;
    }
    startTransition(async () => {
      const res = await saveMetric({ date, weight_kg: w, body_fat_pct: b });
      if (res?.error) setError(res.error);
    });
  };

  const remove = () => {
    if (!window.confirm("この日の身体計測を削除しますか？")) return;
    startTransition(async () => {
      const res = await deleteMetric(date);
      if (res?.error) setError(res.error);
    });
  };

  return (
    <div className="flex flex-col gap-5 px-4 py-4">
      <label className="flex flex-col gap-1 text-sm">
        日付
        {/* 日付を変えたら、その日の既存値を読み込み直すため URL を更新する */}
        <input
          type="date"
          value={date}
          required
          onChange={(e) => e.target.value && router.replace(`/metrics/new?date=${e.target.value}`)}
          className="h-12 w-full rounded-lg border border-neutral-300 bg-transparent px-3 text-base dark:border-neutral-700"
        />
      </label>

      {initial.exists && (
        <p className="rounded-lg bg-blue-50 p-3 text-sm text-blue-900">
          この日の記録があります。保存すると上書きされます
        </p>
      )}

      <label className="flex flex-col gap-1 text-sm">
        体重 (kg)
        <input
          type="number"
          inputMode="decimal"
          step={0.1}
          min={20}
          max={300}
          value={weight}
          onChange={(e) => setWeight(e.target.value)}
          placeholder={last?.weight_kg != null ? String(last.weight_kg) : "kg"}
          className={inputClass}
        />
      </label>

      <label className="flex flex-col gap-1 text-sm">
        体脂肪率 (%)
        <input
          type="number"
          inputMode="decimal"
          step={0.1}
          min={1}
          max={70}
          value={bodyFat}
          onChange={(e) => setBodyFat(e.target.value)}
          placeholder={last?.body_fat_pct != null ? String(last.body_fat_pct) : "%"}
          className={inputClass}
        />
      </label>

      {last && (
        <p className="text-xs text-neutral-500">
          前回（{last.date}）:{" "}
          {[
            last.weight_kg != null && `${last.weight_kg}kg`,
            last.body_fat_pct != null && `${last.body_fat_pct}%`,
          ]
            .filter(Boolean)
            .join(" / ")}
        </p>
      )}

      {error && (
        <p role="alert" className="text-sm text-red-600">
          {error}
        </p>
      )}

      <div className="flex flex-col gap-2">
        <button
          type="button"
          onClick={submit}
          disabled={pending}
          className="h-12 rounded-lg bg-blue-600 font-semibold text-white disabled:opacity-50"
        >
          {pending ? "保存中..." : "保存"}
        </button>
        <Link
          href={`/?date=${date}`}
          className="flex h-12 items-center justify-center rounded-lg border border-neutral-300 dark:border-neutral-700"
        >
          キャンセル
        </Link>
        {initial.exists && (
          <button
            type="button"
            onClick={remove}
            disabled={pending}
            className="h-12 text-sm text-red-600"
          >
            この日の記録を削除
          </button>
        )}
      </div>
    </div>
  );
}
