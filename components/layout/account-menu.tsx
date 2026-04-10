"use client";

import { useEffect, useRef, useState } from "react";
import { ChevronDown, LogOut } from "lucide-react";
import { Button, buttonStyles } from "@/components/ui/button";
import { getInitials } from "@/lib/utils";

export function AccountMenu({
  userName,
  userEmail,
  onLogOut,
}: {
  userName: string;
  userEmail: string;
  onLogOut: (formData: FormData) => void | Promise<void>;
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
        className="account-menu-trigger"
        aria-expanded={open}
        aria-haspopup="menu"
        aria-label="Account"
        onClick={() => setOpen((value) => !value)}
      >
        <span className="account-menu-avatar">{getInitials(userName)}</span>
        <span className="hidden min-w-0 text-left sm:block">
          <span className="block truncate text-sm font-semibold text-ink">{userName}</span>
        </span>
        <ChevronDown className="size-4 shrink-0 text-muted" />
      </Button>

      {open ? (
        <div className="account-menu-panel" role="menu">
          <div className="account-menu-user">
            <div className="account-menu-avatar account-menu-avatar-large">{getInitials(userName)}</div>
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold text-ink">{userName}</p>
              <p className="truncate text-sm leading-6 text-muted">{userEmail}</p>
            </div>
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
