import { Card } from "@/components/ui/card";

function LoadingBar({ className = "" }: { className?: string }) {
  return <div className={`rounded-full bg-[rgba(122,109,105,0.14)] ${className}`.trim()} />;
}

export default function AppLoading() {
  return (
    <div className="page-stack animate-pulse">
      <div className="space-y-3">
        <LoadingBar className="h-3 w-20" />
        <LoadingBar className="h-11 w-52" />
      </div>

      <section className="grid gap-5 xl:grid-cols-[1.05fr_0.95fr]">
        <Card variant="tint" className="space-y-5">
          <div className="space-y-3">
            <LoadingBar className="h-3 w-16" />
            <LoadingBar className="h-8 w-40" />
          </div>

          <div className="grid gap-3 sm:grid-cols-3">
            {Array.from({ length: 3 }).map((_, index) => (
              <div key={index} className="stat-shell space-y-3">
                <LoadingBar className="h-3 w-20" />
                <LoadingBar className="h-8 w-14" />
              </div>
            ))}
          </div>
        </Card>

        <Card variant="soft" className="space-y-4">
          <LoadingBar className="h-3 w-16" />
          <LoadingBar className="h-8 w-44" />
          <div className="space-y-3">
            {Array.from({ length: 3 }).map((_, index) => (
              <div key={index} className="list-row-quiet space-y-3">
                <LoadingBar className="h-4 w-28" />
                <LoadingBar className="h-3 w-full" />
              </div>
            ))}
          </div>
        </Card>
      </section>

      <Card className="space-y-4">
        <LoadingBar className="h-3 w-16" />
        <LoadingBar className="h-8 w-36" />
        <div className="space-y-3">
          {Array.from({ length: 4 }).map((_, index) => (
            <div key={index} className="list-row-quiet space-y-3">
              <LoadingBar className="h-4 w-40" />
              <LoadingBar className="h-3 w-full" />
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}
