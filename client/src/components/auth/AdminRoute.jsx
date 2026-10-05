import React, { useEffect, useState } from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import API_URL from '../../apiConfig';

const AdminRoute = ({ children }) => {
  const { isAuthenticated, token, loading } = useAuth();
  const [access, setAccess] = useState({ token: null, status: 'checking' });

  useEffect(() => {
    if (!isAuthenticated || !token) return;

    const controller = new AbortController();

    fetch(`${API_URL}/api/user/me`, {
      headers: { Authorization: `Bearer ${token}` },
      signal: controller.signal,
    })
      .then((response) => {
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        return response.json();
      })
      .then((currentUser) => setAccess({ token, status: currentUser.role === 'ADMIN' ? 'allowed' : 'denied' }))
      .catch((error) => {
        if (error.name !== 'AbortError') setAccess({ token, status: 'error' });
      });

    return () => controller.abort();
  }, [isAuthenticated, token]);

  if (loading || (isAuthenticated && (access.token !== token || access.status === 'checking'))) {
    return <div>Loading...</div>;
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }
  
  if (access.status === 'error') {
    return <div>Nie udało się sprawdzić uprawnień. Odśwież stronę i spróbuj ponownie.</div>;
  }

  if (access.status !== 'allowed') {
    return <Navigate to="/dashboard" replace />;
  }

  return <>{children}</>;
};

export default AdminRoute;
