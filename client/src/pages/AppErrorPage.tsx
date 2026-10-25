import { useEffect } from 'react';
import { useRouteError } from 'react-router-dom';
import { PixelSprite, SPRITES } from '../components/PixelSprite';
import { isStaleChunkError, reloadOnceForStaleChunk } from '../lib/staleChunk';
import './UserDashboardPage.css';
import './NotFoundPage.css';

export default function AppErrorPage() {
  const error = useRouteError();
  const staleChunk = isStaleChunkError(error);

  useEffect(() => {
    if (staleChunk) reloadOnceForStaleChunk();
  }, [staleChunk]);

  return (
    <div className="user-dashboard not-found-page">
      <section className="not-found" aria-labelledby="app-error-title">
        <div className="not-found-track" aria-hidden="true">
          <span className="not-found-walker">
            <PixelSprite sprite={SPRITES.bug} scale={3} duration={700} />
          </span>
        </div>
        <p className="not-found-code">{staleChunk ? 'Nowa wersja' : 'Błąd aplikacji'}</p>
        <h1 id="app-error-title">{staleChunk ? 'Hackademy właśnie się zaktualizowało' : 'Coś poszło nie tak'}</h1>
        <p className="not-found-text">
          {staleChunk
            ? 'Ta karta ma jeszcze starą wersję aplikacji. Odśwież stronę, żeby wczytać najnowszą.'
            : 'Ten widok się wysypał. Odśwież stronę, a jeśli błąd wróci, zgłoś go nam.'}
        </p>
        <div className="not-found-actions">
          <button type="button" className="ud-btn ud-btn-solid" onClick={() => window.location.reload()}>Odśwież stronę</button>
          <a className="ud-btn ud-btn-quiet" href="/">Wróć na start</a>
        </div>
      </section>
    </div>
  );
}
