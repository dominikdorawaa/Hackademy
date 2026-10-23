import ProfileIcon from './ProfileIcon';
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
import ProfileSaveNotification from './ProfileSaveNotification';
import BadgeShowcase from './BadgeShowcase';
import { PROFILE_INTERESTS } from '../../lib/profile';
import type { ProfilePersonalization } from '../../lib/profile';
import ProfileLearningStats from './ProfileLearningStats';
import ProfileBadges from './ProfileBadges';
import { Button } from '../ui/button';
import { LoadingSkeleton, Skeleton, SkeletonText } from '../common/Skeleton';
import '../../pages/ProfilePage.css';
import './ProfileLayout.css';

function ProfileSkeleton() {
  return (
    <LoadingSkeleton label="Ładowanie profilu" className="hk-skeleton-stack is-loose">
      <Skeleton width={160} height={14} />
      <div className="profile-header" aria-hidden="true">
        <Skeleton className="profile-avatar-skeleton" />
        <div className="profile-identity hk-skeleton-stack">
          <Skeleton width="min(280px, 70%)" height={36} />
          <SkeletonText lines={2} />
        </div>
      </div>
      <Skeleton height={160} radius={12} />
      <Skeleton height={220} radius={12} />
    </LoadingSkeleton>
  );
}

function TextSkeleton({ label }: { label: string }) {
  return (
    <LoadingSkeleton label={label}>
      <SkeletonText lines={2} />
    </LoadingSkeleton>
  );
}

function ResourceContent({
  loading,
  error,
  retry,
  placeholder,
  children,
}: {
  loading: boolean;
  error: string | null;
  retry: () => void;
  placeholder: ReactNode;
  children: ReactNode;
}) {
  if (loading) return placeholder;
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
  const { sessionKey, logout } = useAuth();
  const navigate = useNavigate();
  const own = !username;
  const headers = useMemo(
    () => ({ sessionKey }),
    [sessionKey],
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
  const profile = useApiResource(loadProfile, unauthorized, !!sessionKey);
  const activity = useApiResource(loadActivity, unauthorized, !!sessionKey);
  const badges = useApiResource(loadBadges, unauthorized, own && !!sessionKey);
  const friendship = useApiResource(
    loadFriendship,
    unauthorized,
    !own && !!sessionKey,
  );
  const stats = useApiResource(
    loadStats,
    unauthorized,
    !own && !!sessionKey && friendship.data?.status === 'FRIENDS',
  );
  const [personalization, setPersonalization] = useState<ProfilePersonalization | null>(null);
  const [editing, setEditing] = useState(false);
  const [saved, setSaved] = useState(false);
  const dismissSaved = useCallback(() => setSaved(false), []);
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
      if (response.status === 401) {
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
        <ResourceContent {...profile} placeholder={<ProfileSkeleton />}>
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
    bio: person.bio ?? '', tagline: person.tagline ?? '',
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
      <header className="profile-header" data-tour={own ? 'profile' : undefined}>
        {own ? <Link className="profile-avatar-edit" to="/arena/avatar?from=profile" aria-label="Zmień swój awatar">
          <UserAvatar className="profile-avatar" username={person.username} avatar={person.avatar} alt={`Avatar ${person.username}`} />
        </Link> : <UserAvatar
          className="profile-avatar"
          username={person.username} avatar={person.avatar}
          alt={`Avatar ${person.username}`}
        />}
        <div className="profile-identity">
          <h1>{person.username}</h1>
          {appearance.bio && <PublicBio bio={appearance.bio} />}
          {appearance.interests.length > 0 && <ul className="profile-interest-tags" aria-label="Zainteresowania">
            {appearance.interests.map(interest => <li key={interest}>{PROFILE_INTERESTS[interest] ?? interest}</li>)}
          </ul>}
          <div className="profile-meta">
            <span>
              <ProfileIcon kind="calendar" />W Hackademy od{' '}
              <time dateTime={person.createdAt}>
                {formatDate(person.createdAt)}
              </time>
            </span>
          </div>
        </div>
        <div className="profile-header-side">
          {own && <Button onClick={edit}><ProfileIcon kind="edit" /> Edytuj profil</Button>}
          {!own && (
            <div className="profile-header-actions">
              <>
                <ResourceContent {...friendship} placeholder={<LoadingSkeleton label="Sprawdzam relację"><Skeleton width={170} height={36} radius={8} /></LoadingSkeleton>}>
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
      {saved && <ProfileSaveNotification onClose={dismissSaved} />}
      {beginner && <section className="profile-welcome"><div>
        <h2>Nadaj profilowi swój charakter</h2><p>Dodaj opis i zainteresowania, a potem wybierz odznaki do gabloty.</p></div>
        <Button variant="outline" onClick={edit}>Uzupełnij profil</Button></section>}
      <BadgeShowcase badges={profileBadges} selectedIds={appearance.featuredBadgeIds} own={own} onEdit={edit} />
      <section className="profile-section profile-badges" aria-labelledby="profile-badges-title" data-tour={own ? 'profile-badges' : undefined}>
        <div className="profile-section-heading">
          <h2 id="profile-badges-title">Osiągnięcia</h2></div>
        {own ? <ResourceContent {...badges} placeholder={<TextSkeleton label="Ładowanie osiągnięć" />}><ProfileBadges badges={profileBadges} own /></ResourceContent>
          : <ProfileBadges badges={profileBadges} own={false} />}
      </section>
      {!own && friendshipStatus === 'FRIENDS' && <section className="profile-section profile-duels">
        <h3>Bilans pojedynków</h3><ResourceContent {...stats} placeholder={<TextSkeleton label="Ładowanie bilansu" />}>{stats.data && <p>Ty <strong>{stats.data.winsAgainst}</strong> : <strong>{stats.data.lossesAgainst}</strong> {person.username}</p>}</ResourceContent>
      </section>}
      <div className="profile-details-grid">
        <section className="profile-section profile-activity" aria-labelledby="profile-activity-title" data-tour={own ? 'profile-activity' : undefined}>
          <div className="profile-section-heading"><h2 id="profile-activity-title">Regularność nauki</h2></div>
          <ResourceContent {...activity} placeholder={<LoadingSkeleton label="Ładowanie aktywności"><Skeleton height={140} radius={8} /></LoadingSkeleton>}><ActivityCalendar data={activity.data ?? []} /></ResourceContent>
        </section>
        <ProfileLearningStats activity={activity.data} loading={activity.loading} />
      </div>
      {editing && <ProfileEditor username={person.username} initial={appearance} badges={profileBadges} onClose={() => setEditing(false)}
        onUnauthorized={unauthorized} onSaved={value => { setPersonalization(value); setSaved(true); }} />}
    </div>
  );
}
