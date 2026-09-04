import { useEffect, useRef, useState } from "react";

/** Tracks the rendered width of an element, for SVG charts drawn in pixels. */
export function useElementWidth<T extends HTMLElement>(fallback = 320) {
  const ref = useRef<T | null>(null);
  const [width, setWidth] = useState(fallback);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    setWidth(el.clientWidth || fallback);
    if (typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver((entries) => {
      const next = entries[0]?.contentRect.width;
      if (next) setWidth(next);
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, [fallback]);
  return { ref, width };
}
