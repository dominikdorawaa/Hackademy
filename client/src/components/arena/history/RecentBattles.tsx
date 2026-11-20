import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import * as arenaApi from '../../../services/arenaApi';
import type { ArenaMatchSummary } from '../../../types/api';
import { FriendRowsSkeleton } from '../../FriendRowsSkeleton';
import { BattleRow } from './BattleRow';
import { HISTORY_EMPTY, HISTORY_FAILED, RECENT_BATTLES } from './battleHistory';
import './BattleHistory.css';

type State = { status: 'loading' } | { status: 'error' } | { status: 'ready'; items: ArenaMatchSummary[] };

export function RecentBattles({ sessionKey, refreshKey }: { sessionKey: string | null; refreshKey?: unknown }) {
  const [state, setState] = useState<State>({ status: 'loading' });

  useEffect(() => {
    let cancelled = false;
    arenaApi.getMatches(0, RECENT_BATTLES, { sessionKey })
      .then(response => { if (!response.ok) throw new Error('matches'); return response.json(); })
      .then(page => { if (!cancelled) setState({ status: 'ready', items: page.items }); })
      .catch(() => { if (!cancelled) setState({ status: 'error' }); });
    return () => { cancelled = true; };
  }, [sessionKey, refreshKey]);

  return (
    <section className="ud-panel bh-recent" aria-labelledby="arena-battles-title">
      <div className="ud-section-head">
        <h2 id="arena-battles-title">Ostatnie bitwy</h2>
        {state.status === 'ready' && state.items.length > 0 && <Link className="ud-link" to="/arena/history">Cała historia</Link>}
      </div>
      {state.status === 'loading' ? (
        <FriendRowsSkeleton rows={3} />
      ) : state.status === 'error' ? (
        <p className="ud-empty">{HISTORY_FAILED}</p>
      ) : state.items.length === 0 ? (
        <p className="ud-empty">{HISTORY_EMPTY}</p>
      ) : (
        <ul className="bh-list">
          {state.items.map(battle => <BattleRow key={battle.id} battle={battle} />)}
        </ul>
      )}
    </section>
  );
}
