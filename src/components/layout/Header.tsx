import Link from "next/link";
import { logoutAction } from "@/features/auth/actions";
import { getCurrentUser } from "@/lib/auth";

export async function Header() {
  const currentUser = await getCurrentUser();

  return (
    <header className="site-header">
      <Link href="/" className="brand">
        <span className="brand-mark">句</span>
        <span>
          <strong>考研长难句训练</strong>
          <small>结构拆解 · 直译对应 · 检测练习</small>
        </span>
      </Link>
      <nav className="nav-links">
        <Link href="/">返回文章列表</Link>
        {currentUser?.role === "ADMIN" ? <Link href="/admin">管理员端</Link> : null}
        {currentUser?.role === "TEACHER" ? <Link href="/teacher">老师端</Link> : null}
        {currentUser?.role === "STUDENT" ? <Link href="/student/grading">待批改</Link> : null}
        {currentUser ? (
          <>
            <span className="secondary-link login-state-pill">已登录</span>
            <form action={logoutAction}>
              <button className="secondary-link button-like" type="submit">
                退出
              </button>
            </form>
          </>
        ) : (
          <>
            <Link className="login-state-pill" href="/login">
              未登录
            </Link>
            <Link href="/register">学生注册</Link>
            <Link href="/login">登录</Link>
          </>
        )}
      </nav>
    </header>
  );
}
