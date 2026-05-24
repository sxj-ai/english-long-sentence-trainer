import type { ReactNode } from "react";
import { Header } from "./Header";

export function AppShell({ children }: { children: ReactNode }) {
  return (
    <>
      <Header />
      <main className="app-shell">{children}</main>
    </>
  );
}
