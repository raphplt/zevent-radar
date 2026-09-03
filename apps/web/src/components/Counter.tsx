import { useEffect, useRef, useState } from "react";
import { settingsStore } from "@/lib/settings";

export function Counter({ value, format, durationMs = 800 }: { value: number; format: (value: number) => string; durationMs?: number }) {
  const settings = settingsStore.use();
  const [display, setDisplay] = useState(value);
  const fromRef = useRef(value);
  const frame = useRef<number | null>(null);

  useEffect(() => {
    if (settings.reduceMotion) {
      setDisplay(value);
      fromRef.current = value;
      return;
    }
    const from = fromRef.current;
    const start = performance.now();
    const tick = (t: number) => {
      const progress = Math.min(1, (t - start) / durationMs);
      const eased = 1 - (1 - progress) ** 3;
      setDisplay(Math.round(from + (value - from) * eased));
      if (progress < 1) frame.current = requestAnimationFrame(tick);
      else fromRef.current = value;
    };
    frame.current = requestAnimationFrame(tick);
    return () => {
      if (frame.current) cancelAnimationFrame(frame.current);
    };
  }, [value, durationMs, settings.reduceMotion]);

  return <span>{format(display)}</span>;
}
