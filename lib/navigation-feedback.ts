const NAVIGATION_START_EVENT = "app:navigation-start";

export function dispatchNavigationStart() {
  if (typeof window === "undefined") {
    return;
  }

  window.dispatchEvent(new CustomEvent(NAVIGATION_START_EVENT));
}

export { NAVIGATION_START_EVENT };
