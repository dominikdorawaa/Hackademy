import React from 'react';
import RoomManagement from '../components/admin/RoomManagement';
import './AdminPage.css'; // Reuse Admin styles

const ExpertPage = () => {
    return (
        <div className="admin-container">
            <h1>Expert Panel</h1>
            <p style={{ color: 'var(--text-gray)', marginBottom: '20px' }}>
                Welcome, Expert. You can manage rooms here.
            </p>
            <div className="admin-content">
                <RoomManagement canDelete={false} />
            </div>
        </div>
    );
};

export default ExpertPage;
