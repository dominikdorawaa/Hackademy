import { useCallback } from 'react';
import { useNotificationPreferences } from '../context/NotificationPreferencesContext';
import { playGameSound } from '../lib/notificationSounds';
import type { GameSoundEvent } from '../lib/notificationSounds';

export function useGameSound() {
  const { preferences } = useNotificationPreferences();
  const enabled = preferences.gameSounds;
  return useCallback((event: GameSoundEvent) => enabled && playGameSound(event), [enabled]);
}
