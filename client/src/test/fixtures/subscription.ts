import type { SubscriptionState } from '../../types/api';

export function createSubscription(overrides: Partial<SubscriptionState> = {}): SubscriptionState {
  return {
    active: false,
    staff: false,
    activeUntil: null,
    plan: { id: 'monthly', days: 30, coins: 1000, priceMinor: 2999, currency: 'PLN' },
    payments: 'test',
    arena: { dailyLimit: 5, playedToday: 0, remaining: 5 },
    ...overrides,
  };
}
