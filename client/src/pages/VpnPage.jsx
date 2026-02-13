import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import API_URL from '../apiConfig';

const VpnPage = () => {
    const { token, user } = useAuth();
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);
    const [status, setStatus] = useState(null);
    const [checkingStatus, setCheckingStatus] = useState(true);

    useEffect(() => {
        const checkStatus = async () => {
            try {
                const response = await fetch(`${API_URL}/api/vpn/status`, {
                    headers: { 'Authorization': `Bearer ${token}` }
                });
                if (response.ok) {
                    const data = await response.json();
                    setStatus(data);
                }
            } catch (err) {
                console.error("Failed to check VPN status", err);
            } finally {
                setCheckingStatus(false);
            }
        };
        checkStatus();
    }, [token]);

    const handleDownload = async () => {
        setLoading(true);
        setError(null);
        try {
            const response = await fetch(`${API_URL}/api/vpn/download`, {
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            });

            if (response.ok) {
                const blob = await response.blob();
                const url = window.URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = `${user?.username || 'hackademy'}.ovpn`;
                document.body.appendChild(a);
                a.click();
                a.remove();
                window.URL.revokeObjectURL(url);
            } else if (response.status === 403) {
                const msg = await response.text();
                setError(msg);
            } else {
                setError("Nie udało się wygenerować pliku. Spróbuj ponownie później.");
            }
        } catch (err) {
            setError("Błąd sieci.");
        } finally {
            setLoading(false);
        }
    };

    if (checkingStatus) {
        return <div className="container" style={{ paddingTop: '40px', textAlign: 'center' }}>Sprawdzanie uprawnień...</div>;
    }

    return (
        <div className="container" style={{ paddingTop: '40px', paddingBottom: '40px', maxWidth: '800px' }}>
            <h1 style={{ fontSize: '2.5rem', marginBottom: '20px', textAlign: 'center', color: 'var(--text-light)' }}>Dostęp VPN</h1>
            
            <div style={{ backgroundColor: 'var(--bg-panel)', padding: '30px', borderRadius: '12px', border: '1px solid var(--border-color)' }}>
                <h2 style={{ marginTop: 0, color: 'var(--primary-blue)' }}>Jak to działa?</h2>
                <p style={{ lineHeight: '1.6', color: 'var(--text-gray)' }}>
                    Aby rozwiązywać zadania CTF, musisz połączyć się z naszą prywatną siecią VPN.
                    Dzięki temu uzyskasz dostęp do maszyn wirtualnych z zadaniami, które są niedostępne z publicznego internetu.
                </p>

                <h3 style={{ marginTop: '30px', marginBottom: '15px', color: 'var(--text-light)' }}>Wymagania:</h3>
                <div style={{ backgroundColor: 'var(--bg-panel-lighter)', padding: '15px', borderRadius: '8px', marginBottom: '20px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '10px' }}>
                        <i className={`fas ${status?.levelRequirementMet ? 'fa-check-circle' : 'fa-times-circle'}`} style={{ color: status?.levelRequirementMet ? '#2ecc71' : '#e74c3c' }}></i>
                        <span style={{ color: status?.levelRequirementMet ? '#2ecc71' : '#e74c3c' }}>
                            Poziom 10 (Twój poziom: {status?.currentLevel})
                        </span>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <i className={`fas ${status?.tutorialRequirementMet ? 'fa-check-circle' : 'fa-times-circle'}`} style={{ color: status?.tutorialRequirementMet ? '#2ecc71' : '#e74c3c' }}></i>
                        <span style={{ color: status?.tutorialRequirementMet ? '#2ecc71' : '#e74c3c' }}>
                            Ukończony pokój "Tutorial VM"
                        </span>
                    </div>
                </div>

                <h3 style={{ marginTop: '30px', marginBottom: '15px', color: 'var(--text-light)' }}>Instrukcja:</h3>
                <ol style={{ lineHeight: '1.8', color: 'var(--text-gray)', paddingLeft: '20px' }}>
                    <li>Pobierz i zainstaluj klienta <strong>OpenVPN</strong> (Windows/Mac/Linux).</li>
                    <li>Kliknij przycisk poniżej, aby wygenerować swój unikalny plik konfiguracyjny.</li>
                    <li>Zaimportuj pobrany plik <code>.ovpn</code> do klienta OpenVPN.</li>
                    <li>Połącz się i zacznij hakować!</li>
                </ol>

                <div style={{ marginTop: '40px', textAlign: 'center' }}>
                    {error && <p style={{ color: '#e74c3c', marginBottom: '15px' }}>{error}</p>}
                    
                    {status?.canDownload ? (
                        <button 
                            onClick={handleDownload} 
                            disabled={loading}
                            className="btn btn-primary"
                            style={{ 
                                padding: '15px 40px', 
                                fontSize: '1.2rem', 
                                display: 'inline-flex', 
                                alignItems: 'center', 
                                gap: '10px' 
                            }}
                        >
                            {loading ? (
                                <>
                                    <i className="fas fa-spinner fa-spin"></i> Generowanie...
                                </>
                            ) : (
                                <>
                                    <i className="fas fa-download"></i> Pobierz Konfigurację VPN
                                </>
                            )}
                        </button>
                    ) : (
                        <button 
                            disabled
                            className="btn"
                            style={{ 
                                padding: '15px 40px', 
                                fontSize: '1.2rem', 
                                display: 'inline-flex', 
                                alignItems: 'center', 
                                gap: '10px',
                                backgroundColor: '#555',
                                color: '#aaa',
                                cursor: 'not-allowed',
                                border: '1px solid #444'
                            }}
                        >
                            <i className="fas fa-lock"></i> Zablokowane
                        </button>
                    )}
                    
                    <p style={{ marginTop: '10px', fontSize: '0.9rem', color: 'var(--text-gray)' }}>
                        {status?.canDownload ? 'Generowanie może potrwać kilka sekund.' : 'Spełnij wymagania, aby odblokować.'}
                    </p>
                </div>
            </div>
        </div>
    );
};

export default VpnPage;
