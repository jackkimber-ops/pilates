import { PrimaryNav } from "@/components/layout/primary-nav";

export function MobileNav({
  onLogOut,
}: {
  onLogOut: (formData: FormData) => void | Promise<void>;
}) {
  return <PrimaryNav mode="mobile" onLogOut={onLogOut} />;
}
