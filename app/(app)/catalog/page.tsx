import Link from "next/link";
import { ArrowRight, Blocks, Package2, UserRound } from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";
import { Card } from "@/components/ui/card";

const ITEMS = [
  {
    href: "/catalog/class-types",
    title: "Class types",
    description: "Types",
    icon: Blocks,
  },
  {
    href: "/catalog/package-templates",
    title: "Package templates",
    description: "Packages",
    icon: Package2,
  },
  {
    href: "/catalog/instructors",
    title: "Instructors",
    description: "Roster",
    icon: UserRound,
  },
] as const;

export default function CatalogPage() {
  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow="Catalog"
        title="Catalog"
      />

      <Card className="overflow-hidden p-0">
        <div className="px-6 py-5">
          <p className="section-kicker">Setup</p>
          <h2 className="mt-2 section-title">Core items</h2>
        </div>

        <div className="divide-y divide-line">
          {ITEMS.map((item) => {
            const Icon = item.icon;

            return (
              <Link key={item.href} href={item.href} className="block px-6 py-5 transition hover:bg-white/45">
                <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                  <div className="flex items-start gap-4">
                    <div className="flex size-12 items-center justify-center rounded-[18px] bg-accent-soft text-accent-strong shadow-[0_14px_24px_-20px_rgba(63,43,42,0.24)]">
                      <Icon className="size-5" />
                    </div>
                    <div className="space-y-1">
                      <h2 className="font-display text-[1.8rem] leading-none tracking-[-0.04em] text-ink">
                        {item.title}
                      </h2>
                      <p className="max-w-2xl text-sm leading-7 text-muted">{item.description}</p>
                    </div>
                  </div>
                  <ArrowRight className="size-4 text-muted" />
                </div>
              </Link>
            );
          })}
        </div>
      </Card>
    </div>
  );
}
