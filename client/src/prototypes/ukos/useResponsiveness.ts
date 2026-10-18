import { useEffect, useState } from "react";

export function useResponsiveness() {
  const [stats, setStats] = useState({ p95: 0, max: 0, longTasks: 0 });
  useEffect(() => {
    let frame = 0;
    let previous = 0;
    let frames: number[] = [];
    let longTasks = 0;
    const tick = (now: number) => {
      if (previous && !document.hidden) frames.push(now - previous);
      previous = now;
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    const observer =
      typeof PerformanceObserver !== "undefined" &&
      PerformanceObserver.supportedEntryTypes.includes("longtask")
        ? new PerformanceObserver((list) => {
            longTasks += list.getEntries().length;
          })
        : null;
    observer?.observe({ type: "longtask" });
    const interval = setInterval(() => {
      const sorted = frames.slice(-300).sort((a, b) => a - b);
      setStats({
        p95: sorted[Math.floor(sorted.length * 0.95)] ?? 0,
        max: sorted.at(-1) ?? 0,
        longTasks,
      });
      frames = frames.slice(-300);
    }, 1000);
    const visibility = () => {
      previous = 0;
      frames = [];
    };
    document.addEventListener("visibilitychange", visibility);
    return () => {
      cancelAnimationFrame(frame);
      clearInterval(interval);
      observer?.disconnect();
      document.removeEventListener("visibilitychange", visibility);
    };
  }, []);
  return stats;
}
