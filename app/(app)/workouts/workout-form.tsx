"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { deleteWorkout, saveWorkout } from "./actions";
import {
  MUSCLE_LABELS,
  type ExerciseOption,
  type SetHints,
  type WorkoutInit,
} from "./workout-types";

type SetDraft = { key: string; weight: string; reps: string; isDone: boolean };
type ExerciseDraft = { key: string; exerciseId: string; sets: SetDraft[] };

const inputClass =
  "h-12 w-full rounded-lg border border-neutral-300 bg-transparent px-2 text-center text-base dark:border-neutral-700";

const WEIGHT_STEP = 0.5;

// React の key 用（DOM には出力されない）
const newKey = () => crypto.randomUUID();

function parseWeight(v: string) {
  return v.trim() === "" ? NaN : Number(v);
}

export function WorkoutForm({
  initial,
  exercises,
  hints,
  notice,
}: {
  initial: WorkoutInit;
  exercises: ExerciseOption[];
  hints: SetHints;
  notice?: string;
}) {
  const [date, setDate] = useState(initial.date);
  const [status, setStatus] = useState(initial.status);
  const [memo, setMemo] = useState(initial.memo);
  const [blocks, setBlocks] = useState<ExerciseDraft[]>(() =>
    initial.exercises.map((e) => ({
      key: newKey(),
      exerciseId: e.exerciseId,
      sets: e.sets.map((s) => ({
        key: newKey(),
        weight: String(s.weight),
        reps: String(s.reps),
        isDone: s.isDone,
      })),
    })),
  );
  const [pickId, setPickId] = useState("");
  const [error, setError] = useState<string>();
  const [pending, startTransition] = useTransition();

  const byId = new Map(exercises.map((e) => [e.id, e]));
  const usable = exercises.filter((e) => !e.archived);
  const muscles = Object.keys(MUSCLE_LABELS).filter((m) => usable.some((e) => e.target_muscle === m));

  const updateBlock = (key: string, fn: (b: ExerciseDraft) => ExerciseDraft) =>
    setBlocks((bs) => bs.map((b) => (b.key === key ? fn(b) : b)));

  const updateSet = (bKey: string, sKey: string, patch: Partial<SetDraft>) =>
    updateBlock(bKey, (b) => ({
      ...b,
      sets: b.sets.map((s) => (s.key === sKey ? { ...s, ...patch } : s)),
    }));

  const addExercise = () => {
    if (!pickId) return;
    const hint = hints[pickId];
    setBlocks((bs) => [
      ...bs,
      {
        key: newKey(),
        exerciseId: pickId,
        sets: [
          {
            key: newKey(),
            weight: hint ? String(hint.weight) : "",
            reps: hint ? String(hint.reps) : "",
            isDone: false,
          },
        ],
      },
    ]);
    setPickId("");
  };

  // セット数の増減。増やす行は直前のセットの値を引き継ぐ
  const setCount = (bKey: string, count: number) =>
    updateBlock(bKey, (b) => {
      const n = Math.max(1, Math.min(50, count));
      if (n <= b.sets.length) return { ...b, sets: b.sets.slice(0, n) };
      const last = b.sets[b.sets.length - 1];
      const extra = Array.from({ length: n - b.sets.length }, () => ({
        key: newKey(),
        weight: last?.weight ?? "",
        reps: last?.reps ?? "",
        isDone: false,
      }));
      return { ...b, sets: [...b.sets, ...extra] };
    });

  const stepWeight = (bKey: string, sKey: string, delta: number) =>
    updateBlock(bKey, (b) => ({
      ...b,
      sets: b.sets.map((s) => {
        if (s.key !== sKey) return s;
        const cur = parseWeight(s.weight);
        const next = Math.max(0, (Number.isNaN(cur) ? 0 : cur) + delta);
        return { ...s, weight: String(next) };
      }),
    }));

  const submit = () => {
    setError(undefined);
    const incomplete = blocks.some((b) =>
      b.sets.some((s) => Number.isNaN(parseWeight(s.weight)) || s.reps.trim() === ""),
    );
    if (incomplete) {
      setError("重量と回数をすべてのセットに入力してください（自重は0kg）");
      return;
    }
    const sets = blocks.flatMap((b) =>
      b.sets.map((s) => ({
        exercise_id: b.exerciseId,
        weight_kg: parseWeight(s.weight),
        reps: Number(s.reps),
        is_done: s.isDone,
      })),
    );
    startTransition(async () => {
      const res = await saveWorkout({ id: initial.id, date, status, memo, sets });
      if (res?.error) setError(res.error);
    });
  };

  const remove = () => {
    if (!initial.id || !window.confirm("このワークアウトを削除しますか？")) return;
    startTransition(async () => {
      const res = await deleteWorkout(initial.id!, date);
      if (res?.error) setError(res.error);
    });
  };

  return (
    <div className="flex flex-col gap-5 px-4 py-4">
      {notice && <p className="rounded-lg bg-amber-100 p-3 text-sm text-amber-900">{notice}</p>}

      <div className="flex items-center gap-3">
        <label className="flex flex-1 flex-col gap-1 text-sm">
          日付
          <input
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            required
            className={`${inputClass} text-left`}
          />
        </label>
        <div role="group" aria-label="ステータス" className="flex flex-col gap-1 text-sm">
          ステータス
          <div className="flex h-12 overflow-hidden rounded-lg border border-neutral-300 dark:border-neutral-700">
            {(
              [
                ["planned", "予定"],
                ["done", "実績"],
              ] as const
            ).map(([value, label]) => (
              <button
                key={value}
                type="button"
                aria-pressed={status === value}
                onClick={() => setStatus(value)}
                className={`px-4 font-semibold ${
                  status === value
                    ? value === "done"
                      ? "bg-green-600 text-white"
                      : "bg-amber-500 text-white"
                    : ""
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {blocks.map((b) => {
        const ex = byId.get(b.exerciseId);
        const hint = hints[b.exerciseId];
        return (
          <section
            key={b.key}
            className="flex flex-col gap-3 rounded-xl border border-neutral-200 p-3 dark:border-neutral-800"
          >
            <div className="flex items-start justify-between gap-2">
              <div>
                <h3 className="font-bold">{ex?.name ?? "（不明な種目）"}</h3>
                {hint && (
                  <p className="text-xs text-neutral-500">
                    前回（{hint.date}）: {hint.weight}kg × {hint.reps}
                  </p>
                )}
              </div>
              <button
                type="button"
                onClick={() => setBlocks((bs) => bs.filter((x) => x.key !== b.key))}
                className="h-11 px-2 text-sm text-red-600"
                aria-label={`${ex?.name ?? "種目"}を削除`}
              >
                削除
              </button>
            </div>

            <div className="flex items-center gap-2 text-sm">
              <span>セット数</span>
              <button
                type="button"
                aria-label="セットを減らす"
                onClick={() => setCount(b.key, b.sets.length - 1)}
                className="h-11 w-11 rounded-lg border border-neutral-300 text-xl dark:border-neutral-700"
              >
                −
              </button>
              <span className="w-6 text-center font-semibold">{b.sets.length}</span>
              <button
                type="button"
                aria-label="セットを増やす"
                onClick={() => setCount(b.key, b.sets.length + 1)}
                className="h-11 w-11 rounded-lg border border-neutral-300 text-xl dark:border-neutral-700"
              >
                ＋
              </button>
            </div>

            <ol className="flex flex-col gap-2">
              {b.sets.map((s, i) => (
                <li key={s.key} className="flex items-center gap-1.5">
                  <span className="w-5 text-center text-xs text-neutral-500">{i + 1}</span>
                  <button
                    type="button"
                    aria-label="重量を0.5kg減らす"
                    onClick={() => stepWeight(b.key, s.key, -WEIGHT_STEP)}
                    className="h-12 w-9 shrink-0 rounded-lg border border-neutral-300 dark:border-neutral-700"
                  >
                    −
                  </button>
                  <input
                    type="number"
                    inputMode="decimal"
                    step={WEIGHT_STEP}
                    min={0}
                    aria-label={`${i + 1}セット目の重量(kg)`}
                    placeholder="kg"
                    value={s.weight}
                    onChange={(e) => updateSet(b.key, s.key, { weight: e.target.value })}
                    className={inputClass}
                  />
                  <button
                    type="button"
                    aria-label="重量を0.5kg増やす"
                    onClick={() => stepWeight(b.key, s.key, WEIGHT_STEP)}
                    className="h-12 w-9 shrink-0 rounded-lg border border-neutral-300 dark:border-neutral-700"
                  >
                    ＋
                  </button>
                  <input
                    type="number"
                    inputMode="numeric"
                    step={1}
                    min={1}
                    aria-label={`${i + 1}セット目の回数`}
                    placeholder="回"
                    value={s.reps}
                    onChange={(e) => updateSet(b.key, s.key, { reps: e.target.value })}
                    className={`${inputClass} !w-16 shrink-0`}
                  />
                  <input
                    type="checkbox"
                    aria-label={`${i + 1}セット目を完了`}
                    checked={s.isDone}
                    onChange={(e) => updateSet(b.key, s.key, { isDone: e.target.checked })}
                    className="h-7 w-7 shrink-0"
                  />
                </li>
              ))}
            </ol>
          </section>
        );
      })}

      <div className="flex gap-2">
        <select
          value={pickId}
          onChange={(e) => setPickId(e.target.value)}
          aria-label="追加する種目"
          className="h-12 min-w-0 flex-1 rounded-lg border border-neutral-300 bg-background px-2 dark:border-neutral-700"
        >
          <option value="">種目を選択…</option>
          {muscles.map((m) => (
            <optgroup key={m} label={MUSCLE_LABELS[m]}>
              {usable
                .filter((e) => e.target_muscle === m)
                .map((e) => (
                  <option key={e.id} value={e.id}>
                    {e.name}
                  </option>
                ))}
            </optgroup>
          ))}
        </select>
        <button
          type="button"
          onClick={addExercise}
          disabled={!pickId}
          className="h-12 shrink-0 rounded-lg border border-blue-600 px-4 font-semibold text-blue-600 disabled:opacity-40"
        >
          追加
        </button>
      </div>

      <label className="flex flex-col gap-1 text-sm">
        メモ
        <textarea
          value={memo}
          onChange={(e) => setMemo(e.target.value)}
          rows={3}
          maxLength={1000}
          placeholder="インターバル、コンディションなど"
          className="w-full rounded-lg border border-neutral-300 bg-transparent p-3 text-base dark:border-neutral-700"
        />
      </label>

      {error && (
        <p role="alert" className="text-sm text-red-600">
          {error}
        </p>
      )}

      <div className="flex flex-col gap-2">
        <button
          type="button"
          onClick={submit}
          disabled={pending || blocks.length === 0}
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
        {initial.id && (
          <button
            type="button"
            onClick={remove}
            disabled={pending}
            className="h-12 text-sm text-red-600"
          >
            このワークアウトを削除
          </button>
        )}
      </div>
    </div>
  );
}
