import { useId, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useShop } from '../context/ShopContext';
import { BytesAmount } from '../components/shop/BytesAmount';
import { BalanceCard } from '../components/shop/BalanceCard';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { cancelTopUp, errorMessage, payTestTopUp, startTopUp } from '../services/shopApi';
import { formatBytes, formatMoney } from '../lib/bytes';
import type { CoinPackage, TopUpOrder } from '../types/api';
import '../components/room/room.css';
import './ShopPage.css';

function PackCard({ pack, mode, busy, onStart }: { pack: CoinPackage; mode: string; busy: boolean; onStart: (pack: CoinPackage) => void }) {
  return <li className="shop-pack">
    <BytesAmount amount={pack.coins} className="shop-pack-amount" />
    <span className="shop-pack-price">{formatMoney(pack.priceMinor, pack.currency)}</span>
    <button type="button" className="shop-button is-primary" disabled={busy || mode === 'off'} onClick={() => onStart(pack)}
      aria-label={`Doładuj ${formatBytes(pack.coins)} za ${formatMoney(pack.priceMinor, pack.currency)}`}>Doładuj</button>
  </li>;
}

export default function ShopTopUpPage() {
  const { sessionKey } = useAuth();
  const { shop, status, refresh, replace } = useShop();
  const [order, setOrder] = useState<TopUpOrder | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ kind: 'ok' | 'error'; text: string } | null>(null);
  const id = useId();
  const auth = { sessionKey };

  const run = async (work: () => Promise<void>) => {
    setBusy(true);
    setMessage(null);
    try { await work(); }
    catch { setMessage({ kind: 'error', text: 'Nie udało się połączyć z serwerem.' }); }
    finally { setBusy(false); }
  };

  const start = (pack: CoinPackage) => run(async () => {
    const response = await startTopUp(pack.id, auth);
    if (!response.ok) { setMessage({ kind: 'error', text: await errorMessage(response, 'Nie udało się rozpocząć doładowania.') }); return; }
    const created = await response.json();
    if (created.redirectUrl) window.location.assign(created.redirectUrl);
    else setOrder(created);
  });

  const payTest = () => run(async () => {
    if (!order) return;
    const response = await payTestTopUp(order.id, auth);
    setOrder(null);
    if (!response.ok) { setMessage({ kind: 'error', text: await errorMessage(response, 'Płatność się nie udała.') }); return; }
    replace(await response.json());
    setMessage({ kind: 'ok', text: `Doładowano ${formatBytes(order.coins)}.` });
  });

  const cancel = () => run(async () => {
    if (!order) return;
    const pending = order;
    setOrder(null);
    const response = await cancelTopUp(pending.id, auth);
    if (!response.ok) setMessage({ kind: 'error', text: await errorMessage(response, 'Nie udało się anulować zamówienia.') });
  });

  return <div className="room-tokens shop-page">
    <section className="shop-hero is-compact" aria-labelledby={`${id}-title`}>
      <div className="shop-hero-inner">
        <div>
          <Link className="shop-back" to="/shop"><ArrowLeft size={16} aria-hidden="true" />Wróć do Sklepu</Link>
          <h1 id={`${id}-title`}>Doładuj Bajty</h1>
          <p>Wybierz pakiet. Bajty trafią na Twoje konto od razu po opłaceniu zamówienia.</p>
        </div>
        <BalanceCard balance={shop?.balance ?? null} />
      </div>
    </section>

    <div className="shop-shell">
      {message && <p className={`shop-message is-${message.kind}`} role={message.kind === 'error' ? 'alert' : 'status'}>{message.text}</p>}
      {status === 'error' && !shop && <p className="shop-message is-error" role="alert">
        Nie udało się wczytać pakietów. <button type="button" className="shop-link" onClick={refresh}>Spróbuj ponownie</button>
      </p>}
      {shop?.topUps === 'off' && <p className="shop-note">Płatności uruchomimy wkrótce. Do tego czasu Bajty może przyznać administrator.</p>}
      {shop?.topUps === 'test' && <p className="shop-note">Tryb testowy: żadne pieniądze nie zostaną pobrane.</p>}
      {shop ? <ul className="shop-packs" aria-label="Pakiety Bajtów">{shop.packages.map(pack => <PackCard key={pack.id} pack={pack} mode={shop.topUps} busy={busy} onStart={start} />)}</ul>
        : status !== 'error' && <p className="shop-empty">Wczytuję pakiety…</p>}
    </div>

    <AlertDialog open={order !== null}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Płatność testowa</AlertDialogTitle>
          <AlertDialogDescription>
            {order ? `Zamówienie na ${formatBytes(order.coins)} za ${formatMoney(order.priceMinor, order.currency)}. To tylko test, prawdziwe płatności podłączymy później.` : ''}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel onClick={() => void cancel()}>Anuluj zamówienie</AlertDialogCancel>
          <AlertDialogAction onClick={() => void payTest()}>Zapłać testowo</AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  </div>;
}
