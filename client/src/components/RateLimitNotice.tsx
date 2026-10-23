import { useEffect, useState } from 'react';
import { onRateLimit, rateLimitMessage } from '../services/rateLimit';
import './RateLimitNotice.css';

export const RATE_LIMIT_TICK_MS = 1000;

interface Limit { until: number; announced: number }

export default function RateLimitNotice() {
  const [limit, setLimit] = useState<Limit | null>(null);
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => onRateLimit(retryAfter => {
    const current = Date.now();
    setNow(current);
    setLimit(previous => ({ until: Math.max(previous?.until ?? 0, current + retryAfter * 1000), announced: retryAfter }));
  }), []);

  useEffect(() => {
    if (!limit) return;
    const timer = window.setInterval(() => {
      const current = Date.now();
      if (current >= limit.until) setLimit(null);
      else setNow(current);
    }, RATE_LIMIT_TICK_MS);
    return () => window.clearInterval(timer);
  }, [limit]);

  const remaining = limit ? Math.max(1, Math.ceil((limit.until - now) / 1000)) : 0;
  return <div className="rate-limit-notices" role="status" aria-live="polite">
    {limit && <div className="rate-limit-notice">
      <span className="rate-limit-notice-dot" aria-hidden="true" />
      <span className="sr-only">{rateLimitMessage(limit.announced)}</span>
      <span aria-hidden="true" className="rate-limit-notice-text">{rateLimitMessage(remaining)}</span>
      <button type="button" className="rate-limit-notice-close" aria-label="Zamknij komunikat o limicie żądań"
        onClick={() => setLimit(null)}>
        <i className="fas fa-times" aria-hidden="true"></i>
      </button>
    </div>}
  </div>;
}
