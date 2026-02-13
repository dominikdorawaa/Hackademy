import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import AlertModal from '../common/AlertModal';
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

    // Alert Modal State
    const [alertState, setAlertState] = useState({
        isOpen: false,
        type: 'success',
        message: '',
        subMessage: ''
    });

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
            
            setAlertState({
                isOpen: true,
                type: 'success',
                message: 'Sukces',
                subMessage: 'Użytkownik został wyciszony.'
            });
            
            // Remove the report from the list after muting
            if (selectedReportId) {
                setReports(reports.filter(r => r.id !== selectedReportId));
            }
            
            setMuteModalOpen(false);
        } catch (err) {
            console.error("Error muting user", err);
            setAlertState({
                isOpen: true,
                type: 'danger',
                message: 'Błąd',
                subMessage: 'Nie udało się wyciszyć użytkownika.'
            });
        }
    };

    if (loading) return <p style={{ color: 'var(--text-light)' }}>Ładowanie zgłoszeń...</p>;

    return (
        <div>
            <h2 style={{ color: 'var(--text-light)' }}>Zgłoszone Wiadomości</h2>
            {reports.length === 0 ? (
                <p style={{ color: 'var(--text-gray)' }}>Brak zgłoszeń.</p>
            ) : (
                <table className="management-table" style={{ width: '100%', borderCollapse: 'collapse' }}>
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
                            <tr key={report.id} style={{ borderBottom: '1px solid var(--border-color)' }}>
                                <td style={{ padding: '12px' }}>{report.id}</td>
                                <td style={{ padding: '12px', fontWeight: 'bold', color: 'var(--text-light)' }}>{report.senderUsername}</td>
                                <td style={{ 
                                    padding: '12px', 
                                    maxWidth: '400px', 
                                    wordWrap: 'break-word', 
                                    lineHeight: '1.6',
                                    backgroundColor: 'var(--bg-panel-lighter)',
                                    borderRadius: '4px',
                                    color: 'var(--text-light)'
                                }}>
                                    {report.content}
                                </td>
                                <td style={{ padding: '12px', color: 'var(--text-gray)', fontSize: '0.9rem' }}>
                                    {new Date(report.timestamp).toLocaleString()}
                                </td>
                                <td style={{ padding: '12px' }}>
                                    <div style={{ display: 'flex', gap: '5px', flexWrap: 'wrap' }}>
                                        <button 
                                            onClick={() => handleDeleteMessage(report.id)} 
                                            className="btn btn-danger btn-sm"
                                            style={{ backgroundColor: '#e53935', color: 'white', border: 'none', padding: '5px 10px', borderRadius: '4px', cursor: 'pointer' }}
                                        >
                                            Usuń
                                        </button>
                                        <button 
                                            onClick={() => openMuteModal(report.senderId, report.id)} 
                                            className="btn btn-warning btn-sm"
                                            style={{ backgroundColor: '#ff9800', borderColor: '#ff9800', color: 'black', border: 'none', padding: '5px 10px', borderRadius: '4px', cursor: 'pointer' }}
                                        >
                                            Wycisz
                                        </button>
                                        <button 
                                            onClick={() => handleDismissReport(report.id)} 
                                            className="btn btn-secondary btn-sm"
                                            style={{ backgroundColor: '#666', color: 'white', border: 'none', padding: '5px 10px', borderRadius: '4px', cursor: 'pointer' }}
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
                    <div className="modal-content" style={{ backgroundColor: 'var(--bg-panel)', padding: '30px', borderRadius: '12px', border: '1px solid var(--border-color)', maxWidth: '500px', width: '90%' }}>
                        <h3 style={{ marginTop: 0, color: 'var(--text-light)' }}>Wycisz Użytkownika</h3>
                        <p style={{ color: 'var(--text-gray)', marginBottom: '20px' }}>Wybierz czas trwania blokady czatu dla tego użytkownika. Zgłoszenie zostanie automatycznie usunięte z listy.</p>
                        
                        <label style={{ display: 'block', marginBottom: '10px', fontWeight: 'bold', color: 'var(--text-light)' }}>Czas trwania:</label>
                        <select 
                            value={muteDuration} 
                            onChange={(e) => setMuteDuration(Number(e.target.value))}
                            style={{ 
                                width: '100%', 
                                padding: '12px', 
                                marginBottom: '30px', 
                                backgroundColor: 'var(--input-bg)', 
                                color: 'var(--text-light)', 
                                border: '1px solid var(--input-border)',
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

            <AlertModal 
                isOpen={alertState.isOpen}
                onClose={() => setAlertState({ ...alertState, isOpen: false })}
                type={alertState.type}
                message={alertState.message}
                subMessage={alertState.subMessage}
            />
        </div>
    );
};

export default ReportsManagement;
