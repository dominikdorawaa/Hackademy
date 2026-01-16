import React, { useState, useEffect } from 'react';
import CTFCard from '../components/CTFCard';
import { useAuth } from '../context/AuthContext';
import { useNavigate } from 'react-router-dom';

const DashboardPage = () => {
  const { token, logout } = useAuth();
  const navigate = useNavigate();
  const [userData, setUserData] = useState(null);
  const [rooms, setRooms] = useState([]);
  const [loading, setLoading] = useState(true);
  const [roomsLoading, setRoomsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [roomsError, setRoomsError] = useState(null);
  const [selectedDifficulty, setSelectedDifficulty] = useState('ALL');

  useEffect(() => {
    const fetchUserData = async () => {
      try {
        setLoading(true);
        setError(null);

        const response = await fetch('http://localhost:8080/api/user/me', {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          },
        });

        if (response.ok) {
          const data = await response.json();
          setUserData(data);
        } else if (response.status === 401 || response.status === 403) {
          logout();
          navigate('/login');
        } else {
          const errorMessage = await response.text();
          setError(`Failed to fetch user data: ${errorMessage}`);
        }
      } catch (err) {
        setError('Network error: Could not connect to the server.');
        console.error("Failed to fetch user data:", err);
      } finally {
        setLoading(false);
      }
    };

    const fetchRooms = async () => {
      try {
        setRoomsLoading(true);
        setRoomsError(null);

        const response = await fetch('http://localhost:8080/api/rooms', {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          },
        });

        if (response.ok) {
          const data = await response.json();
          setRooms(data);
        } else {
          const errorMessage = await response.text();
          setRoomsError(`Failed to fetch rooms: ${errorMessage}`);
        }
      } catch (err) {
        setRoomsError('Network error: Could not connect to the server.');
        console.error("Failed to fetch rooms:", err);
      } finally {
        setRoomsLoading(false);
      }
    };

    if (token) {
      fetchUserData();
      fetchRooms();
    } else {
      logout();
      navigate('/login');
    }
  }, [token, logout, navigate]);

  const filteredRooms = selectedDifficulty === 'ALL' 
    ? rooms 
    : rooms.filter(room => room.difficulty === selectedDifficulty);

  if (loading) {
    return (
      <div className="container" style={{ paddingTop: '40px', paddingBottom: '40px' }}>
        <h1>Ładowanie danych użytkownika...</h1>
      </div>
    );
  }

  if (error) {
    return (
      <div className="container" style={{ paddingTop: '40px', paddingBottom: '40px' }}>
        <h1>Błąd: {error}</h1>
        <button onClick={logout}>Wyloguj</button>
      </div>
    );
  }

  if (!userData) {
    return (
      <div className="container" style={{ paddingTop: '40px', paddingBottom: '40px' }}>
        <h1>Brak danych użytkownika.</h1>
        <button onClick={logout}>Wyloguj</button>
      </div>
    );
  }

  return (
    <div className="container" style={{ paddingTop: '40px', paddingBottom: '40px' }}>
      <header style={{ marginBottom: '40px' }}>
        <h1 style={{ fontSize: '2.5rem' }}>Witaj z powrotem, {userData.username}!</h1>
        <p className="section-subtitle" style={{ textAlign: 'left', margin: '10px 0 0 0', color: 'var(--text-gray)' }}>
          Wybierz wyzwanie i kontynuuj swoją naukę.
        </p>
      </header>

      {/* Filter Controls */}
      <div style={{ marginBottom: '30px', display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
        <button 
          onClick={() => setSelectedDifficulty('ALL')}
          className={`btn ${selectedDifficulty === 'ALL' ? 'btn-primary' : 'btn-outline'}`}
          style={{ padding: '8px 16px', fontSize: '0.9rem' }}
        >
          Wszystkie
        </button>
        <button 
          onClick={() => setSelectedDifficulty('EASY')}
          className={`btn ${selectedDifficulty === 'EASY' ? 'btn-primary' : 'btn-outline'}`}
          style={{ padding: '8px 16px', fontSize: '0.9rem', borderColor: '#2ecc71', color: selectedDifficulty === 'EASY' ? 'white' : '#2ecc71', backgroundColor: selectedDifficulty === 'EASY' ? '#2ecc71' : 'transparent' }}
        >
          Łatwe
        </button>
        <button 
          onClick={() => setSelectedDifficulty('MEDIUM')}
          className={`btn ${selectedDifficulty === 'MEDIUM' ? 'btn-primary' : 'btn-outline'}`}
          style={{ padding: '8px 16px', fontSize: '0.9rem', borderColor: '#f1c40f', color: selectedDifficulty === 'MEDIUM' ? 'black' : '#f1c40f', backgroundColor: selectedDifficulty === 'MEDIUM' ? '#f1c40f' : 'transparent' }}
        >
          Średnie
        </button>
        <button 
          onClick={() => setSelectedDifficulty('HARD')}
          className={`btn ${selectedDifficulty === 'HARD' ? 'btn-primary' : 'btn-outline'}`}
          style={{ padding: '8px 16px', fontSize: '0.9rem', borderColor: '#e74c3c', color: selectedDifficulty === 'HARD' ? 'white' : '#e74c3c', backgroundColor: selectedDifficulty === 'HARD' ? '#e74c3c' : 'transparent' }}
        >
          Trudne
        </button>
        <button 
          onClick={() => setSelectedDifficulty('INSANE')}
          className={`btn ${selectedDifficulty === 'INSANE' ? 'btn-primary' : 'btn-outline'}`}
          style={{ padding: '8px 16px', fontSize: '0.9rem', borderColor: '#8e44ad', color: selectedDifficulty === 'INSANE' ? 'white' : '#8e44ad', backgroundColor: selectedDifficulty === 'INSANE' ? '#8e44ad' : 'transparent' }}
        >
          Niemożliwe
        </button>
      </div>

      {roomsLoading ? (
        <h2>Ładowanie pokoi...</h2>
      ) : roomsError ? (
        <h2>Błąd: {roomsError}</h2>
      ) : (
        <>
          {filteredRooms.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '40px', color: 'var(--text-gray)' }}>
              <h3>Brak pokoi o wybranym poziomie trudności.</h3>
            </div>
          ) : (
            <div className="rooms-grid">
              {filteredRooms.map(challenge => (
                <CTFCard key={challenge.id} challenge={challenge} />
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
};

export default DashboardPage;
