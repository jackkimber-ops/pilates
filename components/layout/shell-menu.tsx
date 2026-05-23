"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Ellipsis, LogOut } from "lucide-react";
import { Button, buttonStyles } from "@/components/ui/button";

type ShellMenuItem = {
  href: string;
  label: string;
  description?: string;
};

export function ShellMenu({
  items,
  onLogOut,
  placement = "bottom",
}: {
  items: readonly ShellMenuItem[];
  onLogOut: (formData: FormData) => void | Promise<void>;
  placement?: "bottom" | "top";
}) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!open) {
      return;
    }

    function handlePointerDown(event: PointerEvent) {
      if (!containerRef.current?.contains(event.target as Node)) {
        setOpen(false);
      }
    }

    function handleEscape(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setOpen(false);
      }
    }

    window.addEventListener("pointerdown", handlePointerDown);
    window.addEventListener("keydown", handleEscape);

    return () => {
      window.removeEventListener("pointerdown", handlePointerDown);
      window.removeEventListener("keydown", handleEscape);
    };
  }, [open]);

  return (
    <div ref={containerRef} className="relative">
      <Button
        variant="secondary"
        size="sm"
        className="min-w-[44px] justify-center"
        aria-expanded={open}
        aria-haspopup="menu"
        onClick={() => setOpen((value) => !value)}
      >
        <Ellipsis className="size-4" />
        <span className="sm:hidden">More</span>
      </Button>

      {open ? (
        <div className={`shell-menu ${placement === "top" ? "shell-menu-top" : "shell-menu-bottom"}`} role="menu">
          <div className="space-y-2">
            {items.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                prefetch={false}
                role="menuitem"
                className="shell-menu-link"
                onClick={() => setOpen(false)}
              >
                <span className="font-semibold text-ink">{item.label}</span>
                {item.description ? (
                  <span className="mt-1 block text-sm leading-6 text-muted">{item.description}</span>
                ) : null}
              </Link>
            ))}
          </div>

          <form action={onLogOut} className="mt-3">
            <button
              type="submit"
              className={buttonStyles({ variant: "ghost", size: "sm", className: "w-full justify-center" })}
            >
              <LogOut className="size-4" />
              Log out
            </button>
          </form>
        </div>
      ) : null}
    </div>
  );
}
