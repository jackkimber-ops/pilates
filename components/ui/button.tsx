import type { ButtonHTMLAttributes } from "react";
import { cn } from "@/lib/utils";

type ButtonVariant = "primary" | "secondary" | "tonal" | "ghost" | "danger";
type ButtonSize = "sm" | "md" | "lg" | "icon";

const VARIANT_STYLES: Record<ButtonVariant, string> = {
  primary:
    "bg-accent-strong !text-white shadow-[0_24px_42px_-30px_rgba(99,69,76,0.6)] hover:-translate-y-[1px] hover:bg-accent hover:!text-white",
  secondary:
    "bg-white/76 text-ink shadow-[0_18px_36px_-30px_rgba(74,56,51,0.16)] hover:bg-white hover:text-ink",
  tonal:
    "bg-accent-soft/86 text-accent-strong shadow-[0_18px_36px_-32px_rgba(99,69,76,0.18)] hover:-translate-y-[1px] hover:bg-[#e4d5da]",
  ghost: "bg-transparent text-muted hover:bg-white/60 hover:text-ink",
  danger: "bg-danger text-white shadow-[0_22px_38px_-26px_rgba(159,123,130,0.52)] hover:bg-[#947078]",
};

const SIZE_STYLES: Record<ButtonSize, string> = {
  sm: "h-10 rounded-full px-4 text-sm",
  md: "h-12 rounded-full px-5 text-[15px]",
  lg: "h-14 rounded-full px-6 text-[15px]",
  icon: "size-12 rounded-full",
};

export function buttonStyles({
  variant = "primary",
  size = "md",
  className,
}: {
  variant?: ButtonVariant;
  size?: ButtonSize;
  className?: string;
}) {
  return cn(
    "inline-flex items-center justify-center gap-2.5 whitespace-nowrap font-semibold tracking-[0.01em] transition-all duration-200 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-accent-soft disabled:cursor-not-allowed disabled:opacity-50",
    VARIANT_STYLES[variant],
    SIZE_STYLES[size],
    className,
  );
}

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: ButtonVariant;
  size?: ButtonSize;
};

export function Button({
  className,
  variant = "primary",
  size = "md",
  type = "button",
  ...props
}: ButtonProps) {
  return <button type={type} className={buttonStyles({ variant, size, className })} {...props} />;
}
