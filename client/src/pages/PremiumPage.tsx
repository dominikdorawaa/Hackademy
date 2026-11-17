import { useId, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, Check, Crown } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useShop } from '../context/ShopContext';
import { useSubscription } from '../hooks/useSubscription';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { cancelSubscriptionOrder, orderSubscription, payTestSubscription } from '../services/subscriptionApi';
import { errorMessage } from '../services/shopApi';
import { toast } from '../components/common/toast';
import { formatBytes, formatMoney } from '../lib/bytes';
import { formatUntil } from '../lib/premium';
import type { SubscriptionOrder, SubscriptionState } from '../types/api';
import '../components/room/room.css';
import './ShopPage.css';
import './PremiumPage.css';


function StatusLine({ subscription }: { subscription: SubscriptionState }) {
  if (subscription.staff) return <p className="premium-status is-active"><Crown aria-hidden="true" />Jako członek zespołu masz pełny dostęp bez subskrypcji.</p>;
  if (subscription.active && subscription.activeUntil) {
    return <p className="premium-status is-active"><Crown aria-hidden="true" />Premium aktywne do {formatUntil(subscription.activeUntil)}.</p>;
  }
  return null;
}

export default function PremiumPage() {
  const { sessionKey, refreshUser } = useAuth();
  const { refresh: refreshShop } = useShop();
  const { subscription, status, refresh, replace } = useSubscription();
  const [order, setOrder] = useState<SubscriptionOrder | null>(null);
  const [busy, setBusy] = useState(false);
  const id = useId();
  const auth = { sessionKey };

  const run = async (work: () => Promise<void>) => {
    setBusy(true);
    try { await work(); }
    catch { toast.error('Nie udało się połączyć z serwerem.'); }
    finally { setBusy(false); }
  };

  const start = () => run(async () => {
    if (!subscription) return;
    const response = await orderSubscription(subscription.plan.id, auth);
    if (!response.ok) { toast.error(await errorMessage(response, 'Nie udało się rozpocząć zakupu.')); return; }
    const created = await response.json();
    if (created.redirectUrl) window.location.assign(created.redirectUrl);
    else setOrder(created);
  });

  const payTest = () => run(async () => {
    if (!order) return;
    const response = await payTestSubscription(order.id, auth);
    if (!response.ok) {
      toast.error(await errorMessage(response, 'Płatność się nie udała. Spróbuj ponownie albo anuluj zamówienie.'));
      if (response.status === 409 || response.status === 404) { setOrder(null); refresh(); }
      return;
    }
    setOrder(null);
    replace(await response.json());
    refreshShop();
    void refreshUser();
    toast.success(`Premium aktywne. Na Twoje konto trafiło ${formatBytes(order.coins)}.`);
  });

  const cancel = () => run(async () => {
    if (!order) return;
    const pending = order;
    setOrder(null);
    const response = await cancelSubscriptionOrder(pending.id, auth);
    if (!response.ok) toast.error(await errorMessage(response, 'Nie udało się anulować zamówienia.'));
  });

  const plan = subscription?.plan;
  const limit = subscription?.arena.dailyLimit ?? 5;

  return <div className="room-tokens shop-page premium-page">
    <section className="shop-hero is-compact" aria-labelledby={`${id}-title`}>
      <div className="shop-hero-inner">
        <div>
          <Link className="shop-back" to="/shop"><ArrowLeft size={16} aria-hidden="true" />Wróć do Sklepu</Link>
          <h1 id={`${id}-title`}>Premium</h1>
          <p>Wszystkie rozdziały ścieżek, Arena bez limitu i Bajty do Sklepu przy każdym zakupie.</p>
        </div>
      </div>
    </section>

    <div className="shop-shell">
      {status === 'error' && !subscription && <p className="shop-message is-error" role="alert">
        Nie udało się wczytać subskrypcji. <button type="button" className="shop-link" onClick={refresh}>Spróbuj ponownie</button>
      </p>}
      {!subscription ? status !== 'error' && <p className="shop-empty">Wczytuję subskrypcję…</p> : <>
        <StatusLine subscription={subscription} />
        {subscription.payments === 'off' && <p className="shop-note">Płatności uruchomimy wkrótce.</p>}
        {subscription.payments === 'test' && <p className="shop-note">Tryb testowy: żadne pieniądze nie zostaną pobrane.</p>}
        <ul className="premium-plans" aria-label="Porównanie planów">
          <li className="premium-plan">
            <h2>Darmowy</h2>
            <p className="premium-price">0 zł</p>
            <ul className="premium-perks">
              <li><Check aria-hidden="true" />Pierwszy rozdział każdej ścieżki</li>
              <li><Check aria-hidden="true" />{limit} walk na Arenie dziennie</li>
            </ul>
          </li>
          {plan && <li className="premium-plan is-featured">
            <h2><Crown aria-hidden="true" />Premium</h2>
            <p className="premium-price">{formatMoney(plan.priceMinor, plan.currency)} <span>za {plan.days} dni</span></p>
            <ul className="premium-perks">
              <li><Check aria-hidden="true" />Wszystkie rozdziały każdej ścieżki</li>
              <li><Check aria-hidden="true" />Arena bez dziennego limitu</li>
              <li><Check aria-hidden="true" />{formatBytes(plan.coins)} do Sklepu przy każdym zakupie</li>
            </ul>
            {!subscription.staff && <button type="button" className="shop-button is-primary" disabled={busy || subscription.payments === 'off'} onClick={() => void start()}>
              {subscription.active ? `Przedłuż o ${plan.days} dni` : 'Kup Premium'}
            </button>}
          </li>}
        </ul>
      </>}
    </div>

    <AlertDialog open={order !== null}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Płatność testowa</AlertDialogTitle>
          <AlertDialogDescription>
            {order ? `Premium na ${order.days} dni za ${formatMoney(order.priceMinor, order.currency)}, razem z ${formatBytes(order.coins)}. To tylko test, prawdziwe płatności podłączymy później.` : ''}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={busy} onClick={() => void cancel()}>Anuluj zamówienie</AlertDialogCancel>
          <AlertDialogAction disabled={busy} onClick={() => void payTest()}>Zapłać testowo</AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  </div>;
}
