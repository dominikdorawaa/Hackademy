import React, { useState, useEffect } from 'react';
import Leaderboard from '../components/Leaderboard';
import { useAuth } from '../context/AuthContext';
import API_URL from '../apiConfig';

const RankingPage = () => {
  const { token } = useAuth();
  const [players, setPlayers] = useState([]);
  const [currentUser, setCurrentUser] = useState(null);
  const [myRank, setMyRank] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        setError(null);

        const headers = {
          'Content-Type': 'application/json',
          ...(token && { 'Authorization': `Bearer ${token}` })
        };

        const res = await fetch(`${API_URL}/api/ranking/summary`, { method: 'GET', headers });
        if (!res.ok) throw new Error('Failed to fetch ranking summary');
        const data = await res.json();

        setPlayers(Array.isArray(data?.ranking) ? data.ranking : []);
        setCurrentUser(data?.user ?? null);
        setMyRank(data?.myRank ?? null);

      } catch (err) {
        console.error("Failed to fetch data:", err);
        setError('Network error: Could not connect to the server.');
      } finally {
        setLoading(false);
      }
    };

    fetchData();
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
  const pointsRanking = [...players].sort((a, b) => (b.points || 0) - (a.points || 0));
  const top10Points = pointsRanking.slice(0, 10);

  // Sort players for ELO Leaderboard
  const eloRanking = [...players].sort((a, b) => (b.elo || 500) - (a.elo || 500));
  const top10Elo = eloRanking.slice(0, 10);

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
                    players={top10Points} 
                    showTitle={false} 
                    type="points" 
                    title="Ranking Punktowy" 
                    currentUsername={currentUser?.username}
                    myRank={myRank}
                />
            </div>
            <div style={{ flex: '1 1 400px', minWidth: '300px' }}>
                <Leaderboard 
                    players={top10Elo} 
                    showTitle={false} 
                    type="elo" 
                    title="Ranking Areny (ELO)" 
                    currentUsername={currentUser?.username}
                    myRank={myRank}
                />
            </div>
        </div>
      </div>
    </div>
  );
};

export default RankingPage;
