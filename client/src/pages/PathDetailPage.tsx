import * as pathApi from '../services/pathApi';
import { useCallback, useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import './PathDetailPage.css';
import type { PathDetailDto, RoomSummaryDto } from '../types/api';

function roomStatus(room: RoomSummaryDto) {
  if (room.locked) return { key: 'locked', label: 'Zablokowane' };
  if (room.solved) return { key: 'done', label: 'Ukończone' };
  return { key: 'todo', label: 'Do zrobienia' };
}

const PathDetailPage = () => {
  const { id } = useParams();
  const { token, logout } = useAuth();
  const navigate = useNavigate();

  const [path, setPath] = useState<PathDetailDto | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [enrolling, setEnrolling] = useState(false);

  const fetchPath = useCallback(async () => {
    try {
      setError(null);
      const res = await pathApi.getPath(id ?? '', { Authorization: `Bearer ${token}` });
      if (res.status === 401 || res.status === 403) {
        logout();
        navigate('/login');
        return;
      }
      if (!res.ok) throw new Error('Failed to fetch path');
      setPath(await res.json());
    } catch (e) {
      console.error(e);
      setError('Nie udało się pobrać ścieżki.');
    } finally {
      setLoading(false);
    }
  }, [id, token, logout, navigate]);

  useEffect(() => {
    if (token) fetchPath();
  }, [token, fetchPath]);

  const handleEnroll = async () => {
    setEnrolling(true);
    try {
      const res = await pathApi.enroll(id ?? '', { Authorization: `Bearer ${token}` });
      if (res.ok) await fetchPath();
    } catch (e) {
      console.error(e);
    } finally {
      setEnrolling(false);
    }
  };

  if (loading) return <div className="hackademy-container" style={{ paddingTop: '40px' }}>Ładowanie ścieżki...</div>;
  if (error) return <div className="hackademy-container" style={{ paddingTop: '40px' }}>Błąd: {error}</div>;
  if (!path) return <div className="hackademy-container" style={{ paddingTop: '40px' }}>Nie znaleziono ścieżki</div>;

  const chapters = path.chapters ?? [];
  const totalRooms = chapters.reduce((sum, chapter) => sum + chapter.totalRooms, 0);
  let roomNumber = 0;

  return (
    <div className="hackademy-container path-detail" style={{ paddingTop: '32px', paddingBottom: '40px' }}>
      <button onClick={() => navigate('/learn')} className="back-btn">
        &larr; Wróć do ścieżek
      </button>

      {!path.enrolled && (
        <section className="pd-hero-enroll">
          <div className="pd-hero-content">
            <h1 className="pd-hero-title">{path.title}</h1>
            <p className="pd-hero-desc">{path.description}</p>
            <div className="pd-hero-meta">
              <span><i className="fas fa-book-open" /> {chapters.length} rozdz.</span>
              <span><i className="fas fa-layer-group" /> {totalRooms} pokoi</span>
            </div>
            <button className="btn btn-primary btn-lg pd-enroll-btn" onClick={handleEnroll} disabled={enrolling}>
              Zacznij tę ścieżkę <i className="fas fa-bolt" style={{ marginLeft: '10px' }} />
            </button>
          </div>
        </section>
      )}

      <section id="pd-rooms" className={`pd-list ${!path.enrolled ? 'pd-list-locked' : ''}`}>
        <div className="pd-list-header">
          <h2>{path.enrolled ? path.title : 'Program ścieżki'}</h2>
          <span className="pd-muted">
            {path.enrolled ? 'Przechodź rozdziały krok po kroku.' : 'Musisz dołączyć do ścieżki, aby odblokować zadania.'}
          </span>
        </div>

        {chapters.map((chapter, chapterIndex) => {
          const percent = chapter.totalRooms > 0 ? Math.round((chapter.solvedRooms / chapter.totalRooms) * 100) : 0;
          return (
            <section key={chapter.id} className="pd-chapter" aria-labelledby={`pd-chapter-${chapter.id}`}>
              <header className="pd-chapter-header">
                <div>
                  <span className="pd-chapter-index">Rozdział {chapterIndex + 1}</span>
                  <h3 id={`pd-chapter-${chapter.id}`} className="pd-chapter-title">{chapter.title}</h3>
                </div>
                <div className="pd-chapter-progress">
                  <span className="pd-muted">
                    {chapter.solvedRooms}/{chapter.totalRooms} ukończone
                  </span>
                  <div
                    className="pd-chapter-bar"
                    role="progressbar"
                    aria-label={`Postęp rozdziału ${chapter.title}`}
                    aria-valuemin={0}
                    aria-valuemax={100}
                    aria-valuenow={percent}
                  >
                    <span style={{ width: `${percent}%` }} />
                  </div>
                </div>
              </header>

              {chapter.rooms.length === 0 ? (
                <p className="pd-muted pd-chapter-empty">Ten rozdział nie ma jeszcze pokoi.</p>
              ) : (
                <div className="pd-steps">
                  {chapter.rooms.map((r) => {
                    roomNumber += 1;
                    const status = roomStatus(r);
                    return (
                      <div key={r.id} className={`pd-step ${status.key}`}>
                        <div className="pd-step-left">
                          <div className={`pd-step-dot ${status.key}`}>
                            {status.key === 'done' ? <i className="fas fa-check" /> : status.key === 'locked' ? <i className="fas fa-lock" /> : roomNumber}
                          </div>
                          <div className="pd-step-line" />
                        </div>

                        <div className="pd-step-card">
                          <div className="pd-step-top">
                            <div className="pd-step-title">{r.title}</div>
                            <div className="pd-step-tags">
                              {r.requiresVpn && <span className="pd-tag">VPN</span>}
                            </div>
                          </div>

                          <div className="pd-step-bottom">
                            <div className="pd-step-meta">
                              <span className={`pd-status ${status.key}`}>{status.label}</span>
                            </div>
                            <button
                              className={`btn ${r.locked ? 'btn-outline' : 'btn-primary'}`}
                              disabled={r.locked}
                              onClick={() => navigate(`/rooms/${r.id}`)}
                              style={{ padding: '8px 16px', fontSize: '0.9rem' }}
                            >
                              {r.solved ? 'Powtórz' : 'Start'} <i className="fas fa-arrow-right" style={{ marginLeft: '8px' }} />
                            </button>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </section>
          );
        })}
      </section>
    </div>
  );
};

export default PathDetailPage;
