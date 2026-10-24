import type { EmailOtpType } from "@supabase/supabase-js";
import { redirect } from "next/navigation";
import type { NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";

// 確認メールのリンクの着地点。セッションを確立して、成功したらホームへ移動する。
//
// - code: Supabase 既定のメールテンプレート。リンクは Supabase の /auth/v1/verify を経由して、
//   ?code=... 付きでここに戻る（PKCE）。登録したのと同じブラウザで開く必要がある。
// - token_hash: テンプレートを差し替えた場合（supabase/templates/confirmation.html）。
//   別の端末で開いても確認できる。
export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const code = searchParams.get("code");
  const tokenHash = searchParams.get("token_hash");
  const type = searchParams.get("type") as EmailOtpType | null;

  const supabase = await createClient();

  if (code) {
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) redirect("/");
  } else if (tokenHash && type) {
    const { error } = await supabase.auth.verifyOtp({ type, token_hash: tokenHash });
    if (!error) redirect("/");
  }

  redirect("/login?error=confirm");
}
