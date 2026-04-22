import React, { useState } from 'react';
import UserManagement from '../components/admin/UserManagement';
import RoomManagement from '../components/admin/RoomManagement';
import ReportsManagement from '../components/admin/ReportsManagement';
import PathManagement from '../components/admin/PathManagement';
import './AdminPage.css';

const AdminPage = () => {
    const [activeTab, setActiveTab] = useState('users');

    return (
        <div className="admin-container">
            <h1>Admin Panel</h1>
            <div className="admin-tabs">
                <button 
                    onClick={() => setActiveTab('users')}
                    className={activeTab === 'users' ? 'active' : ''}
                >
                    Zarządzaj użytkownikami
                </button>
                <button 
                    onClick={() => setActiveTab('rooms_ctf')}
                    className={activeTab === 'rooms_ctf' ? 'active' : ''}
                >
                    Zarządzaj pokojami CTF
                </button>
                <button 
                    onClick={() => setActiveTab('rooms_paths')}
                    className={activeTab === 'rooms_paths' ? 'active' : ''}
                >
                    Zarządzaj pokojami ścieżek
                </button>
                <button 
                    onClick={() => setActiveTab('paths')}
                    className={activeTab === 'paths' ? 'active' : ''}
                >
                    Ścieżki
                </button>
                <button 
                    onClick={() => setActiveTab('reports')}
                    className={activeTab === 'reports' ? 'active' : ''}
                >
                    Zgłoszenia
                </button>
            </div>
            <div className="admin-content">
                {activeTab === 'users' && <UserManagement />}
                {activeTab === 'rooms_ctf' && <RoomManagement forcedRoomType="CTF" />}
                {activeTab === 'rooms_paths' && <RoomManagement forcedRoomType="PATH" />}
                {activeTab === 'reports' && <ReportsManagement />}
                {activeTab === 'paths' && <PathManagement />}
            </div>
        </div>
    );
};

export default AdminPage;
