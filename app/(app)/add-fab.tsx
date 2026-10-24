"use client";

import Link from "next/link";
import { useState } from "react";

export function AddFab({ date }: { date: string }) {
  const [open, setOpen] = useState(false);

  return (
    <div className="fixed bottom-20 right-4 z-30 flex flex-col items-end gap-2">
      {open && (
        <div className="flex flex-col gap-2">
          <Link
            href={`/workouts/new?date=${date}`}
            className="rounded-full bg-background px-4 py-3 text-sm font-semibold shadow-lg ring-1 ring-neutral-200 dark:ring-neutral-700"
          >
            ワークアウトを記録・予定
          </Link>
          <Link
            href={`/metrics/new?date=${date}`}
            className="rounded-full bg-background px-4 py-3 text-sm font-semibold shadow-lg ring-1 ring-neutral-200 dark:ring-neutral-700"
          >
            身体計測を入力
          </Link>
        </div>
      )}
      <button
        type="button"
        aria-label={open ? "メニューを閉じる" : "記録・予定を追加"}
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
        className="flex h-14 w-14 items-center justify-center rounded-full bg-blue-600 text-3xl text-white shadow-lg"
      >
        {open ? "×" : "+"}
      </button>
    </div>
  );
}
