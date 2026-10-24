import { notFound } from "next/navigation";
import { connection } from "next/server";
import { Suspense } from "react";
import { z } from "zod";
import { loadExercises, loadRecentDoneLogs, loadWorkout, toBlocks } from "../load";
import { WorkoutForm } from "../workout-form";
import type { WorkoutInit } from "../workout-types";

async function EditWorkoutContent({ params }: Pick<PageProps<"/workouts/[id]">, "params">) {
  // 認証セッションの検証が現在時刻に依存するため、事前描画ではなくリクエスト時に実行する
  await connection();
  const { id } = await params;
  if (!z.uuid().safeParse(id).success) notFound();

  const log = await loadWorkout(id);
  if (!log) notFound();

  const [exercises, { hints }] = await Promise.all([loadExercises(), loadRecentDoneLogs(id)]);

  const initial: WorkoutInit = {
    id: log.id,
    date: log.date,
    status: log.status,
    memo: log.memo ?? "",
    exercises: toBlocks(log.workout_sets),
  };

  return <WorkoutForm initial={initial} exercises={exercises} hints={hints} />;
}

export default function EditWorkoutPage({ params }: PageProps<"/workouts/[id]">) {
  return (
    <main className="flex flex-1 flex-col">
      <header className="px-4 pt-4">
        <h1 className="text-lg font-bold">ワークアウトを編集</h1>
      </header>
      <Suspense fallback={<div className="m-4 h-96 animate-pulse rounded-xl bg-neutral-100 dark:bg-neutral-900" />}>
        <EditWorkoutContent params={params} />
      </Suspense>
    </main>
  );
}
