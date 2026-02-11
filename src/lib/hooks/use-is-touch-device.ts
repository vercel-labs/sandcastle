"use client";

import { useSyncExternalStore } from "react";

function getSnapshot() {
  if (typeof window === "undefined") return false;
  return (
    "ontouchstart" in window ||
    navigator.maxTouchPoints > 0 ||
    // @ts-expect-error -- vendor-prefixed on older browsers
    navigator.msMaxTouchPoints > 0
  );
}

function getServerSnapshot() {
  return false;
}

function subscribe(callback: () => void) {
  // Touch capability can change when a user connects/disconnects a
  // touchscreen (rare, but possible). The best proxy is a media-query
  // change on `pointer: coarse` / `any-pointer: coarse`.
  const mql = window.matchMedia("(any-pointer: coarse)");
  mql.addEventListener("change", callback);
  return () => mql.removeEventListener("change", callback);
}

export function useIsTouchDevice() {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}
