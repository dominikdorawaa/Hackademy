import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { useApiResource } from '../../hooks/useApiResource';
import * as userApi from '../../services/userApi';
import * as friendApi from '../../services/friendApi';
import * as badgeApi from '../../services/badgeApi';
import type { ApiResponse } from '../../services/http';
import type { DashboardUser, UserProfileDto } from '../../types/api';
import ActivityCalendar from '../ActivityCalendar';
import BioText from './BioText';
import UserAvatar from '../UserAvatar';
import ProfileEditor from './ProfileEditor';
import BadgeShowcase from './BadgeShowcase';
import { PROFILE_INTERESTS } from '../../lib/profile';
import type { ProfilePersonalization } from '../../lib/profile';
import ProfileLearningStats from './ProfileLearningStats';
import ProfileBadges from './ProfileBadges';
import { Button } from '../ui/button';
import '../../pages/ProfilePage.css';
import './ProfileLayout.css';

function ResourceContent({
  loading,
  error,
  retry,
  children,
}: {
  loading: boolean;
  error: string | null;
  retry: () => void;
  children: ReactNode;
}) {
  if (loading)
    return (
      <p role="status" className="profile-muted">
        Ładowanie…
      </p>
    );
  if (error)
    return (
      <div className="profile-section-error">
        <p role="alert">{error}</p>
        <Button variant="outline" size="sm" onClick={retry}>
          Spróbuj ponownie
        </Button>
      </div>
    );
  return children;
}

function PublicBio({ bio }: { bio: string | null }) {
  if (!bio)
    return <p className="profile-muted">Użytkownik nie dodał jeszcze opisu.</p>;
  return (
    <div className="profile-bio">
      <BioText bio={bio} />
    </div>
  );
}

