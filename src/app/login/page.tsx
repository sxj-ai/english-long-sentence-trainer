import { redirect } from "next/navigation";
import Link from "next/link";
import { Badge } from "@/components/common/Badge";
import { loginAction } from "@/features/auth/actions";
import { getCurrentUser, getDefaultPathForRole } from "@/lib/auth";

const errorMessages: Record<string, string> = {
  missing: "请输入用户名和密码。",
  invalid: "用户名或密码不正确，或账号已被禁用。"
};

interface LoginPageProps {
  searchParams?: Promise<{
    error?: string;
    redirectTo?: string;
  }>;
}

function getSafeRedirectTo(value?: string) {
  const redirectTo = String(value ?? "").trim();

  if (!redirectTo || !redirectTo.startsWith("/") || redirectTo.startsWith("//")) {
    return "";
  }

  return redirectTo;
}

export default async function LoginPage({ searchParams }: LoginPageProps) {
  const resolvedSearchParams = await searchParams;
  const redirectTo = getSafeRedirectTo(resolvedSearchParams?.redirectTo);
  const currentUser = await getCurrentUser();

  if (currentUser) {
    redirect(currentUser.role === "STUDENT" && redirectTo ? redirectTo : getDefaultPathForRole(currentUser.role));
  }

  const error = resolvedSearchParams?.error;

  return (
    <div className="auth-page">
      <section className="auth-panel">
        <div className="section-heading">
          <Badge tone="green">账号登录</Badge>
          <h1>进入教学系统</h1>
          <p>管理员、老师和学生使用同一个入口登录，系统会根据账号角色进入对应界面。</p>
        </div>

        {error ? <div className="form-alert">{errorMessages[error] ?? "登录失败，请重试。"}</div> : null}

        <form action={loginAction} className="form-stack">
          <input name="redirectTo" type="hidden" value={redirectTo} />

          <label className="field-stack">
            <span>学号 / 用户名</span>
            <input name="username" autoComplete="username" required />
          </label>

          <label className="field-stack">
            <span>密码</span>
            <input name="password" type="password" autoComplete="current-password" required />
          </label>

          <button className="primary-link form-submit" type="submit">
            登录
          </button>
        </form>

        <p className="auth-switch">
          学生还没有账号？<Link href="/register">去注册</Link>
        </p>
      </section>
    </div>
  );
}
