import { useEffect, useState } from "react";

/**
 * True when the viewport is in "compact" mode (phones + small tablets). Drives
 * the SP3 mobile behaviors. SSR-safe (returns false when matchMedia is absent).
 */
export function useIsMobile(query = "(max-width: 900px)"): boolean {
  const read = () =>
    typeof window !== "undefined" && typeof window.matchMedia === "function"
      ? window.matchMedia(query).matches
      : false;

  const [isMobile, setIsMobile] = useState(read);

  useEffect(() => {
    if (typeof window === "undefined" || typeof window.matchMedia !== "function") return;
    const mql = window.matchMedia(query);
    const onChange = () => setIsMobile(mql.matches);
    onChange();
    mql.addEventListener("change", onChange);
    return () => mql.removeEventListener("change", onChange);
  }, [query]);

  return isMobile;
}
