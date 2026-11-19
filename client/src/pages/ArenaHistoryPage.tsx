import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import * as arenaApi from '../services/arenaApi';
import type { ArenaMatchSummary } from '../types/api';
import { FriendRowsSkeleton } from '../components/FriendRowsSkeleton';
import { BattleRow } from '../components/arena/history/BattleRow';
import { HISTORY_EMPTY, HISTORY_FAILED, HISTORY_PAGE } from '../components/arena/history/battleHistory';
import '../components/arena/history/BattleHistory.css';
import './UserDashboardPage.css';

export default function ArenaHistoryPage() {
  const { sessionKey } = useAuth();
  const [items, setItems] = useState<ArenaMatchSummary[] | null>(null);
  const [page, setPage] = useState(0);
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(false);
  const [failed, setFailed] = useState(false);

  const load = useCallback(async (next: number) => {
    setLoading(true);
    setFailed(false);
    try {
      const response = await arenaApi.getMatches(next, HISTORY_PAGE, { sessionKey });
      if (!response.ok) throw new Error('matches');
      const data = await response.json();
      setItems(previous => next === 0 || !previous ? data.items : [...previous, ...data.items]);
      setHasMore(data.hasMore);
      setPage(next);
    } catch {
      setFailed(true);
    } finally {
      setLoading(false);
    }
  }, [sessionKey]);

  useEffect(() => { void load(0); }, [load]);

  return (
    <div className="user-dashboard bh-history-page">
      <div className="bh-history-shell">
        <Link className="bh-back" to="/arena"><i className="fas fa-chevron-left" aria-hidden="true"></i> Arena</Link>
        <section className="ud-panel" aria-labelledby="bh-history-title">
          <div className="ud-section-head">
            <h1 id="bh-history-title" className="bh-history-title">Historia bitew</h1>
          </div>
          {items === null ? (
            failed ? <p className="ud-empty">{HISTORY_FAILED}</p> : <FriendRowsSkeleton rows={5} />
          ) : items.length === 0 ? (
            <p className="ud-empty">{HISTORY_EMPTY}</p>
          ) : (
            <>
              <ul className="bh-list">
                {items.map(battle => <BattleRow key={battle.id} battle={battle} />)}
              </ul>
              {failed && <p role="alert" className="bh-error">Nie udało się wczytać kolejnych bitew. Spróbuj ponownie.</p>}
              {hasMore && (
                <button type="button" className="ud-btn ud-btn-quiet bh-more" onClick={() => void load(page + 1)} disabled={loading}>
                  {loading ? 'Wczytuję…' : 'Pokaż więcej'}
                </button>
              )}
            </>
          )}
        </section>
      </div>
    </div>
  );
}
