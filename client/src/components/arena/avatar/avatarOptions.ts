import { CLOTH_RAMPS, HAIR_RAMPS, SKIN_RAMPS } from './avatarModel';
import type { Avatar, Ramp } from './avatarModel';

export const OUTFITS: { id: Avatar['outfit']; name: string; description: string }[] = [
  { id: 'baza', name: 'Klasyczna', description: 'Koszulka i proste spodnie.' },
  { id: 'bluza', name: 'Bluza', description: 'Bluza z opuszczonym kapturem, jeansy i trampki.' },
  { id: 'dres', name: 'Dres', description: 'Kurtka dresowa z paskami i spodnie z lampasem.' },
];
export const COLOR_GROUPS: { key: keyof Avatar['colors']; legend: string; options: Record<string, Ramp> }[] = [
  { key: 'skin', legend: 'Skóra', options: SKIN_RAMPS },
  { key: 'hair', legend: 'Włosy', options: HAIR_RAMPS },
  { key: 'top', legend: 'Góra', options: CLOTH_RAMPS },
  { key: 'bottom', legend: 'Dół', options: CLOTH_RAMPS },
  { key: 'shoes', legend: 'Buty', options: CLOTH_RAMPS },
  { key: 'hat', legend: 'Kolor czapki', options: CLOTH_RAMPS },
];
export const HAIR_NAMES: Record<Avatar['hair'], string> = { brak: 'Bez włosów', krotkie: 'Krótkie', irokez: 'Irokez', kucyk: 'Kucyk' };
export const HAT_NAMES: Record<Avatar['hat'], string> = { brak: 'Bez czapki', czapka: 'Czapka zimowa', daszek: 'Daszek' };
export const COLOR_NAMES: Record<string, string> = {
  porcelanowa: 'Porcelanowa', jasna: 'Jasna', oliwkowa: 'Oliwkowa', brazowa: 'Brązowa', ciemna: 'Ciemna', heban: 'Hebanowa',
  czarne: 'Czarne', brazowe: 'Brązowe', rude: 'Rude', blond: 'Blond', siwe: 'Siwe', niebieskie: 'Niebieskie',
  granatowy: 'Granatowy', grafitowy: 'Grafitowy', bordowy: 'Bordowy', turkusowy: 'Turkusowy', piaskowy: 'Piaskowy', oliwkowy: 'Oliwkowy', czerwony: 'Czerwony', bialy: 'Biały',
};
export const LIGHT_COLORS = ['bialy', 'blond', 'siwe', 'jasna', 'porcelanowa', 'piaskowy'];
export const POSE_NAMES: Record<Avatar['pose'], string> = { przod: 'Przód', postawa: 'Postawa', profil: 'Profil' };
