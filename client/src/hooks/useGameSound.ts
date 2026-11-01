import { useCallback } from 'react';
import { useNotificationPreferences } from '../context/NotificationPreferencesContext';
import { playGameSound } from '../lib/notificationSounds';
import type { GameSoundEvent } from '../lib/notificationSounds';

export function useGameSound() {
  const { preferences, loaded } = useNotificationPreferences();
  const enabled = loaded && preferences.gameSounds;
  return useCallback((event: GameSoundEvent) => enabled && playGameSound(event), [enabled]);
}
