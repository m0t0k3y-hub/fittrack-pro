"use client";

import { useRouter } from "next/navigation";

export function ExerciseSelect({
  options,
  value,
  buildHref,
}: {
  options: { id: string; name: string }[];
  value: string;
  // 選択された種目IDから遷移先URLを組み立てる（期間などの他パラメータは呼び出し側で保持）
  buildHref: Record<string, string>;
}) {
  const router = useRouter();

  return (
    <select
      aria-label="種目"
      value={value}
      onChange={(e) => router.replace(buildHref[e.target.value])}
      className="h-12 w-full rounded-lg border border-neutral-300 bg-background px-3 text-base dark:border-neutral-700"
    >
      {options.map((o) => (
        <option key={o.id} value={o.id}>
          {o.name}
        </option>
      ))}
    </select>
  );
}
