import React, { useState, useEffect } from 'react';
import CTFCard from '../components/CTFCard';
import { useAuth } from '../context/AuthContext';
import { useNavigate } from 'react-router-dom';
import API_URL from '../apiConfig';
import './DashboardPage.css';

const DashboardPage = () => {
  const { token, logout } = useAuth();
  const navigate = useNavigate();
  const [userData, setUserData] = useState(null);
  const [rooms, setRooms] = useState([]);
  const [loading, setLoading] = useState(true);
  const [roomsLoading, setRoomsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [roomsError, setRoomsError] = useState(null);

  // Filters State
  const [selectedDifficulties, setSelectedDifficulties] = useState([]);
  const [selectedCategories, setSelectedCategories] = useState([]);
  const [statusFilter, setStatusFilter] = useState('ALL'); // ALL, UNSOLVED, SOLVED
  const [sortOption, setSortOption] = useState('NEWEST'); // NEWEST, OLDEST, POPULAR, POINTS_DESC, POINTS_ASC

  useEffect(() => {
    const fetchUserData = async () => {
      try {
        setLoading(true);
        setError(null);

        const response = await fetch(`${API_URL}/api/user/me`, {
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

        const response = await fetch(`${API_URL}/api/rooms`, {
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

  const handleDifficultyChange = (difficulty) => {
    setSelectedDifficulties(prev => {
      if (prev.includes(difficulty)) {
        return prev.filter(d => d !== difficulty);
      } else {
        return [...prev, difficulty];
      }
    });
  };

  const handleCategoryChange = (category) => {
    setSelectedCategories(prev => {
      if (prev.includes(category)) {
        return prev.filter(c => c !== category);
      } else {
        return [...prev, category];
      }
    });
  };

  // Filtering Logic
  const filteredRooms = rooms.filter(room => {
    // Difficulty Filter
    if (selectedDifficulties.length > 0 && !selectedDifficulties.includes(room.difficulty)) {
      return false;
    }

    // Category Filter
    if (selectedCategories.length > 0 && !selectedCategories.includes(room.category)) {
      return false;
    }

    // Status Filter
    if (statusFilter === 'SOLVED' && !room.solved) return false;
    if (statusFilter === 'UNSOLVED' && room.solved) return false;

    return true;
  });

  // Sorting Logic
  const sortedRooms = [...filteredRooms].sort((a, b) => {
    switch (sortOption) {
      case 'NEWEST':
        return new Date(b.createdAt) - new Date(a.createdAt);
      case 'OLDEST':
        return new Date(a.createdAt) - new Date(b.createdAt);
      case 'POPULAR':
        return b.solutionsCount - a.solutionsCount;
      case 'POINTS_DESC':
        return b.points - a.points;
      case 'POINTS_ASC':
        return a.points - b.points;
      default:
        return 0;
    }
  });

  // Extract unique categories from rooms for filter options
  const availableCategories = [...new Set(rooms.map(room => room.category))].sort();
  // Default categories if none exist yet or to ensure order
  const defaultCategories = ['Web', 'Crypto', 'Forensics', 'Reverse', 'OSINT', 'Misc'];
  const categoriesToDisplay = [...new Set([...defaultCategories, ...availableCategories])];

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
    <div className="container dashboard-container">
      {/* Sidebar Filters */}
      <aside className="filters-sidebar">
        <div className="filter-group">
          <h3 className="filter-title"><i className="fas fa-layer-group"></i> Poziom Trudności</h3>
          <div className="filter-options">
            {['EASY', 'MEDIUM', 'HARD', 'INSANE'].map(diff => (
              <label key={diff} className="filter-label">
                <input 
                  type="checkbox" 
                  className="filter-checkbox"
                  checked={selectedDifficulties.includes(diff)}
                  onChange={() => handleDifficultyChange(diff)}
                />
                {diff === 'EASY' && 'Łatwy'}
                {diff === 'MEDIUM' && 'Średni'}
                {diff === 'HARD' && 'Trudny'}
                {diff === 'INSANE' && 'Niemożliwy'}
              </label>
            ))}
          </div>
        </div>

        <div className="filter-group">
          <h3 className="filter-title"><i className="fas fa-folder"></i> Kategoria</h3>
          <div className="filter-options">
            {categoriesToDisplay.map(cat => (
              <label key={cat} className="filter-label">
                <input 
                  type="checkbox" 
                  className="filter-checkbox"
                  checked={selectedCategories.includes(cat)}
                  onChange={() => handleCategoryChange(cat)}
                />
                {cat}
              </label>
            ))}
          </div>
        </div>

        <div className="filter-group">
          <h3 className="filter-title"><i className="fas fa-tasks"></i> Status</h3>
          <div className="filter-options">
            <label className="filter-label">
              <input 
                type="radio" 
                name="status"
                className="filter-checkbox" // Reusing checkbox style for radio
                style={{ borderRadius: '50%' }}
                checked={statusFilter === 'ALL'}
                onChange={() => setStatusFilter('ALL')}
              />
              Wszystkie
            </label>
            <label className="filter-label">
              <input 
                type="radio" 
                name="status"
                className="filter-checkbox"
                style={{ borderRadius: '50%' }}
                checked={statusFilter === 'UNSOLVED'}
                onChange={() => setStatusFilter('UNSOLVED')}
              />
              Do zrobienia
            </label>
            <label className="filter-label">
              <input 
                type="radio" 
                name="status"
                className="filter-checkbox"
                style={{ borderRadius: '50%' }}
                checked={statusFilter === 'SOLVED'}
                onChange={() => setStatusFilter('SOLVED')}
              />
              Ukończone
            </label>
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <main className="rooms-content">
        <header className="rooms-header">
          <div>
            <h1 style={{ fontSize: '2rem', margin: 0 }}>Wyzwania CTF</h1>
            <p className="results-count">Znaleziono: {sortedRooms.length}</p>
          </div>
          
          <select 
            className="sort-select"
            value={sortOption}
            onChange={(e) => setSortOption(e.target.value)}
          >
            <option value="NEWEST">Najnowsze</option>
            <option value="OLDEST">Najstarsze</option>
            <option value="POPULAR">Najpopularniejsze</option>
            <option value="POINTS_DESC">Najwięcej punktów</option>
            <option value="POINTS_ASC">Najmniej punktów</option>
          </select>
        </header>

        {roomsLoading ? (
          <h2>Ładowanie pokoi...</h2>
        ) : roomsError ? (
          <h2>Błąd: {roomsError}</h2>
        ) : (
          <>
            {sortedRooms.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '40px', color: 'var(--text-gray)', backgroundColor: '#1e1e1e', borderRadius: '12px' }}>
                <h3>Brak pokoi spełniających kryteria.</h3>
              </div>
            ) : (
              <div className="rooms-grid">
                {sortedRooms.map(challenge => (
                  <CTFCard key={challenge.id} challenge={challenge} />
                ))}
              </div>
            )}
          </>
        )}
      </main>
    </div>
  );
};

export default DashboardPage;
