import type { ShopCategory, ShopState } from '../types/api';

const plural = new Intl.PluralRules('pl-PL');
const number = new Intl.NumberFormat('pl-PL');

export function bytesWord(amount: number) {
  const rule = plural.select(Math.abs(amount));
  return rule === 'one' ? 'Bajt' : rule === 'few' ? 'Bajty' : 'Bajtów';
}

export function formatBytes(amount: number) {
  return `${number.format(amount)} ${bytesWord(amount)}`;
}

export function formatMoney(minor: number, currency: string) {
  return new Intl.NumberFormat('pl-PL', { style: 'currency', currency }).format(minor / 100);
}

export function isLocked(shop: ShopState | null, category: ShopCategory, reference: string) {
  const item = paidItem(category, reference, shop);
  return item !== undefined && !item.owned;
}

export function paidItem(category: ShopCategory, reference: string, shop: ShopState | null) {
  return shop?.items.find(item => item.category === category && item.reference === reference) ?? PAID_REFERENCES[category].find(item => item.reference === reference);
}

const PAID_REFERENCES: Record<ShopCategory, { reference: string; owned: false; price: number }[]> = {
  DANCE: [{ reference: 'scuba', owned: false, price: 400 }],
  OUTFIT: [],
  QUICK_CHAT: ['glhf', 'wp', 'nt', 'rip'].map(reference => ({ reference, owned: false, price: 150 })),
};
