"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { NAVIGATION_START_EVENT } from "@/lib/navigation-feedback";

const DEFAULT_PREFETCH_ROUTES = [
  "/",
  "/calendar",
  "/customers",
  "/sessions/new",
  "/sales/package",
  "/sales/single",
  "/sales/trial",
  "/recurring",
  "/reports",
  "/catalog",
] as const;

function isSameDocumentNavigation(url: URL) {
  return (
    url.pathname === window.location.pathname &&
    url.search === window.location.search
  );
}

export function NavigationFeedback() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [isNavigating, setIsNavigating] = useState(false);
  const timeoutRef = useRef<number | null>(null);
  const search = searchParams.toString();
  const prefetchRoutes = useMemo(() => [...DEFAULT_PREFETCH_ROUTES], []);

  useEffect(() => {
    prefetchRoutes.forEach((route) => {
      router.prefetch(route);
    });
  }, [prefetchRoutes, router]);

  useEffect(() => {
    if (timeoutRef.current !== null) {
      window.clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }

    setIsNavigating(false);
    document.documentElement.removeAttribute("data-nav-loading");
  }, [pathname, search]);

  useEffect(() => {
    function startNavigation() {
      setIsNavigating(true);
      document.documentElement.setAttribute("data-nav-loading", "true");

      if (timeoutRef.current !== null) {
        window.clearTimeout(timeoutRef.current);
      }

      timeoutRef.current = window.setTimeout(() => {
        setIsNavigating(false);
        document.documentElement.removeAttribute("data-nav-loading");
        timeoutRef.current = null;
      }, 12000);
    }

    function handleDocumentClick(event: MouseEvent) {
      if (
        event.defaultPrevented ||
        event.button !== 0 ||
        event.metaKey ||
        event.ctrlKey ||
        event.shiftKey ||
        event.altKey
      ) {
        return;
      }

      const target = event.target as Element | null;
      const anchor = target?.closest("a[href]") as HTMLAnchorElement | null;

      if (!anchor || anchor.target === "_blank" || anchor.hasAttribute("download")) {
        return;
      }

      const href = anchor.getAttribute("href");
      if (!href || href.startsWith("#")) {
        return;
      }

      const url = new URL(anchor.href, window.location.href);
      if (url.origin !== window.location.origin) {
        return;
      }

      if (isSameDocumentNavigation(url) || url.hash) {
        return;
      }

      startNavigation();
    }

    window.addEventListener(NAVIGATION_START_EVENT, startNavigation as EventListener);
    document.addEventListener("click", handleDocumentClick, true);

    return () => {
      window.removeEventListener(NAVIGATION_START_EVENT, startNavigation as EventListener);
      document.removeEventListener("click", handleDocumentClick, true);

      if (timeoutRef.current !== null) {
        window.clearTimeout(timeoutRef.current);
        timeoutRef.current = null;
      }
    };
  }, []);

  return (
    <div
      aria-hidden="true"
      className={`navigation-progress${isNavigating ? " navigation-progress-active" : ""}`}
    />
  );
}
