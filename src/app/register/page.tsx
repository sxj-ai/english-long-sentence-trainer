import Link from "next/link";
import { redirect } from "next/navigation";
import { Badge } from "@/components/common/Badge";
import { registerStudentAction } from "@/features/auth/actions";
import { getCurrentUser, getDefaultPathForRole } from "@/lib/auth";

const errorMessages: Record<string, string> = {
  missing: "请填写所有注册信息。",
  "weak-password": "密码至少需要 8 位。",
  "password-mismatch": "两次输入的密码不一致。",
  "invalid-code": "老师邀请码不存在或已不可用。",
  "username-exists": "这个用户名已经被使用，请换一个。",
  "student-no-exists": "这个学号已经被使用，请检查后重新填写。"
};

interface RegisterPageProps {
  searchParams?: Promise<{
    error?: string;
  }>;
}

export default async function RegisterPage({ searchParams }: RegisterPageProps) {
  const currentUser = await getCurrentUser();

  if (currentUser) {
    redirect(getDefaultPathForRole(currentUser.role));
  }

  const resolvedSearchParams = await searchParams;
  const error = resolvedSearchParams?.error;

  return (
    <div className="auth-page">
      <section className="auth-panel auth-panel-wide">
        <div className="section-heading">
          <Badge tone="blue">学生注册</Badge>
          <h1>创建学生账号</h1>
          <p>学生注册时输入老师邀请码，系统会先把学生绑定到老师名下，后续由老师分入班级。</p>
        </div>

        {error ? <div className="form-alert">{errorMessages[error] ?? "注册失败，请重试。"}</div> : null}

        <form action={registerStudentAction} className="form-stack">
          <div className="form-grid">
            <label className="field-stack">
              <span>真实姓名</span>
              <input name="realName" placeholder="例如：李明" autoComplete="name" required />
            </label>

            <label className="field-stack">
              <span>学号</span>
              <input name="studentNo" placeholder="例如：2026001" autoComplete="off" required />
            </label>

            <label className="field-stack">
              <span>用户名</span>
              <input name="username" placeholder="例如：liming2026" autoComplete="username" required />
            </label>

            <label className="field-stack">
              <span>老师邀请码</span>
              <input name="invitationCode" placeholder="例如：T-1A2B3C4D" autoComplete="off" required />
            </label>

            <label className="field-stack">
              <span>密码</span>
              <input name="password" type="password" minLength={8} autoComplete="new-password" required />
            </label>

            <label className="field-stack">
              <span>确认密码</span>
              <input name="confirmPassword" type="password" minLength={8} autoComplete="new-password" required />
            </label>
          </div>

          <button className="primary-link form-submit" type="submit">
            注册并进入学习
          </button>
        </form>

        <p className="auth-switch">
          已有账号？<Link href="/login">去登录</Link>
        </p>
      </section>
    </div>
  );
}
