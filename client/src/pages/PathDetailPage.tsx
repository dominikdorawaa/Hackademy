import * as pathApi from '../services/pathApi';
import { request } from '../services/http';
import API_URL from '../apiConfig';
import { useCallback, useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { BookOpen, Check, ChevronLeft, ChevronRight, Layers, Lock, Play } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { roomHref } from '../lib/roomReturn';
import { cn } from '../lib/utils';
import { CHAPTERS, plural, ROOMS } from '../lib/plural';
import '../components/room/room.css';
import '../components/learn/learn.css';
import './PathDetailPage.css';
import PathArt from '../components/learn/PathArt';
import PathRail, { type RailStep } from '../components/learn/PathRail';
import { LoadingSkeleton, Skeleton, SkeletonText } from '../components/common/Skeleton';
import type { PathDetailDto, PathUnlockMode, RoomSummaryDto } from '../types/api';

const unlockModeHints: Record<PathUnlockMode, string> = {
  OPEN: 'Przechodź rozdziały krok po kroku.',
  CHAPTER: 'Kolejny rozdział otwiera się po ukończeniu wszystkich pokoi poprzedniego.',
  ROOM: 'Pokoje otwierają się po kolei. Ukończ bieżący, aby przejść dalej.',
};

function roomStatus(room: RoomSummaryDto) {
  if (room.locked) return { key: 'locked', label: 'Zablokowane' };
  if (room.solved) return { key: 'done', label: 'Ukończone' };
  return { key: 'todo', label: 'Do zrobienia' };
}

function useBanner(path: PathDetailDto | null, sessionKey: string | null) {
  const [src, setSrc] = useState<string | null>(null);
  const source = path?.hasBanner && path.bannerUrl ? `${API_URL}${path.bannerUrl}` : null;
  const external = path && !path.hasBanner ? path.bannerUrl : null;
  useEffect(() => {
    let active = true;
    let objectUrl: string | null = null;
    if (source) {
      request(source, { auth: { sessionKey } })
        .then(r => { if (!r.ok) throw new Error(); return r.blob(); })
        .then(blob => { if (active) { objectUrl = URL.createObjectURL(blob); setSrc(objectUrl); } })
        .catch(() => { if (active) setSrc(null); });
    } else setSrc(external);
    return () => { active = false; if (objectUrl) URL.revokeObjectURL(objectUrl); };
  }, [source, external, sessionKey]);
  return src;
}

const PathDetailPage = ({ preview = false }: { preview?: boolean }) => {
  const { id } = useParams();
  const { sessionKey, logout } = useAuth();
  const navigate = useNavigate();

  const [path, setPath] = useState<PathDetailDto | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [enrolling, setEnrolling] = useState(false);
  const banner = useBanner(path, sessionKey);

  const fetchPath = useCallback(async () => {
    try {
      setError(null);
      const res = await (preview ? request<PathDetailDto>(`/api/admin/content/paths/${id}/preview`, { auth: { sessionKey } }) : pathApi.getPath(id ?? '', { sessionKey }));
      if (res.status === 401) {
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
  }, [id, sessionKey, logout, navigate, preview]);

  useEffect(() => {
    if (sessionKey) fetchPath();
  }, [sessionKey, fetchPath]);

  const handleEnroll = async () => {
    setEnrolling(true);
    try {
      const res = await pathApi.enroll(id ?? '', { sessionKey });
      if (res.ok) await fetchPath();
    } catch (e) {
      console.error(e);
    } finally {
      setEnrolling(false);
    }
  };

  const back = (
    <button type="button" onClick={() => navigate(preview ? `/admin/paths/${id}` : '/learn')} className="learn-back">
      <ChevronLeft aria-hidden="true" />{preview ? 'Wróć do edycji' : 'Wszystkie ścieżki'}
    </button>
  );

  if (loading) return <div className="room-tokens learn-page pd-page">
    <LoadingSkeleton label="Ładowanie ścieżki" className="hk-skeleton-stack is-loose">
      <Skeleton width={140} height={20} />
      <div className="pd-hero">
        <div className="hk-skeleton-stack">
          <Skeleton width="min(480px, 80%)" height={56} />
          <SkeletonText lines={2} />
        </div>
        <div className="path-art pd-hero-art px-frame" />
      </div>
      {[0, 1].map(index => <div key={index} className="hk-skeleton-stack">
        <div className="hk-skeleton-pair"><Skeleton width={90} height={12} /><Skeleton width="40%" height={22} /></div>
        {[0, 1, 2].map(row => <Skeleton key={row} height={64} radius={4} />)}
      </div>)}
    </LoadingSkeleton>
  </div>;
  if (error) return <div className="room-tokens learn-page pd-page">{back}<p className="pd-problem" role="alert">Błąd: {error}</p></div>;
  if (!path) return <div className="room-tokens learn-page pd-page">{back}<p className="pd-problem">Nie znaleziono ścieżki</p></div>;

  const chapters = path.chapters ?? [];
  const rooms = chapters.flatMap(chapter => chapter.rooms);
  const totalRooms = chapters.reduce((sum, chapter) => sum + chapter.totalRooms, 0);
  const solvedRooms = rooms.filter(room => room.solved).length;
  const nextRoom = path.enrolled && !preview ? rooms.find(room => !room.solved && !room.locked) : undefined;
  const nextChapter = nextRoom && chapters.find(chapter => chapter.rooms.includes(nextRoom));
  const finished = path.enrolled && rooms.length > 0 && solvedRooms === rooms.length;
  const rail: RailStep[] = rooms.map(room => room.solved ? 'done' : room === nextRoom ? 'current' : 'todo');
  const openRoom = (room: RoomSummaryDto) => navigate(preview ? `/admin/preview/rooms/${room.id}?kind=PATH&pathId=${id}` : roomHref(room.id, id ? { kind: 'path', pathId: id } : undefined));
  let roomNumber = 0;

  return (
    <div className="room-tokens learn-page pd-page">
      {preview && <div role="status" className="room-preview pd-preview">Podgląd administracyjny: materiał nie jest publikowany, postęp i punkty nie są zapisywane.</div>}
      {back}

      <header className="pd-hero">
        <div className="pd-hero-copy">
          <h1 className="learn-title pd-title">{path.title}</h1>
          {path.description && <p className="pd-desc">{path.description}</p>}
          <ul className="pd-facts">
            <li><BookOpen aria-hidden="true" />{plural(chapters.length, CHAPTERS)}</li>
            <li><Layers aria-hidden="true" />{plural(totalRooms, ROOMS)}</li>
          </ul>
          {path.enrolled && rooms.length > 0 && (
            <div className="pd-progress">
              <div className="pd-progress-label">
                <span>Twój postęp</span>
                <strong>{solvedRooms}/{rooms.length}</strong>
              </div>
              <PathRail steps={rail} label="Postęp ścieżki" />
            </div>
          )}
        </div>
        <PathArt seed={path.id} src={banner} className="pd-hero-art px-frame" />
      </header>

      {!preview && !path.enrolled && (
        <section className="pd-call" aria-label="Dołącz do ścieżki">
          <div>
            <p className="pd-call-kicker">Zanim wejdziesz do pierwszego pokoju</p>
            <p className="pd-call-text">Dołącz do ścieżki, a pokoje otworzą się po kolei, a postęp zapisze się na Twoim koncie.</p>
          </div>
          <button type="button" className="room-btn room-btn--primary" onClick={handleEnroll} disabled={enrolling}>
            {enrolling ? 'Dołączanie…' : 'Zacznij tę ścieżkę'}<ChevronRight aria-hidden="true" />
          </button>
        </section>
      )}

      {nextRoom && (
        <section className="pd-call" aria-label="Następny pokój">
          <div>
            <p className="pd-call-kicker">{solvedRooms === 0 ? 'Zacznij tutaj' : 'Następny pokój'}{nextChapter && <span>{nextChapter.title}</span>}</p>
            <h2 className="pd-call-title">{nextRoom.title}</h2>
          </div>
          <button type="button" className="room-btn room-btn--primary" onClick={() => openRoom(nextRoom)}>
            {solvedRooms === 0 ? 'Start' : 'Kontynuuj'}<ChevronRight aria-hidden="true" />
          </button>
        </section>
      )}

      {finished && (
        <section className="pd-call pd-call--done" aria-label="Ścieżka ukończona">
          <div>
            <p className="pd-call-kicker">Ścieżka ukończona</p>
            <p className="pd-call-text">Wszystkie pokoje są zaliczone. Możesz wrócić do dowolnego z nich w trybie treningu.</p>
          </div>
          <button type="button" className="room-btn" onClick={() => navigate('/learn')}>Wybierz kolejną ścieżkę</button>
        </section>
      )}

      <section id="pd-rooms" className={cn('pd-map', !path.enrolled && !preview && 'is-preview')} aria-labelledby="pd-map-title">
        <div className="pd-map-head">
          <h2 id="pd-map-title">{path.enrolled ? 'Mapa ścieżki' : 'Program ścieżki'}</h2>
          <p>{path.enrolled ? unlockModeHints[path.unlockMode ?? 'OPEN'] : 'Dołącz do ścieżki, aby otworzyć pokoje.'}</p>
        </div>

        {chapters.map((chapter, chapterIndex) => {
          const percent = chapter.totalRooms > 0 ? Math.round((chapter.solvedRooms / chapter.totalRooms) * 100) : 0;
          const complete = chapter.totalRooms > 0 && chapter.solvedRooms === chapter.totalRooms;
          return (
            <section key={chapter.id} className={cn('pd-chapter', chapter.locked && 'is-locked', complete && 'is-complete')} aria-labelledby={`pd-chapter-${chapter.id}`}>
              <header className="pd-chapter-head">
                <span className="pd-chapter-num" aria-hidden="true">{String(chapterIndex + 1).padStart(2, '0')}</span>
                <div className="pd-chapter-name">
                  <span className="pd-chapter-index">
                    Rozdział {chapterIndex + 1}
                    {chapter.locked && <span className="pd-chapter-lock"><Lock aria-hidden="true" />Zablokowany</span>}
                  </span>
                  <h3 id={`pd-chapter-${chapter.id}`} className="pd-chapter-title">{chapter.title}</h3>
                </div>
                <div className="pd-chapter-progress">
                  <span>{chapter.solvedRooms}/{chapter.totalRooms} ukończone</span>
                  <div className="room-meter" role="progressbar" aria-label={`Postęp rozdziału ${chapter.title}`}
                    aria-valuemin={0} aria-valuemax={100} aria-valuenow={percent}>
                    <span style={{ transform: `scaleX(${percent / 100})` }} />
                  </div>
                </div>
              </header>

              {chapter.rooms.length === 0 ? (
                <p className="pd-chapter-empty">Ten rozdział nie ma jeszcze pokoi.</p>
              ) : (
                <ol className="pd-track">
                  {chapter.rooms.map((r) => {
                    roomNumber += 1;
                    const status = roomStatus(r);
                    const isNext = r === nextRoom;
                    return (
                      <li key={r.id} className={cn('pd-room', `is-${status.key}`, isNext && 'is-next')}>
                        <span className="pd-node" aria-hidden="true">
                          {status.key === 'done' ? <Check /> : status.key === 'locked' ? <Lock /> : isNext ? <Play /> : roomNumber}
                        </span>
                        <div className="pd-room-card">
                          <div className="pd-room-copy">
                            <h4 className="pd-room-title">{r.title}</h4>
                            {r.shortDescription && <p className="pd-room-desc">{r.shortDescription}</p>}
                            <div className="pd-room-meta">
                              <span className={`pd-status is-${status.key}`}>{status.label}</span>
                              <span className={`room-chip room-chip--${r.difficulty.toLowerCase()}`}>{r.difficulty}</span>
                              {r.points > 0 && <span className="room-chip room-chip--points">{r.points} pkt</span>}
                            </div>
                          </div>
                          <button
                            type="button"
                            className={cn('room-btn room-btn--small', isNext && 'room-btn--primary')}
                            disabled={r.locked}
                            onClick={() => openRoom(r)}
                          >
                            {r.solved ? 'Powtórz' : 'Start'}<ChevronRight aria-hidden="true" />
                          </button>
                        </div>
                      </li>
                    );
                  })}
                </ol>
              )}
            </section>
          );
        })}
      </section>
    </div>
  );
};

export default PathDetailPage;
