import type { ShopState } from '../../types/api';

const ITEMS = [
  { id: 'dance-scuba', category: 'DANCE', reference: 'scuba', price: 400 },
  { id: 'chat-wp', category: 'QUICK_CHAT', reference: 'wp', price: 150 },
  { id: 'chat-nt', category: 'QUICK_CHAT', reference: 'nt', price: 150 },
  { id: 'chat-rip', category: 'QUICK_CHAT', reference: 'rip', price: 150 },
  { id: 'chat-glhf', category: 'QUICK_CHAT', reference: 'glhf', price: 150 },
] as const;

export const ALL_ITEMS = ITEMS.map(item => item.id);

export function createShop(owned: readonly string[] = [], balance = 0, topUps: ShopState['topUps'] = 'test'): ShopState {
  return {
    balance,
    topUps,
    items: ITEMS.map(item => ({ ...item, owned: owned.includes(item.id) })),
    packages: [
      { id: 'small', coins: 500, priceMinor: 999, currency: 'PLN' },
      { id: 'medium', coins: 1200, priceMinor: 1999, currency: 'PLN' },
      { id: 'large', coins: 3000, priceMinor: 4499, currency: 'PLN' },
    ],
  };
}
