export const PROFILE_INTERESTS: Record<string, string> = {
  WEB: 'Bezpieczeństwo web', NETWORKS: 'Sieci', LINUX: 'Linux', WINDOWS: 'Windows',
  PENTESTING: 'Pentesting', SOC: 'Obrona i SOC', FORENSICS: 'Analiza śledcza',
  CRYPTOGRAPHY: 'Kryptografia', REVERSE_ENGINEERING: 'Reverse engineering', PROGRAMMING: 'Programowanie',
};

export interface ProfilePersonalization {
  bio: string;
  tagline: string;
  interests: string[];
  featuredBadgeIds: number[];
}

export const PROFILE_UPDATED = 'hackademy:profile-updated';

export interface ProfileCompletionStep { label: string; done: boolean }

// The showcase step only counts once there is an earned badge to put in it.
export function profileCompletion({ customAvatar, profile, canFeature }: {
  customAvatar: boolean; profile: ProfilePersonalization; canFeature: boolean;
}) {
  const steps: ProfileCompletionStep[] = [
    { label: 'Awatar', done: customAvatar },
    { label: 'Opis', done: profile.bio.trim().length > 0 },
    { label: 'Zainteresowania', done: profile.interests.length > 0 },
    ...(canFeature ? [{ label: 'Gablota odznak', done: profile.featuredBadgeIds.length > 0 }] : []),
  ];
  const percent = Math.round(steps.filter(step => step.done).length / steps.length * 100);
  return { steps, percent };
}
