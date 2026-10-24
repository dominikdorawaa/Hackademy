import { CLOTH_RAMPS, HAIR_RAMPS, SKIN_RAMPS } from './avatarModel';
import type { Avatar, FinisherMove, Ramp, VictoryDance } from './avatarModel';

export const OUTFITS: { id: Avatar['outfit']; name: string; description: string }[] = [
  { id: 'baza', name: 'Klasyczna', description: 'Koszulka i proste spodnie.' },
  { id: 'bluza', name: 'Bluza', description: 'Bluza z opuszczonym kapturem, jeansy i trampki.' },
  { id: 'dres', name: 'Dres', description: 'Kurtka dresowa z paskami i spodnie z lampasem.' },
];
const SKIN_PRESETS = ['porcelanowa', 'jasna', 'oliwkowa', 'brazowa', 'ciemna', 'heban'];
const HAIR_PRESETS = ['czarne', 'brazowe', 'blond', 'rude', 'siwe', 'niebieskie'];
const CLOTH_PRESETS = ['bialy', 'grafitowy', 'granatowy', 'czerwony', 'bordowy', 'oliwkowy', 'piaskowy'];

export const COLOR_GROUPS: { key: keyof Avatar['colors']; legend: string; options: Record<string, Ramp>; presets: string[] }[] = [
  { key: 'skin', legend: 'Skóra', options: SKIN_RAMPS, presets: SKIN_PRESETS },
  { key: 'hair', legend: 'Włosy', options: HAIR_RAMPS, presets: HAIR_PRESETS },
  { key: 'top', legend: 'Góra', options: CLOTH_RAMPS, presets: CLOTH_PRESETS },
  { key: 'bottom', legend: 'Dół', options: CLOTH_RAMPS, presets: CLOTH_PRESETS },
  { key: 'shoes', legend: 'Buty', options: CLOTH_RAMPS, presets: CLOTH_PRESETS },
  { key: 'hat', legend: 'Kolor czapki', options: CLOTH_RAMPS, presets: CLOTH_PRESETS },
];

export const colorName = (value: string) => COLOR_NAMES[value] ?? `Własny ${value.toUpperCase()}`;
export const HAIR_NAMES: Record<Avatar['hair'], string> = { brak: 'Bez włosów', krotkie: 'Krótkie', irokez: 'Irokez', kucyk: 'Kucyk' };
export const HAT_NAMES: Record<Avatar['hat'], string> = { brak: 'Bez czapki', czapka: 'Czapka zimowa', daszek: 'Daszek' };
export const COLOR_NAMES: Record<string, string> = {
  porcelanowa: 'Porcelanowa', jasna: 'Jasna', oliwkowa: 'Oliwkowa', brazowa: 'Brązowa', ciemna: 'Ciemna', heban: 'Hebanowa',
  czarne: 'Czarne', brazowe: 'Brązowe', rude: 'Rude', blond: 'Blond', siwe: 'Siwe', niebieskie: 'Niebieskie',
  granatowy: 'Granatowy', grafitowy: 'Grafitowy', bordowy: 'Bordowy', turkusowy: 'Turkusowy', piaskowy: 'Piaskowy', oliwkowy: 'Oliwkowy', czerwony: 'Czerwony', bialy: 'Biały',
};
export const LIGHT_COLORS = ['bialy', 'blond', 'siwe', 'jasna', 'porcelanowa', 'piaskowy'];
export const FINISHER_OPTIONS: Record<FinisherMove, { name: string; description: string }> = {
  beam: { name: 'Przeciążenie', description: 'Kumuluje energię i powala rywala jednym wyładowaniem.' },
  combo: { name: 'Ctrl+Alt+Del', description: 'Szybka seria trzech ciosów zakończona nokautem.' },
};
export const DANCE_OPTIONS: Record<VictoryDance, { name: string; description: string }> = {
  groove: { name: 'Luz', description: 'Swobodny taniec bokiem do rywala.' },
  sixseven: { name: 'Six-seven', description: 'Obrót do widowni i ręce ważące: sześć, siedem.' },
  scuba: { name: 'Scuba', description: 'Obrót do widowni, zatkany nos i fala ręką.' },
};
export const POSE_NAMES: Record<Avatar['pose'], string> = { przod: 'Przód', postawa: 'Postawa', profil: 'Profil' };
