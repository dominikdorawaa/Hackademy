export const PROFILE_INTERESTS: Record<string, string> = {
  WEB: 'Bezpieczeństwo web', NETWORKS: 'Sieci', LINUX: 'Linux', WINDOWS: 'Windows',
  PENTESTING: 'Pentesting', SOC: 'Obrona i SOC', FORENSICS: 'Analiza śledcza',
  CRYPTOGRAPHY: 'Kryptografia', REVERSE_ENGINEERING: 'Reverse engineering', PROGRAMMING: 'Programowanie',
};

export interface ProfilePersonalization {
  bio: string;
  tagline: string;
  avatarSeed: string;
  interests: string[];
  featuredBadgeIds: number[];
}

export const PROFILE_UPDATED = 'hackademy:profile-updated';
