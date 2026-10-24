import { connection } from "next/server";
import { Suspense } from "react";
import { logout } from "../../../(auth)/actions";
import { createClient } from "@/lib/supabase/server";
import { MUSCLE_LABELS } from "../../workouts/workout-types";
import { CustomExercises } from "./custom-exercises";
import { ProfileForm } from "./profile-form";

async function SettingsContent() {
  // 認証セッションの検証が現在時刻に依存するため、事前描画ではなくリクエスト時に実行する
  await connection();
  const supabase = await createClient();
  const [profileRes, exercisesRes] = await Promise.all([
    supabase.from("profiles").select("nickname, height_cm").maybeSingle(),
    supabase
      .from("exercises")
      .select("id, name, target_muscle, user_id")
      .is("archived_at", null)
      .order("name"),
  ]);

  if (profileRes.error || exercisesRes.error) {
    return (
      <p role="alert" className="p-4 text-sm text-red-600">
        データの取得に失敗しました。時間をおいて再度お試しください
      </p>
    );
  }

  const profile = profileRes.data;
  const custom = exercisesRes.data.filter((e) => e.user_id !== null);
  const defaults = exercisesRes.data.filter((e) => e.user_id === null);

  return (
    <div className="flex flex-col gap-8 px-4 py-4">
      <section aria-labelledby="profile-h" className="flex flex-col gap-3">
        <h2 id="profile-h" className="text-base font-bold">
          プロフィール
        </h2>
        <ProfileForm
          nickname={profile?.nickname ?? ""}
          heightCm={profile?.height_cm == null ? null : Number(profile.height_cm)}
        />
      </section>

      <section aria-labelledby="custom-h" className="flex flex-col gap-3">
        <h2 id="custom-h" className="text-base font-bold">
          カスタム種目
        </h2>
        <CustomExercises items={custom} />
      </section>

      <section aria-labelledby="default-h" className="flex flex-col gap-3">
        <h2 id="default-h" className="text-base font-bold">
          デフォルト種目
        </h2>
        {Object.entries(MUSCLE_LABELS).flatMap(([key, label]) => {
          const list = defaults.filter((e) => e.target_muscle === key);
          return list.length === 0
            ? []
            : [
                <div key={key}>
                  <h3 className="text-xs text-neutral-500">{label}</h3>
                  <p className="text-sm">{list.map((e) => e.name).join("、")}</p>
                </div>,
              ];
        })}
      </section>

      <form action={logout}>
        <button className="h-12 w-full rounded-lg border border-neutral-300 dark:border-neutral-700">
          ログアウト
        </button>
      </form>
    </div>
  );
}

export default function SettingsPage() {
  return (
    <main className="flex flex-1 flex-col">
      <header className="px-4 pt-4">
        <h1 className="text-lg font-bold">設定</h1>
      </header>
      <Suspense fallback={<div className="m-4 h-96 animate-pulse rounded-xl bg-neutral-100 dark:bg-neutral-900" />}>
        <SettingsContent />
      </Suspense>
    </main>
  );
}
