"use client";

import Link from "next/link";
import { useActionState } from "react";
import { login, signup, type AuthState } from "./actions";

const inputClass =
  "h-12 w-full rounded-lg border border-neutral-300 bg-transparent px-3 text-base dark:border-neutral-700";

export function AuthForm({ mode, notice }: { mode: "login" | "signup"; notice?: string }) {
  const isLogin = mode === "login";
  const [state, formAction, pending] = useActionState<AuthState, FormData>(
    isLogin ? login : signup,
    {},
  );

  return (
    <main className="mx-auto flex w-full max-w-sm flex-1 flex-col justify-center gap-6 px-4 py-10">
      <h1 className="text-2xl font-bold">{isLogin ? "ログイン" : "新規登録"}</h1>

      {notice && <p className="rounded-lg bg-amber-100 p-3 text-sm text-amber-900">{notice}</p>}

      <form action={formAction} className="flex flex-col gap-4">
        {!isLogin && (
          <label className="flex flex-col gap-1 text-sm">
            ニックネーム
            <input name="nickname" type="text" required maxLength={30} className={inputClass} />
          </label>
        )}
        <label className="flex flex-col gap-1 text-sm">
          メールアドレス
          <input
            name="email"
            type="email"
            inputMode="email"
            autoComplete="email"
            required
            className={inputClass}
          />
        </label>
        <label className="flex flex-col gap-1 text-sm">
          パスワード（8文字以上）
          <input
            name="password"
            type="password"
            autoComplete={isLogin ? "current-password" : "new-password"}
            minLength={8}
            required
            className={inputClass}
          />
        </label>

        {state.error && (
          <p role="alert" className="text-sm text-red-600">
            {state.error}
          </p>
        )}
        {state.message && <p className="text-sm text-green-700">{state.message}</p>}

        <button
          type="submit"
          disabled={pending}
          className="h-12 rounded-lg bg-blue-600 font-semibold text-white disabled:opacity-60"
        >
          {pending ? "送信中..." : isLogin ? "ログイン" : "登録する"}
        </button>
      </form>

      <p className="text-center text-sm">
        {isLogin ? (
          <>
            アカウントをお持ちでない方は{" "}
            <Link href="/signup" className="text-blue-600 underline">
              新規登録
            </Link>
          </>
        ) : (
          <>
            登録済みの方は{" "}
            <Link href="/login" className="text-blue-600 underline">
              ログイン
            </Link>
          </>
        )}
      </p>
    </main>
  );
}
