import { Link } from 'react-router-dom';
import { Check } from 'lucide-react';
import { useSubscription } from '../../hooks/useSubscription';
import { PremiumCrown } from '../PremiumCrown';
import { formatBytes, formatMoney } from '../../lib/bytes';
import { formatUntil } from '../../lib/premium';
import './PremiumBanner.css';

export function PremiumBanner() {
  const { subscription } = useSubscription();
  if (!subscription || subscription.staff) return null;
  const { plan } = subscription;
  const active = subscription.active && subscription.activeUntil;
  return <section className="premium-banner" aria-labelledby="premium-banner-title" data-active={active ? 'true' : undefined}>
    <PremiumCrown className="premium-banner-crown" />
    <div className="premium-banner-copy">
      <p className="premium-banner-kicker">{active ? `Masz Premium do ${formatUntil(subscription.activeUntil!)}` : 'Subskrypcja'}</p>
      <h2 id="premium-banner-title">Hackademy Premium</h2>
      <ul className="premium-banner-perks">
        <li><Check aria-hidden="true" />Wszystkie rozdziały ścieżek</li>
        <li><Check aria-hidden="true" />Arena bez dziennego limitu</li>
        <li><Check aria-hidden="true" />{formatBytes(plan.coins)} przy każdym zakupie</li>
      </ul>
    </div>
    <div className="premium-banner-buy">
      <p className="premium-banner-price">{formatMoney(plan.priceMinor, plan.currency)}<span>za {plan.days} dni</span></p>
      <Link className="premium-banner-cta" to="/premium">{active ? 'Przedłuż Premium' : 'Kup Premium'}</Link>
    </div>
  </section>;
}
