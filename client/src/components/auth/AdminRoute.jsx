import React from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';

const AdminRoute = ({ children }) => {
  const { isAuthenticated, user, loading } = useAuth();

  if (loading) {
    return <div>Loading...</div>; // Or a spinner component
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }
  
  // Check if user is loaded and if their roles include 'ROLE_ADMIN'
  if (!user || !user.roles.includes('ROLE_ADMIN')) {
    // Redirect non-admin users to the dashboard or another appropriate page
    return <Navigate to="/dashboard" replace />;
  }

  return <>{children}</>;
};

export default AdminRoute;
