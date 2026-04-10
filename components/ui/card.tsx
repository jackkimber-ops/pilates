import type { HTMLAttributes } from "react";
import { cn } from "@/lib/utils";

type CardVariant = "default" | "tint" | "inset" | "bare" | "soft" | "plain";

const VARIANT_STYLES: Record<CardVariant, string> = {
  default: "surface-panel",
  tint: "surface-tint",
  inset: "surface-inset",
  bare: "bg-transparent",
  soft: "bg-white/52 shadow-[0_24px_44px_-36px_rgba(74,56,51,0.14)] backdrop-blur-md",
  plain: "bg-transparent",
};

export function Card({
  className,
  variant = "default",
  ...props
}: HTMLAttributes<HTMLDivElement> & { variant?: CardVariant }) {
  return (
    <div className={cn("rounded-[32px] p-5 md:p-6", VARIANT_STYLES[variant], className)} {...props} />
  );
}
