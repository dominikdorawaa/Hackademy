import React, { useEffect, useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import API_URL from '../../apiConfig';
import './Management.css';
import './PathManagement.css';

const PathManagement = () => {
  const { token } = useAuth();

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [rooms, setRooms] = useState([]);
  const [selectedRoomIds, setSelectedRoomIds] = useState([]);
  const [roomQuery, setRoomQuery] = useState('');
  const [paths, setPaths] = useState([]);
  const [mode, setMode] = useState('edit'); // edit | create
  const [activePathId, setActivePathId] = useState('');
  const [editTitle, setEditTitle] = useState('');
  const [editDescription, setEditDescription] = useState('');
  const [editRoomIds, setEditRoomIds] = useState([]);
  const [savingEdit, setSavingEdit] = useState(false);
  const [status, setStatus] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchRooms = async () => {
      try {
        const res = await fetch(`${API_URL}/api/admin/rooms`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (!res.ok) return;
        const data = await res.json();
        setRooms(Array.isArray(data) ? data : []);
      } catch {
        // ignore
      }
    };
    if (token) fetchRooms();
  }, [token]);

  const fetchPaths = async () => {
    try {
      const res = await fetch(`${API_URL}/api/admin/paths`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) return;
      const data = await res.json();
      setPaths(Array.isArray(data) ? data : []);
    } catch {
      // ignore
    }
  };

  useEffect(() => {
    if (token) fetchPaths();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  const fetchPathDetail = async (pathId) => {
    if (!pathId) return;
    try {
      const res = await fetch(`${API_URL}/api/admin/paths/${pathId}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) return;
      const data = await res.json();
      setEditTitle(data?.title || '');
      setEditDescription(data?.description || '');
      setEditRoomIds(Array.isArray(data?.roomIds) ? data.roomIds : []);
    } catch {
      // ignore
    }
  };

  const toggleRoom = (roomId) => {
    setSelectedRoomIds((prev) => (prev.includes(roomId) ? prev.filter((x) => x !== roomId) : [...prev, roomId]));
  };

  const moveSelected = (roomId, dir) => {
    setSelectedRoomIds((prev) => {
      const idx = prev.indexOf(roomId);
      if (idx < 0) return prev;
      const nextIdx = idx + dir;
      if (nextIdx < 0 || nextIdx >= prev.length) return prev;
      const copy = [...prev];
      const tmp = copy[idx];
      copy[idx] = copy[nextIdx];
      copy[nextIdx] = tmp;
      return copy;
    });
  };

  const removeSelected = (roomId) => {
    setSelectedRoomIds((prev) => prev.filter((x) => x !== roomId));
  };

  const toggleEditRoom = (roomId) => {
    setEditRoomIds((prev) => (prev.includes(roomId) ? prev.filter((x) => x !== roomId) : [...prev, roomId]));
  };

  const moveEdit = (roomId, dir) => {
    setEditRoomIds((prev) => {
      const idx = prev.indexOf(roomId);
      if (idx < 0) return prev;
      const nextIdx = idx + dir;
      if (nextIdx < 0 || nextIdx >= prev.length) return prev;
      const copy = [...prev];
      const tmp = copy[idx];
      copy[idx] = copy[nextIdx];
      copy[nextIdx] = tmp;
      return copy;
    });
  };

  const removeEdit = (roomId) => {
    setEditRoomIds((prev) => prev.filter((x) => x !== roomId));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);
    setStatus(null);

    try {
      const res = await fetch(`${API_URL}/api/admin/paths`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          title,
          description,
          roomIds: selectedRoomIds,
        }),
      });

      if (!res.ok) {
        const msg = await res.text();
        throw new Error(msg || 'Nie udało się dodać ścieżki');
      }

      setTitle('');
      setDescription('');
      setSelectedRoomIds([]);
      setStatus('Ścieżka dodana.');
      fetchPaths();
    } catch (err) {
      setError(err.message || 'Błąd');
    }
  };

  const handleDeletePath = async (pathId) => {
    if (!window.confirm('Usunąć ścieżkę?')) return;
    setError(null);
    setStatus(null);
    try {
      const res = await fetch(`${API_URL}/api/admin/paths/${pathId}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) {
        const msg = await res.text();
        throw new Error(msg || 'Nie udało się usunąć ścieżki');
      }
      setStatus('Ścieżka usunięta.');
      fetchPaths();
    } catch (err) {
      setError(err.message || 'Błąd');
    }
  };

  const handleSaveEdit = async () => {
    if (!activePathId) return;
    setError(null);
    setStatus(null);
    setSavingEdit(true);
    try {
      const res = await fetch(`${API_URL}/api/admin/paths/${activePathId}/rooms`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ roomIds: editRoomIds }),
      });
      if (!res.ok) {
        const msg = await res.text();
        throw new Error(msg || 'Nie udało się zapisać zmian');
      }
      setStatus('Zapisano zmiany w ścieżce.');
      fetchPaths();
    } catch (err) {
      setError(err.message || 'Błąd');
    } finally {
      setSavingEdit(false);
    }
  };

  const availableRooms = rooms.filter((r) => r.roomType === 'PATH');

  const roomsFiltered = availableRooms
    .filter((r) => {
      const q = roomQuery.trim().toLowerCase();
      if (!q) return true;
      return (r.title || '').toLowerCase().includes(q);
    })
    .slice(0, 200);

  const byId = new Map(rooms.map((r) => [r.id, r]));
  const selectedRooms = selectedRoomIds.map((id) => byId.get(id)).filter(Boolean);
  const editRooms = editRoomIds.map((id) => byId.get(id)).filter(Boolean);

  return (
    <div className="management-container">
      <h2>Ścieżki</h2>

      {error && <div className="error-message">{error}</div>}
      {status && <div style={{ textAlign: 'center', color: '#2ecc71', marginBottom: '1rem' }}>{status}</div>}

      <div className="pm-mode-tabs">
        <button type="button" className={mode === 'edit' ? 'active' : ''} onClick={() => setMode('edit')}>
          Edytuj istniejącą
        </button>
        <button type="button" className={mode === 'create' ? 'active' : ''} onClick={() => setMode('create')}>
          Dodaj nową
        </button>
      </div>

      {mode === 'edit' && (
        <div className="pm-grid">
          <div className="pm-card">
            <div className="pm-card-title">Wybierz ścieżkę</div>
            <select
              className="pm-select"
              value={activePathId}
              onChange={(e) => {
                const v = e.target.value;
                setActivePathId(v);
                fetchPathDetail(v);
              }}
            >
              <option value="">— wybierz —</option>
              {paths.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.title} ({p.roomsCount ?? 0})
                </option>
              ))}
            </select>

            {activePathId ? (
              <>
                <div className="pm-edit-meta">
                  <div className="pm-edit-title">{editTitle || '—'}</div>
                  <div className="pm-edit-desc">{editDescription || '—'}</div>
                </div>

                <div className="pm-selected-header" style={{ marginTop: '12px' }}>
                  <span>Pokoje w ścieżce</span>
                  <span className="pm-muted">{editRoomIds.length}</span>
                </div>

                <div className="pm-selected-list">
                  {editRooms.length === 0 ? (
                    <div className="pm-empty">Dodaj pokoje po prawej.</div>
                  ) : (
                    editRooms.map((r, idx) => (
                      <div key={r.id} className="pm-selected-row">
                        <div className="pm-order">{idx + 1}</div>
                        <div className="pm-selected-title">{r.title}</div>
                        <div className="pm-selected-actions">
                          <button type="button" className="pm-icon-btn" onClick={() => moveEdit(r.id, -1)} title="Góra" disabled={idx === 0}>
                            <i className="fas fa-chevron-up" />
                          </button>
                          <button
                            type="button"
                            className="pm-icon-btn"
                            onClick={() => moveEdit(r.id, 1)}
                            title="Dół"
                            disabled={idx === editRooms.length - 1}
                          >
                            <i className="fas fa-chevron-down" />
                          </button>
                          <button type="button" className="pm-icon-btn danger" onClick={() => removeEdit(r.id)} title="Usuń">
                            <i className="fas fa-times" />
                          </button>
                        </div>
                      </div>
                    ))
                  )}
                </div>

                <div className="pm-edit-actions">
                  <button type="button" className="btn btn-outline" onClick={() => window.open(`/learn/paths/${activePathId}`, '_blank')}>
                    Podgląd
                  </button>
                  <button type="button" className="pm-primary" onClick={handleSaveEdit} disabled={savingEdit}>
                    {savingEdit ? 'Zapisywanie...' : 'Zapisz zmiany'}
                  </button>
                </div>

                <button type="button" className="btn-delete" onClick={() => handleDeletePath(activePathId)} style={{ marginTop: '10px', width: '100%' }}>
                  Usuń ścieżkę
                </button>
              </>
            ) : (
              <div className="pm-empty">Wybierz ścieżkę z listy.</div>
            )}
          </div>

          <div className="pm-card">
            <div className="pm-card-title">Dodaj / usuń pokoje</div>
            <input
              className="pm-search"
              value={roomQuery}
              onChange={(e) => setRoomQuery(e.target.value)}
              placeholder="Szukaj pokoju po tytule..."
            />

            <div className="pm-rooms-list">
              {roomsFiltered.length === 0 ? (
                <div className="pm-empty">Brak pokoi.</div>
              ) : (
                roomsFiltered.map((r) => (
                  <label key={r.id} className={`pm-room-row ${editRoomIds.includes(r.id) ? 'selected' : ''}`}>
                    <input type="checkbox" checked={editRoomIds.includes(r.id)} onChange={() => toggleEditRoom(r.id)} />
                    <div className="pm-room-title">{r.title}</div>
                    <div className="pm-room-meta">{r.difficulty}</div>
                  </label>
                ))
              )}
            </div>
          </div>
        </div>
      )}

      {mode === 'create' && (
      <div className="pm-grid">
        <form className="pm-card" onSubmit={handleSubmit}>
          <div className="pm-card-title">Dodaj ścieżkę</div>

          <label className="pm-label">
            Tytuł
            <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="np. Web Fundamentals" required />
          </label>

          <label className="pm-label">
            Opis
            <textarea value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Krótki opis ścieżki (opcjonalnie)" />
          </label>

          <div className="pm-selected-header">
            <span>Wybrane pokoje</span>
            <span className="pm-muted">{selectedRoomIds.length}</span>
          </div>

          <div className="pm-selected-list">
            {selectedRooms.length === 0 ? (
              <div className="pm-empty">Zaznacz pokoje po prawej.</div>
            ) : (
              selectedRooms.map((r, idx) => (
                <div key={r.id} className="pm-selected-row">
                  <div className="pm-order">{idx + 1}</div>
                  <div className="pm-selected-title">{r.title}</div>
                  <div className="pm-selected-actions">
                    <button type="button" className="pm-icon-btn" onClick={() => moveSelected(r.id, -1)} title="Góra" disabled={idx === 0}>
                      <i className="fas fa-chevron-up" />
                    </button>
                    <button
                      type="button"
                      className="pm-icon-btn"
                      onClick={() => moveSelected(r.id, 1)}
                      title="Dół"
                      disabled={idx === selectedRooms.length - 1}
                    >
                      <i className="fas fa-chevron-down" />
                    </button>
                    <button type="button" className="pm-icon-btn danger" onClick={() => removeSelected(r.id)} title="Usuń">
                      <i className="fas fa-times" />
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>

          <button type="submit" className="pm-primary" disabled={!title.trim()}>
            Dodaj ścieżkę
          </button>
        </form>

        <div className="pm-card">
          <div className="pm-card-title">Wybierz pokoje</div>
          <input
            className="pm-search"
            value={roomQuery}
            onChange={(e) => setRoomQuery(e.target.value)}
            placeholder="Szukaj pokoju po tytule..."
          />

          <div className="pm-rooms-list">
            {roomsFiltered.length === 0 ? (
              <div className="pm-empty">Brak pokoi.</div>
            ) : (
              roomsFiltered.map((r) => (
                <label key={r.id} className={`pm-room-row ${selectedRoomIds.includes(r.id) ? 'selected' : ''}`}>
                  <input type="checkbox" checked={selectedRoomIds.includes(r.id)} onChange={() => toggleRoom(r.id)} />
                  <div className="pm-room-title">{r.title}</div>
                  <div className="pm-room-meta">{r.difficulty}</div>
                </label>
              ))
            )}
          </div>
        </div>
      </div>
      )}
    </div>
  );
};

export default PathManagement;

