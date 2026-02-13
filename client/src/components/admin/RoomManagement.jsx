import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import * as adminApi from '../../services/adminApi';
import API_URL from '../../apiConfig';
import './Management.css';

const RoomManagement = () => {
    // Form state
    const [id, setId] = useState(null); // For edit mode
    const [title, setTitle] = useState('');
    const [shortDescription, setShortDescription] = useState('');
    const [description, setDescription] = useState('');
    const [difficulty, setDifficulty] = useState('EASY');
    const [category, setCategory] = useState('Web');
    const [points, setPoints] = useState(0);
    const [flag, setFlag] = useState('');
    const [requiresVpn, setRequiresVpn] = useState(false); // New field
    const [hints, setHints] = useState([]);
    const [currentHint, setCurrentHint] = useState('');
    const [file, setFile] = useState(null); // New state for file
    
    // UI state
    const [rooms, setRooms] = useState([]);
    const [isEditing, setIsEditing] = useState(false);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);
    const [success, setSuccess] = useState(null);
    
    const { token, user } = useAuth();

    // Fetch rooms on mount
    useEffect(() => {
        fetchRooms();
    }, []);

    const fetchRooms = async () => {
        setLoading(true);
        try {
            const data = await adminApi.getAllRoomsAdmin(token);
            setRooms(data);
        } catch (err) {
            console.error("Failed to fetch rooms", err);
            // Don't set global error here to avoid blocking the create form
        } finally {
            setLoading(false);
        }
    };

    const resetForm = () => {
        setId(null);
        setTitle('');
        setShortDescription('');
        setDescription('');
        setDifficulty('EASY');
        setCategory('Web');
        setPoints(0);
        setFlag('');
        setRequiresVpn(false);
        setHints([]);
        setCurrentHint('');
        setFile(null);
        setIsEditing(false);
        setSuccess(null);
        setError(null);
    };

    const handleEditClick = async (roomSummary) => {
        setError(null);
        setSuccess(null);
        try {
            // Fetch full details including flag
            const room = await adminApi.getRoomAdmin(roomSummary.id, token);
            
            setId(room.id);
            setTitle(room.title);
            setShortDescription(room.shortDescription || '');
            setDescription(room.description);
            setDifficulty(room.difficulty);
            setCategory(room.category || 'Web');
            setPoints(room.points);
            setFlag(room.flag || '');
            setRequiresVpn(room.requiresVpn || false);
            setHints(room.hints || []);
            setFile(null); // Reset file input
            setIsEditing(true);
            window.scrollTo(0, 0); // Scroll to form
        } catch (err) {
            setError("Failed to fetch room details: " + err.message);
        }
    };

    const handleDeleteClick = async (roomId) => {
        if (!window.confirm('Czy na pewno chcesz usunąć ten pokój?')) return;
        
        try {
            await adminApi.deleteRoom(roomId, token);
            setSuccess('Pokój został usunięty.');
            fetchRooms(); // Refresh list
        } catch (err) {
            setError(err.message);
        }
    };

    const handleAddHint = () => {
        if (currentHint.trim()) {
            setHints([...hints, currentHint.trim()]);
            setCurrentHint('');
        }
    };

    const handleRemoveHint = (index) => {
        setHints(hints.filter((_, i) => i !== index));
    };

    const handleFileChange = (e) => {
        if (e.target.files && e.target.files[0]) {
            setFile(e.target.files[0]);
        }
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError(null);
        setSuccess(null);

        const roomData = { 
            title, 
            shortDescription, 
            description, 
            difficulty, 
            category, 
            points: Number(points), 
            flag, 
            requiresVpn,
            hints 
        };

        try {
            // Use FormData to send file and JSON
            const formData = new FormData();
            formData.append('room', new Blob([JSON.stringify(roomData)], { type: 'application/json' }));
            if (file) {
                formData.append('file', file);
            }

            let url = isEditing ? `${API_URL}/api/admin/rooms/${id}` : `${API_URL}/api/admin/rooms`;
            let method = isEditing ? 'PUT' : 'POST';

            const response = await fetch(url, {
                method: method,
                headers: {
                    'Authorization': `Bearer ${token}`
                },
                body: formData
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.message || 'Failed to save room');
            }

            setSuccess(`Pokój "${title}" ${isEditing ? 'zaktualizowany' : 'stworzony'} pomyślnie!`);
            resetForm();
            fetchRooms(); // Refresh list
        } catch (err) {
            setError(err.message);
        }
    };

    return (
        <div className="management-container">
            <h2>{isEditing ? 'Edytuj Pokój' : 'Stwórz Nowy Pokój'}</h2>
            
            <form onSubmit={handleSubmit} className="management-form">
                {error && <div className="error-message">{error}</div>}
                {success && <div style={{ color: 'lightgreen', textAlign: 'center', margin: '1rem 0' }}>{success}</div>}
                
                <input
                    type="text"
                    placeholder="Nazwa pokoju"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    required
                />
                
                <div style={{ display: 'flex', gap: '1rem' }}>
                    <input
                        type="text"
                        placeholder="Krótki opis (zajawka)"
                        value={shortDescription}
                        onChange={(e) => setShortDescription(e.target.value)}
                        maxLength="100"
                        style={{ flex: 2 }}
                    />
                    <select
                        value={category}
                        onChange={(e) => setCategory(e.target.value)}
                        style={{ flex: 1 }}
                    >
                        <option value="Web">Web</option>
                        <option value="Crypto">Crypto</option>
                        <option value="Forensics">Forensics</option>
                        <option value="Reverse">Reverse</option>
                        <option value="OSINT">OSINT</option>
                        <option value="Network">Network</option>
                        <option value="Tutorial">Tutorial</option>
                        <option value="Misc">Misc</option>
                    </select>
                </div>

                <textarea
                    placeholder="Opis pokoju"
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    required
                    style={{ minHeight: '100px' }}
                />
                <input
                    type="text"
                    placeholder="Flaga (np. CTF{secret_code})"
                    value={flag}
                    onChange={(e) => setFlag(e.target.value)}
                    required
                    style={{ fontFamily: 'monospace' }}
                />
                <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
                    <input
                        type="number"
                        placeholder="Punkty"
                        value={points}
                        onChange={(e) => setPoints(e.target.value)}
                        required
                        min="0"
                        style={{ flex: 1 }}
                    />
                    <select
                        value={difficulty}
                        onChange={(e) => setDifficulty(e.target.value)}
                        style={{ flex: 1 }}
                    >
                        <option value="EASY">Łatwy</option>
                        <option value="MEDIUM">Średni</option>
                        <option value="HARD">Trudny</option>
                        <option value="INSANE">Niemożliwy</option>
                    </select>
                    
                    <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer', flex: 1 }}>
                        <input 
                            type="checkbox" 
                            checked={requiresVpn}
                            onChange={(e) => setRequiresVpn(e.target.checked)}
                            style={{ width: 'auto', margin: 0 }}
                        />
                        Wymaga VPN
                    </label>
                </div>

                {/* File Upload */}
                <div style={{ marginTop: '1rem' }}>
                    <label>Plik do pobrania (opcjonalnie)</label>
                    <input 
                        type="file" 
                        onChange={handleFileChange} 
                        style={{ marginTop: '0.5rem' }}
                    />
                    {isEditing && !file && (
                        <p style={{ fontSize: '0.8rem', color: '#aaa' }}>
                            Pozostaw puste, aby zachować obecny plik (jeśli istnieje).
                        </p>
                    )}
                </div>

                {/* Hint Management */}
                <div style={{ marginTop: '1rem' }}>
                    <label>Podpowiedzi</label>
                    <div style={{ display: 'flex', gap: '1rem', marginBottom: '0.5rem' }}>
                        <input
                            type="text"
                            placeholder="Dodaj podpowiedź"
                            value={currentHint}
                            onChange={(e) => setCurrentHint(e.target.value)}
                            style={{ flex: 1 }}
                        />
                        <button type="button" onClick={handleAddHint} style={{ flexShrink: 0 }}>Dodaj</button>
                    </div>
                    <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
                        {hints.map((hint, index) => (
                            <li key={index} style={{ display: 'flex', alignItems: 'center', gap: '1rem', background: '#333', padding: '5px 10px', borderRadius: '4px', marginBottom: '5px' }}>
                                <span style={{ flex: 1 }}>{hint}</span>
                                <button type="button" onClick={() => handleRemoveHint(index)} style={{ background: '#e74c3c', color: 'white', border: 'none', padding: '3px 8px', borderRadius: '4px', cursor: 'pointer' }}>
                                    Usuń
                                </button>
                            </li>
                        ))}
                    </ul>
                </div>
                
                <div style={{ display: 'flex', gap: '1rem', marginTop: '1rem' }}>
                    <button type="submit" style={{ flex: 1 }}>
                        {isEditing ? 'Zapisz Zmiany' : 'Stwórz Pokój'}
                    </button>
                    {isEditing && (
                        <button 
                            type="button" 
                            onClick={resetForm}
                            style={{ flex: 1, backgroundColor: '#666' }}
                        >
                            Anuluj
                        </button>
                    )}
                </div>
            </form>

            <h3 style={{ marginTop: '3rem', marginBottom: '1rem' }}>Lista Pokoi</h3>
            {loading ? (
                <p>Ładowanie pokoi...</p>
            ) : (
                <table className="management-table">
                    <thead>
                        <tr>
                            <th>ID</th>
                            <th>Nazwa</th>
                            <th>Kategoria</th>
                            <th>Trudność</th>
                            <th>VPN</th>
                            <th>Punkty</th>
                            <th>Akcje</th>
                        </tr>
                    </thead>
                    <tbody>
                        {rooms.map(room => (
                            <tr key={room.id}>
                                <td>{room.id}</td>
                                <td>{room.title}</td>
                                <td>{room.category || 'Web'}</td>
                                <td>
                                    <span className={`difficulty-badge ${room.difficulty.toLowerCase()}`}>
                                        {room.difficulty}
                                    </span>
                                </td>
                                <td>
                                    {room.requiresVpn ? (
                                        <span style={{ color: '#e74c3c' }}><i className="fas fa-lock"></i> Tak</span>
                                    ) : (
                                        <span style={{ color: '#2ecc71' }}>Nie</span>
                                    )}
                                </td>
                                <td>{room.points}</td>
                                <td>
                                    <button 
                                        className="btn-edit"
                                        onClick={() => handleEditClick(room)}
                                        style={{ marginRight: '0.5rem', backgroundColor: '#3498db', color: 'white', border: 'none', padding: '5px 10px', borderRadius: '4px', cursor: 'pointer' }}
                                    >
                                        Edytuj
                                    </button>
                                    {user && user.roles && user.roles.includes('ROLE_ADMIN') && (
                                        <button 
                                            className="btn-delete"
                                            onClick={() => handleDeleteClick(room.id)}
                                            style={{ backgroundColor: '#e74c3c', color: 'white', border: 'none', padding: '5px 10px', borderRadius: '4px', cursor: 'pointer' }}
                                        >
                                            Usuń
                                        </button>
                                    )}
                                </td>
                            </tr>
                        ))}
                        {rooms.length === 0 && (
                            <tr>
                                <td colSpan="7" style={{ textAlign: 'center' }}>Brak pokoi.</td>
                            </tr>
                        )}
                    </tbody>
                </table>
            )}
        </div>
    );
};

export default RoomManagement;
