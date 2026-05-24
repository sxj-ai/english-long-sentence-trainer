import Link from "next/link";

export function Header() {
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
        <Link href="/">文章</Link>
        <Link href="/admin">后台预留</Link>
      </nav>
    </header>
  );
}
