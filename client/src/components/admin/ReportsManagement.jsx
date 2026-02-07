import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import API_URL from '../../apiConfig';

const ReportsManagement = () => {
    const { token } = useAuth();
    const [reports, setReports] = useState([]);
    const [loading, setLoading] = useState(true);
    
    // Mute Modal State
    const [muteModalOpen, setMuteModalOpen] = useState(false);
    const [selectedUserId, setSelectedUserId] = useState(null);
    const [selectedReportId, setSelectedReportId] = useState(null); // Track which report triggered the mute
    const [muteDuration, setMuteDuration] = useState(3600); // Default 1 hour

    useEffect(() => {
        fetchReports();
    }, [token]);

    const fetchReports = async () => {
        try {
            const response = await fetch(`${API_URL}/api/admin/reports`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            if (response.ok) {
                const data = await response.json();
                setReports(data);
            }
        } catch (err) {
            console.error("Failed to fetch reports", err);
        } finally {
            setLoading(false);
        }
    };

    const handleDeleteMessage = async (messageId) => {
        if (!window.confirm("Czy na pewno usunąć tę wiadomość?")) return;
        try {
            await fetch(`${API_URL}/api/admin/reports/${messageId}`, {
                method: 'DELETE',
                headers: { 'Authorization': `Bearer ${token}` }
            });
            setReports(reports.filter(r => r.id !== messageId));
        } catch (err) {
            console.error("Error deleting message", err);
        }
    };

    const handleDismissReport = async (messageId) => {
        try {
            await fetch(`${API_URL}/api/admin/reports/${messageId}/dismiss`, {
                method: 'POST',
                headers: { 'Authorization': `Bearer ${token}` }
            });
            setReports(reports.filter(r => r.id !== messageId));
        } catch (err) {
            console.error("Error dismissing report", err);
        }
    };

    const openMuteModal = (userId, reportId) => {
        setSelectedUserId(userId);
        setSelectedReportId(reportId);
        setMuteModalOpen(true);
    };

    const handleMuteUser = async () => {
        try {
            await fetch(`${API_URL}/api/admin/users/${selectedUserId}/mute`, {
                method: 'POST',
                headers: { 
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}` 
                },
                body: JSON.stringify({ duration: muteDuration })
            });
            
            alert("Użytkownik został wyciszony.");
            
            // Remove the report from the list after muting
            if (selectedReportId) {
                setReports(reports.filter(r => r.id !== selectedReportId));
            }
            
            setMuteModalOpen(false);
        } catch (err) {
            console.error("Error muting user", err);
            alert("Błąd podczas wyciszania użytkownika.");
        }
    };

    if (loading) return <p>Ładowanie zgłoszeń...</p>;

    return (
        <div>
            <h2>Zgłoszone Wiadomości</h2>
            {reports.length === 0 ? (
                <p>Brak zgłoszeń.</p>
            ) : (
                <table className="admin-table" style={{ width: '100%', borderCollapse: 'collapse' }}>
                    <thead>
                        <tr>
                            <th style={{ textAlign: 'left', padding: '12px' }}>ID</th>
                            <th style={{ textAlign: 'left', padding: '12px' }}>Nadawca</th>
                            <th style={{ textAlign: 'left', padding: '12px', width: '40%' }}>Treść</th>
                            <th style={{ textAlign: 'left', padding: '12px' }}>Data</th>
                            <th style={{ textAlign: 'left', padding: '12px' }}>Akcje</th>
                        </tr>
                    </thead>
                    <tbody>
                        {reports.map(report => (
                            <tr key={report.id} style={{ borderBottom: '1px solid #333' }}>
                                <td style={{ padding: '12px' }}>{report.id}</td>
                                <td style={{ padding: '12px', fontWeight: 'bold', color: '#ddd' }}>{report.senderUsername}</td>
                                <td style={{ 
                                    padding: '12px', 
                                    maxWidth: '400px', 
                                    wordWrap: 'break-word', 
                                    lineHeight: '1.6',
                                    backgroundColor: 'rgba(255,255,255,0.05)',
                                    borderRadius: '4px'
                                }}>
                                    {report.content}
                                </td>
                                <td style={{ padding: '12px', color: '#aaa', fontSize: '0.9rem' }}>
                                    {new Date(report.timestamp).toLocaleString()}
                                </td>
                                <td style={{ padding: '12px' }}>
                                    <div style={{ display: 'flex', gap: '5px', flexWrap: 'wrap' }}>
                                        <button 
                                            onClick={() => handleDeleteMessage(report.id)} 
                                            className="btn btn-danger btn-sm"
                                        >
                                            Usuń
                                        </button>
                                        <button 
                                            onClick={() => openMuteModal(report.senderId, report.id)} 
                                            className="btn btn-warning btn-sm"
                                            style={{ backgroundColor: '#ff9800', borderColor: '#ff9800', color: 'black' }}
                                        >
                                            Wycisz
                                        </button>
                                        <button 
                                            onClick={() => handleDismissReport(report.id)} 
                                            className="btn btn-secondary btn-sm"
                                        >
                                            Odrzuć
                                        </button>
                                    </div>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            )}

            {muteModalOpen && (
                <div className="modal-overlay">
                    <div className="modal-content" style={{ backgroundColor: '#1e1e1e', padding: '30px', borderRadius: '12px', border: '1px solid #333', maxWidth: '500px', width: '90%' }}>
                        <h3 style={{ marginTop: 0 }}>Wycisz Użytkownika</h3>
                        <p style={{ color: '#ccc', marginBottom: '20px' }}>Wybierz czas trwania blokady czatu dla tego użytkownika. Zgłoszenie zostanie automatycznie usunięte z listy.</p>
                        
                        <label style={{ display: 'block', marginBottom: '10px', fontWeight: 'bold' }}>Czas trwania:</label>
                        <select 
                            value={muteDuration} 
                            onChange={(e) => setMuteDuration(Number(e.target.value))}
                            style={{ 
                                width: '100%', 
                                padding: '12px', 
                                marginBottom: '30px', 
                                backgroundColor: '#2d2d2d', 
                                color: 'white', 
                                border: '1px solid #555', 
                                borderRadius: '6px',
                                fontSize: '1rem'
                            }}
                        >
                            <option value={3600}>1 godzina</option>
                            <option value={10800}>3 godziny</option>
                            <option value={43200}>12 godzin</option>
                            <option value={86400}>24 godziny</option>
                            <option value={259200}>3 dni</option>
                            <option value={604800}>7 dni</option>
                            <option value={2592000}>1 miesiąc</option>
                            <option value={7776000}>3 miesiące</option>
                            <option value={15552000}>6 miesięcy</option>
                            <option value={31536000}>1 rok</option>
                            <option value={-1}>Na stałe</option>
                        </select>
                        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '15px' }}>
                            <button onClick={() => setMuteModalOpen(false)} className="btn btn-outline">Anuluj</button>
                            <button onClick={handleMuteUser} className="btn btn-primary">Zatwierdź</button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default ReportsManagement;
