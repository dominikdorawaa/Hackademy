import React, { useState, useEffect } from 'react';
import CTFCard from '../components/CTFCard';
import { useAuth } from '../context/AuthContext';
import { useNavigate } from 'react-router-dom';
import API_URL from '../apiConfig';
import './DashboardPage.css';

// ─── Active Path Widget ────────────────────────────────────────────────────────
const ActivePathWidget = ({ token, navigate }) => {
  const [pathData, setPathData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      try {
        // 1. Pobierz listę wszystkich ścieżek
        const listRes = await fetch(`${API_URL}/api/paths`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (!listRes.ok) return;
        const paths = await listRes.json();
        if (!Array.isArray(paths) || paths.length === 0) return;

        // 2. Znajdź ścieżkę "w trakcie" – pierwszą z pokojami częściowo ukończonymi
        //    Strategia: pobierz szczegóły każdej po kolei i wybierz tę, w której
        //    jest co najmniej 1 solved=true ORAZ co najmniej 1 locked=false && solved=false.
        let found = null;
        for (const p of paths) {
          const detRes = await fetch(`${API_URL}/api/paths/${p.id}`, {
            headers: { Authorization: `Bearer ${token}` },
          });
          if (!detRes.ok) continue;
          const det = await detRes.json();
          const rooms = Array.isArray(det.rooms) ? det.rooms : [];
          const solvedCount = rooms.filter(r => r.solved).length;
          const inProgress = rooms.some(r => !r.locked && !r.solved);
          if (solvedCount > 0 || inProgress) {
            found = { ...det, solvedCount, totalCount: rooms.length };
            break;
          }
        }

        // Fallback: jeśli żadna nie jest "w trakcie", weź pierwszą
        if (!found) {
          const detRes = await fetch(`${API_URL}/api/paths/${paths[0].id}`, {
            headers: { Authorization: `Bearer ${token}` },
          });
          if (detRes.ok) {
            const det = await detRes.json();
            const rooms = Array.isArray(det.rooms) ? det.rooms : [];
            found = { ...det, solvedCount: 0, totalCount: rooms.length };
          }
        }

        setPathData(found);
      } catch (e) {
        console.error('ActivePathWidget error:', e);
      } finally {
        setLoading(false);
      }
    };
    if (token) load();
  }, [token]);

  if (loading) return (
    <div className="active-path-widget">
      <div className="apw-loading">Ładowanie aktywnej ścieżki...</div>
    </div>
  );

  if (!pathData) return null;

  const rooms = Array.isArray(pathData.rooms) ? pathData.rooms : [];
  const solved = pathData.solvedCount ?? rooms.filter(r => r.solved).length;
  const total = pathData.totalCount ?? rooms.length;
  const pct = total > 0 ? Math.round((solved / total) * 100) : 0;
  const previewRooms = rooms.slice(0, 4);

  const statusLabel = (r) => {
    if (r.solved) return { label: 'Ukończone', cls: 'apw-done' };
    if (r.locked) return { label: 'Zablokowane', cls: 'apw-locked' };
    return { label: 'W trakcie', cls: 'apw-active' };
  };

  return (
    <div className="active-path-widget">
      <div className="apw-header">
        <div className="apw-title-row">
          <span className="apw-label"><i className="fas fa-route" /> Ścieżka nauki:</span>
          <span className="apw-name">{pathData.title}</span>
          <button
            className="apw-goto-btn"
            onClick={() => navigate(`/learn/paths/${pathData.id}`)}
          >
            Przejdź <i className="fas fa-arrow-right" />
          </button>
        </div>
        <div className="apw-progress-wrap">
          <div className="apw-progress-bar">
            <div className="apw-progress-fill" style={{ width: `${pct}%` }} />
          </div>
          <span className="apw-pct">{solved}/{total} pokoi &bull; {pct}%</span>
        </div>
      </div>

      <div className="apw-rooms">
        {previewRooms.map((r) => {
          const { label, cls } = statusLabel(r);
          return (
            <div key={r.id} className={`apw-room-row ${r.locked ? 'apw-row-locked' : ''}`}>
              <div className={`apw-room-dot ${cls}`}>
                {r.solved
                  ? <i className="fas fa-check" />
                  : r.locked
                  ? <i className="fas fa-lock" />
                  : <i className="fas fa-play" />}
              </div>
              <span className="apw-room-title">{r.title}</span>
              <span className={`apw-room-status ${cls}`}>{label}</span>
              {!r.locked && (
                <button
                  className="apw-room-btn"
                  onClick={() => navigate(`/rooms/${r.id}`)}
                >
                  {r.solved ? 'Powtórz' : 'Start'}
                </button>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};

const ITEMS_PER_PAGE = 12;

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
  const [vpnFilter, setVpnFilter] = useState('ALL'); // ALL, VPN_REQUIRED, NO_VPN
  const [sortOption, setSortOption] = useState('NEWEST'); // NEWEST, OLDEST, POPULAR, POINTS_DESC, POINTS_ASC
  
  // Pagination State
  const [currentPage, setCurrentPage] = useState(1);

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
    setCurrentPage(1); // Reset to first page on filter change
  };

  const handleCategoryChange = (category) => {
    setSelectedCategories(prev => {
      if (prev.includes(category)) {
        return prev.filter(c => c !== category);
      } else {
        return [...prev, category];
      }
    });
    setCurrentPage(1);
  };

  const handleStatusChange = (status) => {
      setStatusFilter(status);
      setCurrentPage(1);
  };

  const handleVpnFilterChange = (filter) => {
      setVpnFilter(filter);
      setCurrentPage(1);
  };

  const handleSortChange = (e) => {
      setSortOption(e.target.value);
      setCurrentPage(1);
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

    // VPN Filter
    if (vpnFilter === 'VPN_REQUIRED' && !room.requiresVpn) return false;
    if (vpnFilter === 'NO_VPN' && room.requiresVpn) return false;

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

  // Pagination Logic
  const totalPages = Math.ceil(sortedRooms.length / ITEMS_PER_PAGE);
  const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
  const currentRooms = sortedRooms.slice(startIndex, startIndex + ITEMS_PER_PAGE);

  const handlePageChange = (pageNumber) => {
      setCurrentPage(pageNumber);
      window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  // Extract unique categories from rooms for filter options
  const availableCategories = [...new Set(rooms.map(room => room.category))].sort();
  // Default categories if none exist yet or to ensure order
  const defaultCategories = ['Web', 'Crypto', 'Forensics', 'Reverse', 'OSINT', 'Misc'];
  const categoriesToDisplay = [...new Set([...defaultCategories, ...availableCategories])];

  if (loading) {
    return (
      <div className="container" style={{ paddingTop: '40px', paddingBottom: '40px' }}>
        <h1>Ładowanie danych pokoi...</h1>
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
      {/* Header Section - Full Width */}
      <header className="rooms-header">
        <div>
          <h1 style={{ fontSize: '2rem', margin: 0 }}>Wyzwania CTF</h1>
          <p className="results-count">Znaleziono: {sortedRooms.length}</p>
        </div>
        
        <select 
          className="sort-select"
          value={sortOption}
          onChange={handleSortChange}
        >
          <option value="NEWEST">Najnowsze</option>
          <option value="OLDEST">Najstarsze</option>
          <option value="POPULAR">Najpopularniejsze</option>
          <option value="POINTS_DESC">Najwięcej punktów</option>
          <option value="POINTS_ASC">Najmniej punktów</option>
        </select>
      </header>

      {/* Main Grid Layout */}
      <div className="dashboard-content-grid">
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
            <h3 className="filter-title"><i className="fas fa-network-wired"></i> Wymagania</h3>
            <div className="filter-options">
              <label className="filter-label">
                <input 
                  type="radio" 
                  name="vpn"
                  className="filter-checkbox"
                  style={{ borderRadius: '50%' }}
                  checked={vpnFilter === 'ALL'}
                  onChange={() => handleVpnFilterChange('ALL')}
                />
                Wszystkie
              </label>
              <label className="filter-label">
                <input 
                  type="radio" 
                  name="vpn"
                  className="filter-checkbox"
                  style={{ borderRadius: '50%' }}
                  checked={vpnFilter === 'VPN_REQUIRED'}
                  onChange={() => handleVpnFilterChange('VPN_REQUIRED')}
                />
                Wymaga VPN
              </label>
              <label className="filter-label">
                <input 
                  type="radio" 
                  name="vpn"
                  className="filter-checkbox"
                  style={{ borderRadius: '50%' }}
                  checked={vpnFilter === 'NO_VPN'}
                  onChange={() => handleVpnFilterChange('NO_VPN')}
                />
                Bez VPN
              </label>
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
                  onChange={() => handleStatusChange('ALL')}
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
                  onChange={() => handleStatusChange('UNSOLVED')}
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
                  onChange={() => handleStatusChange('SOLVED')}
                />
                Ukończone
              </label>
            </div>
          </div>
        </aside>

        {/* Rooms Grid */}
        <main className="rooms-list-container">
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
                <>
                    <div className="rooms-grid">
                      {currentRooms.map(challenge => (
                        <CTFCard key={challenge.id} challenge={challenge} />
                      ))}
                    </div>

                    {/* Pagination Controls */}
                    {totalPages > 1 && (
                        <div className="pagination-container">
                            <button 
                                onClick={() => handlePageChange(currentPage - 1)}
                                disabled={currentPage === 1}
                                className="pagination-btn"
                            >
                                <i className="fas fa-chevron-left"></i>
                            </button>
                            
                            {Array.from({ length: totalPages }, (_, i) => i + 1).map(page => (
                                <button
                                    key={page}
                                    onClick={() => handlePageChange(page)}
                                    className={`pagination-btn ${currentPage === page ? 'active' : ''}`}
                                >
                                    {page}
                                </button>
                            ))}

                            <button 
                                onClick={() => handlePageChange(currentPage + 1)}
                                disabled={currentPage === totalPages}
                                className="pagination-btn"
                            >
                                <i className="fas fa-chevron-right"></i>
                            </button>
                        </div>
                    )}
                </>
              )}
            </>
          )}
        </main>
      </div>
    </div>
  );
};

export default DashboardPage;
