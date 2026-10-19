import { SignUp } from '@clerk/react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import AuthLayout from '../components/auth/AuthLayout';

export default function RegisterPage() {
  const { isAuthenticated, loading } = useAuth();
  if (loading) return <div role="status">Wczytuję…</div>;
  if (isAuthenticated) return <Navigate to="/dashboard" replace />;
  return <AuthLayout heading={['Zdobywaj flagi.', 'Ucz się.', 'Rywalizuj.']} lead="Ćwicz cyberbezpieczeństwo na praktycznych zadaniach CTF, po polsku."><SignUp routing="path" path="/register" signInUrl="/login" forceRedirectUrl="/dashboard" /></AuthLayout>;
}