function formatDate(date: string) {
  return new Date(date).toLocaleDateString('pl-PL', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

export default function UserProfile({ username }: { username?: string }) {
  const { token, logout } = useAuth();
  const navigate = useNavigate();
  const own = !username;
  const headers = useMemo(
    () => ({ Authorization: `Bearer ${token}` }),
    [token],
  );
  const unauthorized = useCallback(() => {
    logout();
    navigate('/login', { replace: true });
  }, [logout, navigate]);
  const loadProfile = useCallback(
    (
      signal: AbortSignal,
    ): Promise<ApiResponse<DashboardUser | UserProfileDto>> =>
      own
        ? userApi.getCurrentUser(headers, signal)
        : userApi.getProfile(username!, headers, signal),
    [own, username, headers],
  );
  const loadActivity = useCallback(
    (signal: AbortSignal) =>
      own
        ? userApi.getMyActivity(headers, signal)
        : userApi.getActivity(username!, headers, signal),
    [own, username, headers],
  );
  const loadBadges = useCallback(
    (signal: AbortSignal) => badgeApi.getAll(headers, signal),
    [headers],
  );
  const loadFriendship = useCallback(
    (signal: AbortSignal) => friendApi.getStatus(username!, headers, signal),
    [username, headers],
  );
  const loadStats = useCallback(
    (signal: AbortSignal) => friendApi.getStats(username!, headers, signal),
    [username, headers],
  );
  const profile = useApiResource(loadProfile, unauthorized, !!token);
  const activity = useApiResource(loadActivity, unauthorized, !!token);
  const badges = useApiResource(loadBadges, unauthorized, own && !!token);
  const friendship = useApiResource(
    loadFriendship,
    unauthorized,
    !own && !!token,
  );
  const stats = useApiResource(
    loadStats,
    unauthorized,
    !own && !!token && friendship.data?.status === 'FRIENDS',
  );
  const [personalization, setPersonalization] = useState<ProfilePersonalization | null>(null);
  const [editing, setEditing] = useState(false);
  const [saved, setSaved] = useState(false);
  const [sending, setSending] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [requestSent, setRequestSent] = useState(false);
  const pendingInvitation = useRef<AbortController | null>(null);
  useEffect(() => () => pendingInvitation.current?.abort(), []);

  const sendRequest = async () => {
    if (sending) return;
    const controller = new AbortController();
    pendingInvitation.current = controller;
    setSending(true);
    setActionError(null);
    try {
      const response = await friendApi.sendRequest(
        username!,
        headers,
        controller.signal,
      );
      if (controller.signal.aborted) return;
      if (response.status === 401 || response.status === 403) {
        unauthorized();
        return;
      }
      if (!response.ok) {
        setActionError('Nie udało się wysłać zaproszenia. Spróbuj ponownie.');
        return;
      }
      setRequestSent(true);
    } catch {
      if (!controller.signal.aborted)
        setActionError('Nie udało się połączyć z serwerem.');
    } finally {
      if (!controller.signal.aborted) setSending(false);
    }
  };

  if (profile.loading || !profile.data)
    return (
      <div className="profile-page">
        <ResourceContent {...profile}>
          <p className="profile-muted">Profil jest niedostępny.</p>
        </ResourceContent>
      </div>
    );

  const person = profile.data;
  const friendshipStatus = requestSent
    ? 'REQUEST_SENT'
    : friendship.data?.status;
  const profileBadges = own
    ? (badges.data ?? [])
    : 'badges' in person
      ? person.badges
      : [];
  const appearance: ProfilePersonalization = personalization ?? {
    bio: person.bio ?? '', tagline: person.tagline ?? '', avatarSeed: person.avatarSeed || person.username,
    interests: person.interests ?? [], featuredBadgeIds: person.featuredBadgeIds ?? [],
  };
  const beginner = own && !appearance.bio && !appearance.interests.length;
  const edit = () => { setSaved(false); setEditing(true); };

  return (
    <div className="profile-page">
      <div className="profile-breadcrumb">
        <Link to={own ? '/dashboard' : '/friends'}>
          {own ? 'Dashboard' : 'Znajomi'}
        </Link>
        <span aria-hidden="true">/</span>
        <span>Profil</span>
      </div>
      <header className="profile-header">
        <UserAvatar
          className="profile-avatar"
          username={person.username} seed={appearance.avatarSeed}
          alt={`Avatar ${person.username}`}
        />
        <div className="profile-identity">
          <h1>{person.username}</h1>
          {appearance.interests.length > 0 && <ul className="profile-interest-tags" aria-label="Zainteresowania">
            {appearance.interests.map(interest => <li key={interest}>{PROFILE_INTERESTS[interest] ?? interest}</li>)}
          </ul>}
          <div className="profile-meta">
            <span>
              <i className="far fa-calendar" aria-hidden="true" />W Hackademy od{' '}
              <time dateTime={person.createdAt}>
                {formatDate(person.createdAt)}
              </time>
            </span>
          </div>
          {appearance.bio && <PublicBio bio={appearance.bio} />}
        </div>
        <div className="profile-header-side">
          {own && <Button onClick={edit}><i className="fas fa-pen" aria-hidden="true" /> Edytuj profil</Button>}
          {saved && <p role="status" className="profile-save-status">Profil zapisany</p>}
          {!own && (
            <div className="profile-header-actions">
              <>
                <ResourceContent {...friendship}>
                  {friendshipStatus === 'NONE' && (
                    <Button
                      disabled={sending}
                      onClick={() => void sendRequest()}
                    >
                      {sending ? 'Wysyłanie…' : 'Dodaj do znajomych'}
                    </Button>
                  )}
                  {friendshipStatus === 'REQUEST_SENT' && (
                    <p role="status" className="profile-relation">
                      Zaproszenie wysłane
                    </p>
                  )}
                  {friendshipStatus === 'FRIENDS' && (
                    <p className="profile-relation">Jesteście znajomymi</p>
                  )}
                  {friendshipStatus === 'REQUEST_RECEIVED' && (
                    <Button asChild>
                      <Link to="/friends">Odpowiedz na zaproszenie</Link>
                    </Button>
                  )}
                </ResourceContent>
                {actionError && (
                  <p role="alert" className="profile-error">
                    {actionError}
                  </p>
                )}
              </>
            </div>
          )}
        </div>
      </header>
      {beginner && <section className="profile-welcome"><div>
        <h2>Nadaj profilowi swój charakter</h2><p>Dodaj opis i zainteresowania, a potem wybierz odznaki do gabloty.</p></div>
        <Button variant="outline" onClick={edit}>Uzupełnij profil</Button></section>}
      <BadgeShowcase badges={profileBadges} selectedIds={appearance.featuredBadgeIds} own={own} onEdit={edit} />
      <section className="profile-section profile-badges" aria-labelledby="profile-badges-title">
        <div className="profile-section-heading">
          <h2 id="profile-badges-title">Osiągnięcia</h2></div>
        {own ? <ResourceContent {...badges}><ProfileBadges badges={profileBadges} own /></ResourceContent>
          : <ProfileBadges badges={profileBadges} own={false} />}
      </section>
      <div className="profile-details-grid">
        <section className="profile-section profile-activity" aria-labelledby="profile-activity-title">
          <div className="profile-section-heading"><h2 id="profile-activity-title">Regularność nauki</h2></div>
          <ResourceContent {...activity}><ActivityCalendar data={activity.data ?? []} /></ResourceContent>
        </section>
        <ProfileLearningStats activity={activity.data} loading={activity.loading} />
      </div>
      {!own && friendshipStatus === 'FRIENDS' && <section className="profile-section profile-duels">
        <h3>Bilans pojedynków</h3><ResourceContent {...stats}>{stats.data && <p>Ty <strong>{stats.data.winsAgainst}</strong> : <strong>{stats.data.lossesAgainst}</strong> {person.username}</p>}</ResourceContent>
      </section>}
      {editing && <ProfileEditor username={person.username} initial={appearance} badges={profileBadges} onClose={() => setEditing(false)}
        onUnauthorized={unauthorized} onSaved={value => { setPersonalization(value); setSaved(true); }} />}
    </div>
  );
}
