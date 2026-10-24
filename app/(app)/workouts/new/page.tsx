import Link from "next/link";
import { Suspense } from "react";
import { connection } from "next/server";
import { z } from "zod";
import { formatDateLabel, isValidDate, todayString } from "@/lib/date";
import { loadExercises, loadRecentDoneLogs, loadWorkout, toBlocks } from "../load";
import type { WorkoutInit } from "../workout-types";
import { WorkoutForm } from "../workout-form";

async function NewWorkoutContent({ searchParams }: Pick<PageProps<"/workouts/new">, "searchParams">) {
  // 「今日」はリクエスト時に決まる値。事前描画中に new Date() を評価しないよう明示する
  await connection();
  const params = await searchParams;
  const dateParam = typeof params.date === "string" ? params.date : undefined;
  const copyParam = typeof params.copy === "string" ? params.copy : undefined;
  const date = isValidDate(dateParam) ? dateParam : todayString();

  const [exercises, { hints, recent }] = await Promise.all([
    loadExercises(),
    loadRecentDoneLogs(),
  ]);

  const initial: WorkoutInit = { id: null, date, status: "planned", memo: "", exercises: [] };
  let notice: string | undefined;

  // 前回メニューのコピー: 種目とセット構成のみ。完了チェックは外し、メモは引き継がない
  if (copyParam && z.uuid().safeParse(copyParam).success) {
    const source = await loadWorkout(copyParam);
    if (source) {
      const archived = new Map(exercises.filter((e) => e.archived).map((e) => [e.id, e.name]));
      const removed = new Set<string>();
      initial.exercises = toBlocks(source.workout_sets, true).filter((b) => {
        const name = archived.get(b.exerciseId);
        if (name) removed.add(name);
        return !name;
      });
      if (removed.size > 0) {
        notice = `削除済みの種目はコピーしませんでした: ${[...removed].join("、")}`;
      }
    }
  }

  const copying = initial.exercises.length > 0;

  return (
    <>
      {!copying && recent.length > 0 && (
        <section aria-label="過去の記録からコピー" className="flex flex-col gap-2 px-4 pt-4">
          <h2 className="text-sm font-bold">過去の記録からコピー</h2>
          <ul className="flex flex-col gap-2">
            {recent.map((r) => (
              <li key={r.id}>
                <Link
                  href={`/workouts/new?date=${date}&copy=${r.id}`}
                  className="block rounded-xl border border-neutral-200 p-3 text-sm dark:border-neutral-800"
                >
                  <span className="font-semibold">{formatDateLabel(r.date)}</span>
                  <span className="ml-2 text-neutral-600 dark:text-neutral-400">
                    {r.exerciseNames.join("、")}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}
      {/* コピー元の切替時にフォーム状態を作り直すため key を付ける */}
      <WorkoutForm
        key={copyParam ?? "blank"}
        initial={initial}
        exercises={exercises}
        hints={hints}
        notice={notice}
      />
    </>
  );
}

export default function NewWorkoutPage({ searchParams }: PageProps<"/workouts/new">) {
  return (
    <main className="flex flex-1 flex-col">
      <header className="px-4 pt-4">
        <h1 className="text-lg font-bold">ワークアウトを追加</h1>
      </header>
      <Suspense fallback={<div className="m-4 h-96 animate-pulse rounded-xl bg-neutral-100 dark:bg-neutral-900" />}>
        <NewWorkoutContent searchParams={searchParams} />
      </Suspense>
    </main>
  );
}
