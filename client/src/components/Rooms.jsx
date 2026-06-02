import React, { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';

/** Statyczna zapowiedź pokoi na landing (bez API / bazy). */
const STATIC_PREVIEW_ROOMS = [
  {
    id: 'demo-1',
    title: 'SQL Injection Lab',
    category: 'Web',
    difficulty: 'MEDIUM',
    solutionsCount: 42,
  },
  {
    id: 'demo-2',
    title: 'Buffer Overflow 101',
    category: 'Binary',
    difficulty: 'HARD',
    solutionsCount: 18,
  },
  {
    id: 'demo-3',
    title: 'Forensics: Ukryte ślady',
    category: 'Forensics',
    difficulty: 'EASY',
    solutionsCount: 67,
  },
];

const Rooms = () => {
  const gridRef = useRef(null);
  const [inView, setInView] = useState(false);
  const rooms = STATIC_PREVIEW_ROOMS;

  useEffect(() => {
    const el = gridRef.current;
    if (!el) return;
    const obs = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setInView(true);
          obs.disconnect();
        }
      },
      { threshold: 0.06, rootMargin: '0px 0px -6% 0px' }
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, []);

  const difficultyClass = (difficulty) => {
    switch (difficulty) {
      case 'EASY': return 'diff-easy';
      case 'MEDIUM': return 'diff-medium';
      case 'HARD': return 'diff-hard';
      case 'INSANE': return 'diff-insane';
      default: return 'diff-easy';
    }
  };

  const difficultyTranslation = (difficulty) => {
    switch (difficulty) {
      case 'EASY': return 'Łatwy';
      case 'MEDIUM': return 'Średni';
      case 'HARD': return 'Trudny';
      case 'INSANE': return 'Niemożliwy';
      default: return 'Łatwy';
    }
  };

  return (
    <section className="rooms-showcase" id="rooms">
      <div className="container">
        <h2 className="section-title">Przegląd Pokoi</h2>
        <p className="section-subtitle">
          Zobacz, nad czym pracują inni. Zarejestruj się, aby uzyskać dostęp.
        </p>

        <div
          ref={gridRef}
          className={`rooms-grid rooms-stagger${inView ? ' rooms-stagger--inview' : ''}`}
        >
          {rooms.map((room) => (
            <Link key={room.id} to="/register" className="room-card" style={{ textDecoration: 'none', color: 'inherit', cursor: 'pointer' }}>
              <div className="room-top-badge"><i className="fas fa-lock"></i></div>
              <div className="room-image-placeholder">
                <span className={`difficulty-badge ${difficultyClass(room.difficulty)}`}>
                  {difficultyTranslation(room.difficulty)}
                </span>
              </div>
              <div className="room-body">
                <h3 className="room-title">{room.title}</h3>
                <div className="room-tags">{room.category} • Security</div>

                <div className="room-locked-footer">
                  <span className="lock-info">
                    <i className="fas fa-user-lock"></i> Wymagane konto
                  </span>
                  <span>{room.solutionsCount} rozwiązań</span>
                </div>
              </div>
            </Link>
          ))}
        </div>
      </div>
    </section>
  );
};

export default Rooms;
