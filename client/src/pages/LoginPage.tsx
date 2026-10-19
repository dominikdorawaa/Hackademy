import { SignIn } from '@clerk/react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import AuthLayout from '../components/auth/AuthLayout';

export default function LoginPage() {
  const { isAuthenticated, loading } = useAuth();
  if (loading) return <div role="status">Wczytuję…</div>;
  if (isAuthenticated) return <Navigate to="/dashboard" replace />;
  return <AuthLayout title="hackademy-login"><SignIn routing="path" path="/login" signUpUrl="/register" forceRedirectUrl="/dashboard" /></AuthLayout>;
}
