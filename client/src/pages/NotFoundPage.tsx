import { Link } from 'react-router-dom';
import { PixelSprite, SPRITES } from '../components/PixelSprite';
import './UserDashboardPage.css';
import './NotFoundPage.css';

export default function NotFoundPage() {
  return (
    <div className="user-dashboard not-found-page">
      <section className="not-found" aria-labelledby="not-found-title">
        <div className="not-found-track" aria-hidden="true">
          <span className="not-found-walker">
            <PixelSprite sprite={SPRITES.bug} scale={3} duration={700} />
          </span>
        </div>
        <p className="not-found-code">Błąd 404</p>
        <h1 id="not-found-title">Ten adres to bug</h1>
        <p className="not-found-text">Strona, której szukasz, nie istnieje albo została przeniesiona. Złapaliśmy tylko tego robaka.</p>
        <div className="not-found-actions">
          <Link className="ud-btn ud-btn-solid" to="/">Wróć na start</Link>
          <Link className="ud-btn ud-btn-quiet" to="/learn">Przeglądaj ścieżki</Link>
        </div>
      </section>
    </div>
  );
}
