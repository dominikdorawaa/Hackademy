import { Navigate, useParams } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import UserProfile from '../components/profile/UserProfile';

export default function PublicProfilePage() {
  const { username } = useParams();
  const { user } = useAuth();
  if (username === user?.sub) return <Navigate to="/profile" replace />;
  return <UserProfile key={username} username={username} />;
}
