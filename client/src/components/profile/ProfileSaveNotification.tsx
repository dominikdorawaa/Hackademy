import { useEffect } from 'react';
import { Button } from '../ui/button';
import ProfileIcon from './ProfileIcon';

export default function ProfileSaveNotification({ onClose }: { onClose: () => void }) {
  useEffect(() => {
    const timer = window.setTimeout(onClose, 5000);
    return () => window.clearTimeout(timer);
  }, [onClose]);

  return <aside className="profile-save-notification" aria-label="Powiadomienie o zapisie profilu">
    <div role="status" aria-atomic="true">
      <ProfileIcon kind="earned" size={24} />
      <span>Profil zapisany</span>
    </div>
    <Button type="button" variant="ghost" size="icon" aria-label="Zamknij powiadomienie o zapisie profilu" onClick={onClose}>
      <ProfileIcon kind="close" />
    </Button>
  </aside>;
}
