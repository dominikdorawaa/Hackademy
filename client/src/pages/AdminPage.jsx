import React, { useState } from 'react';
import UserManagement from '../components/admin/UserManagement';
import RoomManagement from '../components/admin/RoomManagement';
import ReportsManagement from '../components/admin/ReportsManagement';
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
                    onClick={() => setActiveTab('rooms')}
                    className={activeTab === 'rooms' ? 'active' : ''}
                >
                    Zarządzaj pokojami
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
                {activeTab === 'rooms' && <RoomManagement />}
                {activeTab === 'reports' && <ReportsManagement />}
            </div>
        </div>
    );
};

export default AdminPage;
