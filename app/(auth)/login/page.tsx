import { redirect } from "next/navigation";
import { CalendarDays, LockKeyhole, Users2 } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { LoginForm } from "@/app/(auth)/login/login-form";
import { getCurrentUser } from "@/lib/auth/session";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  const user = await getCurrentUser();

  if (user) {
    redirect("/");
  }

  const params = await searchParams;

  return (
    <main className="mx-auto flex min-h-screen max-w-[1280px] items-center px-4 py-6 md:px-6 lg:px-8">
      <div className="grid w-full gap-5 lg:grid-cols-[1.08fr_0.92fr]">
        <section className="surface-tint flex min-h-[620px] flex-col justify-between rounded-[36px] p-6 md:p-8 xl:p-10">
          <div className="space-y-6">
            <Badge tone="plum">Admin</Badge>
            <div className="space-y-4">
              <h1 className="editorial-title max-w-2xl">Re:Form admin</h1>
            </div>
          </div>

          <div className="grid gap-3 md:grid-cols-2">
            <div className="stat-shell">
              <div className="flex items-center justify-between gap-3">
                <p className="stat-label">Admin team</p>
                <Users2 className="size-4 text-accent-strong" />
              </div>
              <p className="stat-value">2</p>
            </div>
            <div className="stat-shell">
              <div className="flex items-center justify-between gap-3">
                <p className="stat-label">Shared room</p>
                <CalendarDays className="size-4 text-accent-strong" />
              </div>
              <p className="stat-value">1</p>
            </div>
          </div>
        </section>

        <Card className="w-full self-center p-0">
          <div className="space-y-8 px-6 py-7 md:px-8 md:py-9 lg:px-10">
            <div className="space-y-5">
              <div className="flex items-center gap-4">
                <div className="flex size-14 items-center justify-center rounded-[22px] bg-accent-soft font-display text-lg text-accent-strong shadow-[inset_0_1px_0_rgba(255,255,255,0.72)]">
                  R:
                </div>
                <div className="space-y-1">
                  <p className="section-kicker">Sign in</p>
                  <h1 className="font-display text-[2.3rem] leading-none tracking-[-0.04em] text-ink">
                    Re:Form
                  </h1>
                </div>
              </div>
            </div>

            <Card variant="inset" className="space-y-4 p-5">
              <div className="flex items-start gap-3">
                <div className="mt-0.5 flex size-9 items-center justify-center rounded-full bg-white/75 text-accent-strong">
                  <LockKeyhole className="size-4" />
                </div>
                <div className="space-y-2">
                  <p className="section-kicker">Local</p>
                  <p className="text-sm leading-6 text-muted">
                    Use <span className="font-mono text-[13px] text-ink">phuong@reform.local</span> or{" "}
                    <span className="font-mono text-[13px] text-ink">phoebe@reform.local</span> with{" "}
                    <span className="font-mono text-[13px] text-ink">Pilates123!</span>.
                  </p>
                </div>
              </div>
            </Card>

            <LoginForm next={params.next} />
          </div>
        </Card>
      </div>
    </main>
  );
}
