import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '../context/AuthContext';
import ConfirmationModal from './common/ConfirmationModal';
import AlertModal from './common/AlertModal';
import API_URL from '../apiConfig';
import './ArenaChat.css';

const ArenaChat = ({ gameId, isOpen, toggleChat }) => {
    const { token } = useAuth();
    const [messages, setMessages] = useState([]);
    const [newMessage, setNewMessage] = useState('');
    const messagesEndRef = useRef(null);
    const [userData, setUserData] = useState(null);
    const [isSending, setIsSending] = useState(false);
    
    // Modal states
    const [isReportModalOpen, setIsReportModalOpen] = useState(false);
    const [messageToReport, setMessageToReport] = useState(null);
    
    // Alert Modal State
    const [alertState, setAlertState] = useState({
        isOpen: false,
        type: 'success',
        message: '',
        subMessage: ''
    });

    // Fetch user data to identify own messages
    useEffect(() => {
        if (token) {
            fetch(`${API_URL}/api/user/me`, {
                headers: { 'Authorization': `Bearer ${token}` }
            })
            .then(res => res.json())
            .then(data => setUserData(data))
            .catch(err => console.error(err));
        }
    }, [token]);

    // Poll for messages
    useEffect(() => {
        let interval;
        if (gameId && token && isOpen) {
            const fetchMessages = async () => {
                try {
                    const response = await fetch(`${API_URL}/api/chat/${gameId}`, {
                        headers: { 'Authorization': `Bearer ${token}` }
                    });
                    if (response.ok) {
                        const data = await response.json();
                        setMessages(data);
                    }
                } catch (err) {
                    console.error("Failed to fetch messages", err);
                }
            };

            fetchMessages();
            interval = setInterval(fetchMessages, 2000);
        }
        return () => clearInterval(interval);
    }, [gameId, token, isOpen]);

    // Scroll to bottom on new messages
    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }, [messages, isOpen]);

    const formatTimeRemaining = (mutedUntil) => {
        // Ensure the date string is treated as UTC if it doesn't have timezone info
        let dateStr = mutedUntil;
        if (!dateStr.endsWith('Z') && !dateStr.includes('+')) {
            dateStr += 'Z';
        }

        const end = new Date(dateStr);
        const now = new Date();
        const diff = end - now;

        if (diff <= 0) return "Blokada wygasła (odśwież stronę).";

        const days = Math.floor(diff / (1000 * 60 * 60 * 24));
        const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
        const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
        const seconds = Math.floor((diff % (1000 * 60)) / 1000);

        if (days > 365) return "Blokada stała.";
        if (days > 0) return `${days} dni, ${hours} godz.`;
        if (hours > 0) return `${hours} godz., ${minutes} min.`;
        if (minutes > 0) return `${minutes} min., ${seconds} sek.`;
        return `${seconds} sek.`;
    };

    const handleSendMessage = async (e) => {
        e.preventDefault();
        if (!newMessage.trim() || isSending) return;

        setIsSending(true);
        try {
            const response = await fetch(`${API_URL}/api/chat/${gameId}/send`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({ content: newMessage })
            });

            if (response.ok) {
                const sentMsg = await response.json();
                setMessages(prev => [...prev, sentMsg]);
                setNewMessage('');
            } else {
                const errorData = await response.json().catch(() => ({}));
                
                if (response.status === 403 && errorData.mutedUntil) {
                    const timeRemaining = formatTimeRemaining(errorData.mutedUntil);
                    setAlertState({
                        isOpen: true,
                        type: 'danger',
                        message: 'Jesteś wyciszony!',
                        subMessage: `Nie możesz wysyłać wiadomości. Pozostały czas: ${timeRemaining}`
                    });
                } else {
                    setAlertState({
                        isOpen: true,
                        type: 'danger',
                        message: 'Błąd wysyłania',
                        subMessage: 'Nie udało się wysłać wiadomości.'
                    });
                }
            }
        } catch (err) {
            console.error("Failed to send message", err);
        } finally {
            setIsSending(false);
        }
    };

    const openReportModal = (messageId) => {
        setMessageToReport(messageId);
        setIsReportModalOpen(true);
    };

    const confirmReport = async () => {
        setIsReportModalOpen(false);
        if (!messageToReport) return;

        try {
            const response = await fetch(`${API_URL}/api/chat/message/${messageToReport}/report`, {
                method: 'POST',
                headers: { 'Authorization': `Bearer ${token}` }
            });
            
            if (response.ok) {
                setAlertState({
                    isOpen: true,
                    type: 'success',
                    message: 'Zgłoszono',
                    subMessage: 'Wiadomość została przekazana administratorowi.'
                });
            } else {
                setAlertState({
                    isOpen: true,
                    type: 'danger',
                    message: 'Błąd',
                    subMessage: 'Nie udało się zgłosić wiadomości.'
                });
            }
        } catch (err) {
            console.error("Failed to report message", err);
        } finally {
            setMessageToReport(null);
        }
    };

    return (
        <>
            <div className={`arena-chat-container ${isOpen ? 'open' : ''}`}>
                <div className="chat-toggle-btn" onClick={toggleChat}>
                    <i className={`fas ${isOpen ? 'fa-chevron-left' : 'fa-comments'}`}></i>
                    {!isOpen && <span className="chat-label">Czat</span>}
                </div>

                <div className="chat-content">
                    <div className="chat-header">
                        <h3>Czat Areny</h3>
                    </div>

                    <div className="messages-list">
                        {messages.length === 0 ? (
                            <p className="no-messages">Brak wiadomości. Przywitaj się!</p>
                        ) : (
                            messages.map(msg => {
                                const isOwn = userData && msg.senderId === userData.id;
                                return (
                                    <div key={msg.id} className={`message-item ${isOwn ? 'own' : 'opponent'}`}>
                                        <div className="message-bubble">
                                            <span className="sender-name">{msg.senderUsername}</span>
                                            <p>{msg.content}</p>
                                        </div>
                                        {!isOwn && (
                                            <button 
                                                className="report-btn" 
                                                onClick={() => openReportModal(msg.id)}
                                                title="Zgłoś wiadomość"
                                            >
                                                <i className="fas fa-exclamation-triangle"></i>
                                            </button>
                                        )}
                                    </div>
                                );
                            })
                        )}
                        <div ref={messagesEndRef} />
                    </div>

                    <form onSubmit={handleSendMessage} className="chat-input-form">
                        <input
                            type="text"
                            value={newMessage}
                            onChange={(e) => setNewMessage(e.target.value)}
                            placeholder="Napisz wiadomość..."
                            maxLength={500}
                            disabled={isSending}
                        />
                        <button type="submit" disabled={isSending} style={{ opacity: isSending ? 0.5 : 1 }}>
                            <i className="fas fa-paper-plane"></i>
                        </button>
                    </form>
                </div>
            </div>

            <ConfirmationModal 
                isOpen={isReportModalOpen}
                message="Czy na pewno chcesz zgłosić tę wiadomość do administratora? Nadużywanie tej funkcji może skutkować blokadą konta."
                onConfirm={confirmReport}
                onCancel={() => setIsReportModalOpen(false)}
                confirmText="Zgłoś"
            />
            
            <AlertModal 
                isOpen={alertState.isOpen}
                onClose={() => setAlertState({ ...alertState, isOpen: false })}
                type={alertState.type}
                message={alertState.message}
                subMessage={alertState.subMessage}
            />
        </>
    );
};

export default ArenaChat;
