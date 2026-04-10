"use client";

import type { ButtonHTMLAttributes } from "react";
import { useFormStatus } from "react-dom";
import { buttonStyles } from "@/components/ui/button";

type SubmitButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  pendingLabel?: string;
  variant?: "primary" | "secondary" | "tonal" | "ghost" | "danger";
  size?: "sm" | "md" | "lg" | "icon";
};

export function SubmitButton({
  children,
  className,
  pendingLabel = "Saving...",
  variant = "primary",
  size = "md",
  ...props
}: SubmitButtonProps) {
  const { pending } = useFormStatus();

  return (
    <button
      type="submit"
      className={buttonStyles({ variant, size, className })}
      disabled={pending}
      {...props}
    >
      {pending ? pendingLabel : children}
    </button>
  );
}
