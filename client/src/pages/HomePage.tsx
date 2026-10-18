import React, { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import Hero from '../components/Hero';
import HowItWorks from '../components/HowItWorks';
import Arena from '../components/Arena';
import Rooms from '../components/Rooms';
import Leaderboard from '../components/Leaderboard';
import Newsletter from '../components/Newsletter';
import { LoadingSkeleton, Skeleton } from '../components/common/Skeleton';

/** Przykładowy ranking na landing — bez wywołań do API. */
const STATIC_LANDING_LEADERBOARD = [
  { username: 'CyberNinja', points: 12450, title: 'Elitarny pentester', avatarSeed: 'CyberNinja' },
  { username: 'ByteHunter', points: 10120, title: 'Łowca podatności', avatarSeed: 'ByteHunter' },
  { username: 'StackSmash', points: 9820, title: 'Eksploitacja binarna', avatarSeed: 'StackSmash' },
];

const HomePage = () => {
  const { isAuthenticated, loading } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (!loading && isAuthenticated) {
      navigate('/dashboard', { replace: true });
    }
  }, [isAuthenticated, loading, navigate]);

  if (loading || isAuthenticated) {
    return (
      <div className="hackademy-container" style={{ paddingTop: '64px', paddingBottom: '64px', minHeight: '50vh' }}>
        <LoadingSkeleton label={loading ? 'Ładowanie strony' : 'Przekierowuję do dashboardu'}>
          <Skeleton width="min(560px, 90%)" height={48} style={{ margin: '0 auto 20px' }} />
          <Skeleton width="min(420px, 70%)" height={18} style={{ margin: '0 auto 10px' }} />
          <Skeleton width="min(360px, 60%)" height={18} style={{ margin: '0 auto 32px' }} />
          <div style={{ display: 'flex', gap: 12, justifyContent: 'center' }}>
            <Skeleton width={160} height={44} radius={8} />
            <Skeleton width={160} height={44} radius={8} />
          </div>
        </LoadingSkeleton>
      </div>
    );
  }

  return (
    <div className="landing-page-root">
      <div id="start">
        <Hero />
        <HowItWorks />
      </div>
      <Arena />
      <Rooms />
      <Leaderboard players={STATIC_LANDING_LEADERBOARD} guestLanding />
      <Newsletter />
    </div>
  );
};

export default HomePage;
