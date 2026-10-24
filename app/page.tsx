import { Suspense } from "react";
import { logout } from "./(auth)/actions";
import { createClient } from "@/lib/supabase/server";

async function CurrentUser() {
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  return <p className="text-sm">ログイン中: {data?.claims?.email}</p>;
}

// カレンダー画面ができるまでの仮ホーム
export default function Home() {
  return (
    <main className="mx-auto flex w-full max-w-sm flex-1 flex-col justify-center gap-4 px-4">
      <h1 className="text-2xl font-bold">Bodymenter</h1>
      <Suspense fallback={<p className="text-sm">&nbsp;</p>}>
        <CurrentUser />
      </Suspense>
      <form action={logout}>
        <button className="h-12 w-full rounded-lg border border-neutral-300 dark:border-neutral-700">
          ログアウト
        </button>
      </form>
    </main>
  );
}
