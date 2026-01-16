import React from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';

const ProtectedRoute = ({ children }) => {
  const { isAuthenticated, loading } = useAuth();

  if (loading) {
    // While checking authentication status, show a loading indicator or return null
    return <div>Loading...</div>; // Or a spinner component
  }

  if (!isAuthenticated) {
    // If not authenticated after loading, redirect to the login page
    return <Navigate to="/login" replace />;
  }

  // If authenticated, render the children components
  return <>{children}</>;
};

export default ProtectedRoute;
