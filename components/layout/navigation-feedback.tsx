"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import { NAVIGATION_START_EVENT } from "@/lib/navigation-feedback";

function isSameDocumentNavigation(url: URL) {
  return (
    url.pathname === window.location.pathname &&
    url.search === window.location.search
  );
}

function getNavigableAnchorFromTarget(target: EventTarget | null) {
  const element = target as Element | null;
  const anchor = element?.closest("a[href]") as HTMLAnchorElement | null;

  if (!anchor || anchor.target === "_blank" || anchor.hasAttribute("download")) {
    return null;
  }

  const href = anchor.getAttribute("href");
  if (!href || href.startsWith("#")) {
    return null;
  }

  const url = new URL(anchor.href, window.location.href);
  if (url.origin !== window.location.origin) {
    return null;
  }

  if (isSameDocumentNavigation(url) || url.hash) {
    return null;
  }

  return anchor;
}

export function NavigationFeedback() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [isNavigating, setIsNavigating] = useState(false);
  const timeoutRef = useRef<number | null>(null);
  const search = searchParams.toString();

  useEffect(() => {
    if (timeoutRef.current !== null) {
      window.clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }

    queueMicrotask(() => {
      setIsNavigating(false);
      document.documentElement.removeAttribute("data-nav-loading");
    });
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

    function handleDocumentPointerDown(event: PointerEvent) {
      if (
        event.defaultPrevented ||
        event.metaKey ||
        event.ctrlKey ||
        event.shiftKey ||
        event.altKey
      ) {
        return;
      }

      if (!getNavigableAnchorFromTarget(event.target)) {
        return;
      }

      startNavigation();
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

      if (!getNavigableAnchorFromTarget(event.target)) {
        return;
      }

      startNavigation();
    }

    window.addEventListener(NAVIGATION_START_EVENT, startNavigation as EventListener);
    document.addEventListener("pointerdown", handleDocumentPointerDown, true);
    document.addEventListener("click", handleDocumentClick, true);

    return () => {
      window.removeEventListener(NAVIGATION_START_EVENT, startNavigation as EventListener);
      document.removeEventListener("pointerdown", handleDocumentPointerDown, true);
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
