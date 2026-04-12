import type { ReactNode } from "react";
import { redirect } from "next/navigation";
import { AppShell } from "@/components/layout/app-shell";
import { getCurrentUser, signOut } from "@/lib/auth/session";

export default async function ProtectedLayout({
  children,
}: {
  children: ReactNode;
}) {
  const user = await getCurrentUser();

  if (!user) {
    redirect("/login");
  }

  async function handleLogOut() {
    "use server";

    await signOut();
    redirect("/login");
  }

  return (
    <AppShell userName={user.name} userEmail={user.email} onLogOut={handleLogOut}>
      {children}
    </AppShell>
  );
}
