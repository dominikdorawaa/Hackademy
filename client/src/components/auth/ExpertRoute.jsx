import React from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';

const ExpertRoute = ({ children }) => {
    const { user, loading } = useAuth();

    if (loading) {
        return <div>Loading...</div>;
    }

    if (!user || (!user.roles.includes('ROLE_EXPERT') && !user.roles.includes('ROLE_ADMIN'))) {
        return <Navigate to="/" />;
    }

    return children;
};

export default ExpertRoute;
