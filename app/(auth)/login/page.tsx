import { Suspense } from "react";
import { AuthForm } from "../auth-form";

async function LoginContent({ searchParams }: Pick<PageProps<"/login">, "searchParams">) {
  const { error } = await searchParams;
  const notice =
    error === "confirm" ? "確認リンクが無効か期限切れです。再度登録をお試しください" : undefined;

  return <AuthForm mode="login" notice={notice} />;
}

export default function LoginPage({ searchParams }: PageProps<"/login">) {
  return (
    <Suspense fallback={<AuthForm mode="login" />}>
      <LoginContent searchParams={searchParams} />
    </Suspense>
  );
}
