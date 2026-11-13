import type { ShopState } from '../../types/api';

const ITEMS = [
  { id: 'dance-scuba', category: 'DANCE', reference: 'scuba', price: 400 },
  { id: 'chat-rematch', category: 'QUICK_CHAT', reference: 'rematch', price: 150 },
  { id: 'chat-close', category: 'QUICK_CHAT', reference: 'close', price: 150 },
  { id: 'chat-root', category: 'QUICK_CHAT', reference: 'root', price: 150 },
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
