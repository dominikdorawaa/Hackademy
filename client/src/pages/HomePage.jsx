import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import API_URL from '../apiConfig';
import Hero from '../components/Hero';
import HowItWorks from '../components/HowItWorks';
import Arena from '../components/Arena';
import Rooms from '../components/Rooms';
import Leaderboard from '../components/Leaderboard';
import Newsletter from '../components/Newsletter';

const HomePage = () => {
  const { isAuthenticated, loading } = useAuth();
  const navigate = useNavigate();
  const [rankingData, setRankingData] = useState([]);
  const [rankingLoading, setRankingLoading] = useState(true);

  useEffect(() => {
    // Wait for auth to finish loading before redirecting
    if (!loading && isAuthenticated) {
      navigate('/dashboard', { replace: true });
    }
  }, [isAuthenticated, loading, navigate]);

  useEffect(() => {
    // Fetch real ranking data for landing page
    const fetchRanking = async () => {
      try {
        setRankingLoading(true);
        const response = await fetch(`${API_URL}/api/user/ranking`, {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json'
          },
        });

        if (response.ok) {
          const data = await response.json();
          // Take top 3 for landing page
          setRankingData(data.slice(0, 3));
        } else {
          console.error('Failed to fetch ranking:', response.status);
          setRankingData([]);
        }
      } catch (err) {
        console.error('Failed to fetch ranking:', err);
        setRankingData([]);
      } finally {
        setRankingLoading(false);
      }
    };

    // Only fetch if user is not authenticated (landing page)
    if (!loading && !isAuthenticated) {
      fetchRanking();
    }
  }, [loading, isAuthenticated]);

  // Show loading state while checking authentication
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

  // Show redirect message for authenticated users
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

  // Render full landing page for non-authenticated users
  return (
    <div>
      <Hero />
      <HowItWorks />
      <Arena />
      <Rooms />
      {rankingLoading ? (
        <div style={{ padding: '60px 0', textAlign: 'center' }}>
          <p style={{ color: 'var(--text-gray)' }}>Ładowanie rankingu...</p>
        </div>
      ) : (
        <Leaderboard players={rankingData} />
      )}
      <Newsletter />
    </div>
  );
};

export default HomePage;
