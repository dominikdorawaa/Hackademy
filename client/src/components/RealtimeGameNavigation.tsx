import { useEffect, useRef } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useRealtime } from '../context/RealtimeContext';

export default function RealtimeGameNavigation() {
  const { state } = useRealtime();
  const game = state?.gameSession;
  const navigate = useNavigate();
  const location = useLocation();
  const enteredGame = useRef<string | null>(null);

  useEffect(() => {
    if (!state) {
      enteredGame.current = null;
      return;
    }
    if (!game || game.status === 'FINISHED' || enteredGame.current === game.id) return;
    enteredGame.current = game.id;
    const destination = `/arena/battle/${game.id}`;
    if (location.pathname + location.search !== destination) navigate(destination, { replace: true });
  }, [state, game, location.pathname, location.search, navigate]);

  return null;
}
