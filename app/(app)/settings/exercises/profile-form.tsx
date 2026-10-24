"use client";

import { useState, useTransition } from "react";
import { updateProfile } from "./actions";

const inputClass =
  "h-12 w-full rounded-lg border border-neutral-300 bg-transparent px-3 text-base dark:border-neutral-700";

export function ProfileForm({ nickname, heightCm }: { nickname: string; heightCm: number | null }) {
  const [name, setName] = useState(nickname);
  const [height, setHeight] = useState(heightCm == null ? "" : String(heightCm));
  const [error, setError] = useState<string>();
  const [saved, setSaved] = useState(false);
  const [pending, startTransition] = useTransition();

  const submit = () => {
    setError(undefined);
    setSaved(false);
    const h = height.trim() === "" ? null : Number(height);
    if (h !== null && Number.isNaN(h)) {
      setError("身長は数値で入力してください");
      return;
    }
    startTransition(async () => {
      const res = await updateProfile({ nickname: name, height_cm: h });
      if (res.error) setError(res.error);
      else setSaved(true);
    });
  };

  return (
    <div className="flex flex-col gap-3">
      <label className="flex flex-col gap-1 text-sm">
        ニックネーム
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          maxLength={30}
          required
          className={inputClass}
        />
      </label>
      <label className="flex flex-col gap-1 text-sm">
        身長 (cm)
        <input
          type="number"
          inputMode="decimal"
          step={0.1}
          min={50}
          max={250}
          value={height}
          onChange={(e) => setHeight(e.target.value)}
          placeholder="未設定"
          className={inputClass}
        />
      </label>
      {error && (
        <p role="alert" className="text-sm text-red-600">
          {error}
        </p>
      )}
      {saved && !error && <p className="text-sm text-green-700">保存しました</p>}
      <button
        type="button"
        onClick={submit}
        disabled={pending}
        className="h-12 rounded-lg bg-blue-600 font-semibold text-white disabled:opacity-50"
      >
        {pending ? "保存中..." : "プロフィールを保存"}
      </button>
    </div>
  );
}
