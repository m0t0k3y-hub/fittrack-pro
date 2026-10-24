"use client";

import { useState, useTransition } from "react";
import { MUSCLE_LABELS } from "../../workouts/workout-types";
import { addExercise, archiveExercise, updateExercise } from "./actions";

type Item = { id: string; name: string; target_muscle: string };

const fieldClass =
  "h-12 min-w-0 rounded-lg border border-neutral-300 bg-background px-3 text-base dark:border-neutral-700";

function MuscleSelect({
  value,
  onChange,
}: {
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <select
      aria-label="部位"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className={`${fieldClass} w-28 shrink-0`}
    >
      {Object.entries(MUSCLE_LABELS).map(([k, label]) => (
        <option key={k} value={k}>
          {label}
        </option>
      ))}
    </select>
  );
}

function Row({ item, onError }: { item: Item; onError: (msg: string | undefined) => void }) {
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(item.name);
  const [muscle, setMuscle] = useState(item.target_muscle);
  const [pending, startTransition] = useTransition();

  const save = () =>
    startTransition(async () => {
      onError(undefined);
      const res = await updateExercise(item.id, { name, target_muscle: muscle });
      if (res.error) onError(res.error);
      else setEditing(false);
    });

  const remove = () => {
    if (!window.confirm(`「${item.name}」を削除しますか？過去の記録は残ります`)) return;
    startTransition(async () => {
      onError(undefined);
      const res = await archiveExercise(item.id);
      if (res.error) onError(res.error);
    });
  };

  if (editing) {
    return (
      <li className="flex flex-col gap-2 rounded-xl border border-blue-600 p-3">
        <div className="flex gap-2">
          <input
            aria-label="種目名"
            value={name}
            onChange={(e) => setName(e.target.value)}
            maxLength={30}
            className={`${fieldClass} flex-1`}
          />
          <MuscleSelect value={muscle} onChange={setMuscle} />
        </div>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={save}
            disabled={pending}
            className="h-11 flex-1 rounded-lg bg-blue-600 font-semibold text-white disabled:opacity-50"
          >
            保存
          </button>
          <button
            type="button"
            onClick={() => {
              setEditing(false);
              setName(item.name);
              setMuscle(item.target_muscle);
              onError(undefined);
            }}
            className="h-11 flex-1 rounded-lg border border-neutral-300 dark:border-neutral-700"
          >
            キャンセル
          </button>
        </div>
      </li>
    );
  }

  return (
    <li className="flex items-center gap-2 rounded-xl border border-neutral-200 py-1 pl-3 pr-1 dark:border-neutral-800">
      <span className="flex-1 font-semibold">{item.name}</span>
      <span className="text-xs text-neutral-500">{MUSCLE_LABELS[item.target_muscle]}</span>
      <button
        type="button"
        onClick={() => setEditing(true)}
        disabled={pending}
        className="h-11 px-2 text-sm text-blue-600"
        aria-label={`${item.name}を編集`}
      >
        編集
      </button>
      <button
        type="button"
        onClick={remove}
        disabled={pending}
        className="h-11 px-2 text-sm text-red-600"
        aria-label={`${item.name}を削除`}
      >
        削除
      </button>
    </li>
  );
}

export function CustomExercises({ items }: { items: Item[] }) {
  const [name, setName] = useState("");
  const [muscle, setMuscle] = useState("chest");
  const [error, setError] = useState<string>();
  const [pending, startTransition] = useTransition();

  const add = () =>
    startTransition(async () => {
      setError(undefined);
      const res = await addExercise({ name, target_muscle: muscle });
      if (res.error) setError(res.error);
      else setName("");
    });

  return (
    <div className="flex flex-col gap-3">
      <div className="flex gap-2">
        <input
          aria-label="新しい種目名"
          placeholder="種目名"
          value={name}
          onChange={(e) => setName(e.target.value)}
          maxLength={30}
          className={`${fieldClass} flex-1`}
        />
        <MuscleSelect value={muscle} onChange={setMuscle} />
      </div>
      <button
        type="button"
        onClick={add}
        disabled={pending || name.trim() === ""}
        className="h-12 rounded-lg border border-blue-600 font-semibold text-blue-600 disabled:opacity-40"
      >
        種目を追加
      </button>

      {error && (
        <p role="alert" className="text-sm text-red-600">
          {error}
        </p>
      )}

      {items.length === 0 ? (
        <p className="text-sm text-neutral-500">カスタム種目はまだありません</p>
      ) : (
        <ul className="flex flex-col gap-2">
          {items.map((it) => (
            <Row key={`${it.id}:${it.name}:${it.target_muscle}`} item={it} onError={setError} />
          ))}
        </ul>
      )}
    </div>
  );
}
