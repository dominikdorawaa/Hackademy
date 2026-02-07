import React, { useState, useEffect } from 'react';
import Leaderboard from '../components/Leaderboard';
import { useAuth } from '../context/AuthContext';
import API_URL from '../apiConfig';

const RankingPage = () => {
  const { token } = useAuth();
  const [players, setPlayers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchRanking = async () => {
      try {
        setLoading(true);
        setError(null);

        const headers = {
          'Content-Type': 'application/json',
          ...(token && { 'Authorization': `Bearer ${token}` })
        };

        const response = await fetch(`${API_URL}/api/user/ranking`, {
          method: 'GET',
          headers: headers,
        });

        if (response.ok) {
          const data = await response.json();
          setPlayers(data || []);
        } else {
          const errorMessage = await response.text();
          console.error('Ranking fetch error:', response.status, errorMessage);
          setError(`Failed to fetch ranking: ${errorMessage}`);
        }
      } catch (err) {
        console.error("Failed to fetch ranking:", err);
        setError('Network error: Could not connect to the server.');
      } finally {
        setLoading(false);
      }
    };

    fetchRanking();
  }, [token]);

  if (loading) {
    return (
      <div style={{ paddingTop: '40px', paddingBottom: '40px' }} className="container">
        <h1 style={{ fontSize: '2.5rem', textAlign: 'center', marginBottom: '40px' }}>Rankingi Graczy</h1>
        <p style={{ textAlign: 'center' }}>Ładowanie rankingów...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div style={{ paddingTop: '40px', paddingBottom: '40px' }} className="container">
        <h1 style={{ fontSize: '2.5rem', textAlign: 'center', marginBottom: '40px' }}>Rankingi Graczy</h1>
        <p style={{ textAlign: 'center', color: 'red' }}>Błąd: {error}</p>
      </div>
    );
  }

  // Sort players for Points Leaderboard
  const pointsRanking = [...players].sort((a, b) => (b.points || 0) - (a.points || 0)).slice(0, 10);

  // Sort players for ELO Leaderboard
  const eloRanking = [...players].sort((a, b) => (b.elo || 500) - (a.elo || 500)).slice(0, 10);

  return (
    <div style={{ paddingTop: '40px', paddingBottom: '40px' }}>
      <div className="container">
        <h1 style={{ fontSize: '2.5rem', textAlign: 'center', marginBottom: '40px' }}>Rankingi Graczy</h1>
        
        <div style={{ 
            display: 'flex', 
            flexWrap: 'wrap', 
            gap: '40px', 
            justifyContent: 'center' 
        }}>
            <div style={{ flex: '1 1 400px', minWidth: '300px' }}>
                <Leaderboard 
                    players={pointsRanking} 
                    showTitle={false} 
                    type="points" 
                    title="Ranking Punktowy" 
                />
            </div>
            <div style={{ flex: '1 1 400px', minWidth: '300px' }}>
                <Leaderboard 
                    players={eloRanking} 
                    showTitle={false} 
                    type="elo" 
                    title="Ranking Areny (ELO)" 
                />
            </div>
        </div>
      </div>
    </div>
  );
};

export default RankingPage;
