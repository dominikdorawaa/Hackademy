import type { PropsWithChildren } from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';

const ProtectedRoute = ({ children }: PropsWithChildren) => {
  const { isAuthenticated, loading } = useAuth();

  if (loading) {

    return <div>Loading...</div>;
  }

  if (!isAuthenticated) {

    return <Navigate to="/login" replace />;
  }

  return <>{children}</>;
};

export default ProtectedRoute;
