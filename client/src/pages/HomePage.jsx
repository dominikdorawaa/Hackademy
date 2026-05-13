import React, { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import Hero from '../components/Hero';
import HowItWorks from '../components/HowItWorks';
import Arena from '../components/Arena';
import Rooms from '../components/Rooms';
import Leaderboard from '../components/Leaderboard';
import Newsletter from '../components/Newsletter';

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

  if (loading) {
    return (
      <div style={{
        paddingTop: '40px',
        paddingBottom: '40px',
        minHeight: '50vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: '#0a0e1a',
        color: 'white'
      }}>
        <div className="container">
          <p style={{ textAlign: 'center', fontSize: '1.2rem' }}>Ładowanie...</p>
        </div>
      </div>
    );
  }

  if (isAuthenticated) {
    return (
      <div style={{
        paddingTop: '40px',
        paddingBottom: '40px',
        minHeight: '50vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: '#0a0e1a',
        color: 'white'
      }}>
        <div className="container">
          <p style={{ textAlign: 'center', fontSize: '1.2rem' }}>Przekierowywanie do dashboardu...</p>
        </div>
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
